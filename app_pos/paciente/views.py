from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from datetime import date
from django.http import JsonResponse, HttpResponseNotAllowed
from django.db.models import Max, Min
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_date
from django.utils.timezone import now
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404

from .models import (
    Paciente, Lembrete, ContatoNutricionista,
    AnotacaoContato, Material, MaterialEnviado,
    RegraLembrete, Consulta, GrupoLembrete
)

import json
from datetime import timedelta

@login_required
def home(request):
    contatos = Paciente.objects.filter(dono=request.user)
    return render(request, 'home/home.html', {'contatos': contatos})

@login_required
def listar_pacientes_com_consultas(request):
    pacientes = Paciente.objects.filter(dono=request.user)

    # Última consulta por paciente
    ultimas_consultas = (
        Consulta.objects
        .filter(paciente__in=pacientes)
        .values('paciente_id')
        .annotate(ultima=Max('data_consulta'))
    )
    consulta_map = {uc['paciente_id']: uc['ultima'] for uc in ultimas_consultas}

    # Buscar todas as consultas dos pacientes para trazer tipo_consulta
    consultas = Consulta.objects.filter(paciente__in=pacientes).order_by('-data_consulta')
    consultas_por_paciente = {}
    for consulta in consultas:
        consultas_por_paciente.setdefault(consulta.paciente_id, []).append({
            'id': consulta.id,
            'data_consulta': consulta.data_consulta,
            'tipo_consulta': consulta.tipo_consulta,
        })

    dados = []
    for paciente in pacientes:
        lembrete = paciente.lembretes.filter(concluido=False).select_related('regra').order_by('data_lembrete').first()

        dados.append({
            'id': paciente.id,
            'nome': paciente.nome,
            'telefone': paciente.telefone,
            'ultima_consulta': consulta_map.get(paciente.id),
            'proximo_lembrete': lembrete.data_lembrete if lembrete else None,
            'texto_lembrete': lembrete.regra.descricao if lembrete and lembrete.regra else lembrete.texto if lembrete else None,
            'nome_lembrete': None,
            'lembretes_ativos': paciente.lembretes_ativos,
            'paciente_ativo': paciente.ativo,
            'grupo_regra_atual': paciente.grupo_lembrete.nome if paciente.grupo_lembrete else None,
            'consultas': consultas_por_paciente.get(paciente.id, [])
        })

    return JsonResponse({'pacientes': dados})

@csrf_exempt
@login_required
def cadastrar_paciente(request):
    if request.method == 'POST':

        data = json.loads(request.body)

        nome = data.get('nome')
        telefone = data.get('telefone')
        data_ultima_consulta = data.get('data_ultima_consulta')

        if not nome or not data_ultima_consulta:
            return JsonResponse({'erro': 'Nome e data da última consulta são obrigatórios'}, status=400)

        # Criar paciente
        paciente = Paciente.objects.create(
            nome=nome,
            telefone=telefone,
            dono=request.user
        )

        # Criar consulta
        data_consulta = parse_date(data_ultima_consulta)
        Consulta.objects.create(
            paciente=paciente,
            data_consulta=data_consulta
        )

        return JsonResponse({'mensagem': 'Paciente cadastrado com sucesso', 'id_paciente':paciente.id})
    
    return JsonResponse({'erro': 'Método não permitido'}, status=405)

@login_required
def listar_materiais(request):
    materiais = Material.objects.filter(dono=request.user).values_list('descricao', flat=True)
    return JsonResponse({'materiais': list(materiais)})

@csrf_exempt
@login_required
def registrar_contato(request):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido'}, status=405)

    data = json.loads(request.body)
    paciente_id = data.get('paciente_id')
    tipo_contato = data.get('tipo', None)  # ex: "first" ou "followup"
    anotacao_texto = data.get('anotacao', '')
    materiais = data.get('materiais', [])  # lista de strings

    if not paciente_id:
        return JsonResponse({'erro': 'Paciente é obrigatório'}, status=400)

    # verificar se existe alguma regra de lembrete
    if not RegraLembrete.objects.filter(nutricionista=request.user).exists():
        return JsonResponse({'erro': 'Crie uma regra para registrar contato.'}, status=400)

    try:
        paciente = Paciente.objects.get(id=paciente_id, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    # 1. Criar contato
    contato = ContatoNutricionista.objects.create(
        paciente=paciente,
        data_contato=now().date(),
        tipo=tipo_contato
    )

    # 2. Criar anotação
    anotacao = AnotacaoContato.objects.create(
        contato=contato,
        texto=anotacao_texto
    )

    # 3. Associar materiais (criar se necessário)
    for nome in materiais:
        material_obj, _ = Material.objects.get_or_create(descricao=nome, dono=request.user)
        anotacao.material_enviado.add(material_obj)

    anotacao.save()

    # 4. Marcar lembrete atual como concluído (se existir)
    lembrete_atual = Lembrete.objects.filter(paciente=paciente, concluido=False).order_by('data_lembrete').first()
    if lembrete_atual:
        lembrete_atual.concluido = True
        lembrete_atual.save()

        # 5. Determinar próxima regra
        regra_atual = lembrete_atual.regra
        nova_regra = None

        if regra_atual:
            regras = list(RegraLembrete.objects.filter(nutricionista=request.user, grupo=paciente.grupo_lembrete).order_by('ordem'))
            regras_ordenadas = {r.ordem: r for r in regras}
            proxima_ordem = regra_atual.ordem + 1

            if proxima_ordem in regras_ordenadas:
                nova_regra = regras_ordenadas[proxima_ordem]
            else:
                nova_regra = regra_atual  # repete a última regra se não houver próxima

        if nova_regra:
            nova_data = now().date() + timedelta(days=nova_regra.dias_apos)
            # Verifica se já existe
            existe = Lembrete.objects.filter(paciente=paciente, data_lembrete=nova_data, concluido=False).exists()
            if not existe:
                Lembrete.objects.create(
                    paciente=paciente,
                    regra=nova_regra,
                    data_lembrete=nova_data,
                    texto=nova_regra.descricao
                )

            return JsonResponse({
                'mensagem': 'Contato registrado com sucesso',
                'proximo_lembrete': nova_data.strftime('%d/%m/%Y')
            })

    return JsonResponse({'mensagem': 'Contato registrado com sucesso', 'proximo_lembrete': None})

@login_required
def paciente_detalhe(request, pk):
    try:
        paciente = Paciente.objects.get(pk=pk, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    # Última consulta do paciente
    ultima_consulta = (
        Consulta.objects
        .filter(paciente=paciente)
        .aggregate(ultima=Max('data_consulta'))
    )['ultima']

    # Todas as consultas do paciente
    consultas = Consulta.objects.filter(paciente=paciente).order_by('-data_consulta')
    consultas_list = [
        {
            'id': consulta.id,
            'data_consulta': consulta.data_consulta,
            'tipo_consulta': consulta.tipo_consulta,
        }
        for consulta in consultas
    ]

    # Próximo lembrete
    lembrete = paciente.lembretes.filter(concluido=False).select_related('regra').order_by('data_lembrete').first()
    proximo_lembrete = lembrete.data_lembrete if lembrete else None
    texto_lembrete = (
        lembrete.regra.descricao if lembrete and lembrete.regra
        else lembrete.texto if lembrete
        else None
    )

    dados = {
        'id': paciente.id,
        'nome': paciente.nome,
        'telefone': paciente.telefone,
        'ultima_consulta': ultima_consulta,
        'proximo_lembrete': proximo_lembrete,
        'texto_lembrete': texto_lembrete,
        'nome_lembrete': None,
        'lembretes_ativos': paciente.lembretes_ativos,
        'paciente_ativo': paciente.ativo,
        'grupo_regra_atual': paciente.grupo_lembrete.nome if paciente.grupo_lembrete else None,
        'consultas': consultas_list
    }

    return JsonResponse(dados)

@csrf_exempt
@require_http_methods(["GET", "POST"])
@login_required
def grupo_regras_list_create(request):

    if request.method == 'GET':
        grupo_regras = GrupoLembrete.objects.filter(dono=request.user).prefetch_related('regras')
        data = [{
            'id': r.id,
            'nome': r.nome,
            'descricao': r.descricao,
            'tamanho_grupo': r.regras.count()
        } for r in grupo_regras]
        return JsonResponse({'grupos': data })
    
    elif request.method == 'POST':
        data = json.loads(request.body)

        nome = data.get('nome')
        if not nome:
            return JsonResponse({'erro': 'Nome do grupo é obrigatório'}, status=400)
        
        descricao = data.get('descricao', '')
        grupo = GrupoLembrete.objects.create(
            dono=request.user,
            nome=nome,
            descricao=descricao
        )

        return JsonResponse({'id': grupo.id, 'mensagem': 'Grupo de regras criada com sucesso'})

    return HttpResponseNotAllowed(['GET', 'POST'])

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
@login_required
def grupo_regras_update(request, pk):

    try:
        grupo = GrupoLembrete.objects.get(pk=pk, dono=request.user)
    except RegraLembrete.DoesNotExist:
        return JsonResponse({'erro': 'Grupo não encontrado'}, status=404)

    if request.method == 'PUT':
        data = json.loads(request.body)
        grupo.nome = data.get('nome', grupo.nome)
        grupo.descricao = data.get('descricao', grupo.descricao)
        grupo.save()
        return JsonResponse({'mensagem': 'Grupo atualizado'})

    elif request.method == 'DELETE':
        grupo.delete()
        return JsonResponse({'mensagem': 'Grupo excluído'})

    return HttpResponseNotAllowed(['GET', 'POST'])

@csrf_exempt
@login_required
def regras_list_create(request, pk):

    if not pk:
        return JsonResponse({'erro': 'Grupo de regras não especificado'}, status=400)
    
    if request.method == 'GET':
        regras = RegraLembrete.objects.filter(nutricionista=request.user, grupo=pk).order_by('ordem')
        data = [{
            'id': r.id,
            'nome': r.nome,
            'dias_apos': r.dias_apos,
            'descricao': r.descricao,
            'ordem': r.ordem,
        } for r in regras]
        return JsonResponse({'regras': data})

    elif request.method == 'POST':
        data = json.loads(request.body)

        grupo_lembrete = get_object_or_404(GrupoLembrete, pk=pk)

        # busca a ordem da ultima regra
        ultima_ordem = RegraLembrete.objects.filter(nutricionista=request.user, grupo=grupo_lembrete).aggregate(Max('ordem'))['ordem__max']

        regra = RegraLembrete.objects.create(
            nutricionista=request.user,
            nome=data.get('nome'),
            dias_apos=data.get('dias_apos'),
            descricao=data.get('descricao', ''),
            ordem=ultima_ordem + 1 if ultima_ordem is not None else 0,
            grupo=grupo_lembrete  
        )
        return JsonResponse({'id': regra.id, 'mensagem': 'Regra criada com sucesso'})

    return HttpResponseNotAllowed(['GET', 'POST'])

@login_required
@require_http_methods(["GET", "PUT", "DELETE"])
@csrf_exempt
def regras_detail_update(request, pk_regra, pk_grupo):
    
    try:
        regra = RegraLembrete.objects.get(pk=pk_regra, nutricionista=request.user, grupo_id=pk_grupo)
    except RegraLembrete.DoesNotExist:
        return JsonResponse({'erro': 'Regra não encontrada'}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            'id': regra.id,
            'nome': regra.nome,
            'dias_apos': regra.dias_apos,
            'descricao': regra.descricao,
            'ordem': regra.ordem
        })

    elif request.method == 'PUT':
        data = json.loads(request.body)
        regra.nome = data.get('nome', regra.nome)
        regra.dias_apos = data.get('dias_apos', regra.dias_apos)
        regra.descricao = data.get('descricao', regra.descricao)
        regra.save()
        return JsonResponse({'mensagem': 'Regra atualizada'})

    elif request.method == 'DELETE':
        regra.delete()
        return JsonResponse({'mensagem': 'Regra excluída'})

@csrf_exempt
@login_required
def regra_mover_up(request, pk_regra, pk_grupo):
    try:
        regra = RegraLembrete.objects.get(pk=pk_regra, nutricionista=request.user, grupo_id=pk_grupo)
    except RegraLembrete.DoesNotExist:
        return JsonResponse({'erro': 'Regra não encontrada'}, status=404)

    # Filtra apenas regras do mesmo grupo
    anterior = RegraLembrete.objects.filter(
        nutricionista=request.user,
        grupo_id=pk_grupo, 
        ordem__lt=regra.ordem
    ).order_by('-ordem').first()

    if anterior:
        regra.ordem, anterior.ordem = anterior.ordem, regra.ordem
        regra.save()
        anterior.save()

    return JsonResponse({'mensagem': 'Movido para cima'})

@csrf_exempt
@login_required
def regra_mover_down(request, pk_regra, pk_grupo):

    try:
        regra = RegraLembrete.objects.get(pk=pk_regra, nutricionista=request.user, grupo_id=pk_grupo)
    except RegraLembrete.DoesNotExist:
        return JsonResponse({'erro': 'Regra não encontrada'}, status=404)

    posterior = RegraLembrete.objects.filter(
        nutricionista=request.user,
        grupo_id=pk_grupo,  
        ordem__gt=regra.ordem
    ).order_by('ordem').first()

    if posterior:
        regra.ordem, posterior.ordem = posterior.ordem, regra.ordem
        regra.save()
        posterior.save()

    return JsonResponse({'mensagem': 'Movido para baixo'})

@login_required
def atualizar_cards(request):
    
    """
    Atualiza cards de contagens:
    Total de Pacientes
    Alertas Ativos
    Pacientes Ativos
    Lembretes em atraso
    """

    total_pacientes = Paciente.objects.filter(dono=request.user).count()
    alertas_ativos = Paciente.objects.filter(dono=request.user, lembretes_ativos=True).count()
    
    lembretes_atrasados = Lembrete.objects.filter(
        paciente__dono=request.user,
        concluido=False,
        data_lembrete__lt=date.today()
    ).count()

    return JsonResponse({
        'total_pacientes': total_pacientes,
        'alertas_ativos': alertas_ativos,
        'lembretes_atrasados': lembretes_atrasados
    })

@login_required
def status_lembrete(request, pk):
    
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido'}, status=405)
    
    try:
        paciente = Paciente.objects.get(pk=pk, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    try:
        req = json.loads(request.body).get('estado')
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'Estado inválido'}, status=400)
    
    if req not in ['habilitar', 'desabilitar']:
        return JsonResponse({'erro': 'Estado deve ser "habilitar" ou "desabilitar"'}, status=400)
    
    if req == 'habilitar':
        # empurar para a primeira regra existente
        regra = RegraLembrete.objects.filter(nutricionista=request.user, grupo=paciente.grupo_lembrete).order_by('ordem').first()
        if not regra:
            return JsonResponse({'erro': 'Nenhuma regra de lembrete encontrada'}, status=400)

        data_lembrete = now().date() + timedelta(days=regra.dias_apos)
        Lembrete.objects.create(
            paciente=paciente,
            regra=regra,
            data_lembrete=data_lembrete,
            texto=regra.descricao
        )
            
        estado = True
    else:
        # excluir lembretes futuros ou ativo
        Lembrete.objects.filter(paciente=paciente, concluido=False).delete()
        
        estado = False

    paciente.lembretes_ativos = estado
    paciente.save()

    if estado:
        return JsonResponse({'mensagem': 'Lembretes ativados com sucesso'})
    else:
        return JsonResponse({'mensagem': 'Lembretes desativados com sucesso'})
    
@login_required
def status_paciente(request, pk):
    
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido'}, status=405)
    
    try:
        paciente = Paciente.objects.get(pk=pk, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    try:
        req = json.loads(request.body).get('estado')
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'Estado inválido'}, status=400)
    
    if req not in ['habilitar', 'desabilitar']:
        return JsonResponse({'erro': 'Estado deve ser "habilitar" ou "desabilitar"'}, status=400)
    
    if req == 'habilitar':
        # empurar para a primeira regra existente
        regra = RegraLembrete.objects.filter(nutricionista=request.user, grupo=paciente.grupo_lembrete).order_by('ordem').first()
        if not regra:
            return JsonResponse({'erro': 'Nenhuma regra de lembrete encontrada'}, status=400)

        data_lembrete = now().date() + timedelta(days=regra.dias_apos)
        Lembrete.objects.create(
            paciente=paciente,
            regra=regra,
            data_lembrete=data_lembrete,
            texto=regra.descricao
        )

        paciente.ativo = True
        estado = True
    else:
        paciente.grupo_lembrete = None

        # excluir lembretes futuros ou ativo
        Lembrete.objects.filter(paciente=paciente, concluido=False).delete()
        
        paciente.ativo = False
        estado = False

    paciente.lembretes_ativos = estado
    paciente.save()

    if estado:
        return JsonResponse({'mensagem': 'Lembretes ativados com sucesso'})
    else:
        return JsonResponse({'mensagem': 'Lembretes desativados com sucesso'})

@csrf_exempt   
@login_required
def registrar_consulta_retorno(request, pk):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido'}, status=405)

    try:
        paciente = Paciente.objects.get(pk=pk, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    data = json.loads(request.body)
    data_consulta = data.get('dataConsulta')

    if not data_consulta:
        return JsonResponse({'erro': 'Data da consulta é obrigatória'}, status=400)

    # Criar nova consulta
    Consulta.objects.create(
        paciente=paciente,
        data_consulta=parse_date(data_consulta),
        tipo_consulta=data.get('tipoConsulta')
    )

    return JsonResponse({'mensagem': 'Consulta registrada com sucesso'})

@csrf_exempt
@login_required
def atribuir_grupo(request, pk_grupo, pk_paciente):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido'}, status=405)

    try:
        grupo_lembrete = GrupoLembrete.objects.get(pk=pk_grupo, dono=request.user)
    except GrupoLembrete.DoesNotExist:
        return JsonResponse({'erro': 'Grupo de regras não encontrado'}, status=404)

    try:
        paciente = Paciente.objects.get(pk=pk_paciente, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    paciente.grupo_lembrete = grupo_lembrete
    paciente.lembretes_ativos = True
    paciente.save()

    # Excluir lembretes em aberto para o paciente
    Lembrete.objects.filter(paciente=paciente, concluido=False).delete()

    # Buscar a primeira regra do grupo
    regra_lembrete = RegraLembrete.objects.filter(grupo=grupo_lembrete, nutricionista=request.user).order_by('ordem').first()
    if not regra_lembrete:
        return JsonResponse({'erro': 'Nenhuma regra encontrada para o grupo'}, status=400)

    nova_data = now().date() + timedelta(days=regra_lembrete.dias_apos)

    Lembrete.objects.create(
        paciente=paciente,
        regra=regra_lembrete,
        data_lembrete=nova_data,
        texto=regra_lembrete.descricao,
        
    )

    return JsonResponse({'mensagem': 'Grupo de regras atribuído com sucesso.'})
    
