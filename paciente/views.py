from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from datetime import date
from django.http import JsonResponse, HttpResponseNotAllowed
from django.db.models import Max, Min, Prefetch, Q, F
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_date
from django.utils.timezone import now
from django.views.decorators.http import require_http_methods, require_POST
from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError

from .models import (
    Paciente, Lembrete, ContatoNutricionista,
    AnotacaoContato, Material, MaterialEnviado,
    RegraLembrete, Consulta, GrupoLembrete
)

import json
from datetime import timedelta, datetime, date

@login_required
def home(request):
    contatos = Paciente.objects.filter(dono=request.user)
    return render(request, 'home/home.html', {'contatos': contatos})

@login_required
def listar_pacientes_com_consultas(request):
    pacientes = (
        Paciente.objects
        .filter(dono=request.user)
        .select_related('grupo_lembrete')
    )

    try:
        pagina = int(request.GET.get('page', 1))
    except (TypeError, ValueError):
        pagina = 1
    pagina = max(pagina, 1)

    try:
        tamanho_pagina = int(request.GET.get('page_size', 10))
    except (TypeError, ValueError):
        tamanho_pagina = 10
    tamanho_pagina = max(1, min(tamanho_pagina, 50))

    nome = request.GET.get('nome', '').strip()
    status_lembrete = request.GET.get('status_lembrete', '').strip()

    if nome:
        pacientes = pacientes.filter(nome__icontains=nome)

    if status_lembrete:
        if status_lembrete.lower() in {'true', 'false'}:
            pacientes = pacientes.filter(lembretes_ativos=status_lembrete.lower() == 'true')
        else:
            pacientes = pacientes.filter(lembretes_ativos=status_lembrete)

    pacientes = pacientes.annotate(
        proximo_lembrete_data=Min(
            'lembretes__data_lembrete',
            filter=Q(lembretes__concluido=False)
        ),
        ultima_consulta_data=Max('consultas__data_consulta')
    )

    ordenar_por = request.GET.get('sort', '')

    if ordenar_por == 'name-asc':
        pacientes = pacientes.order_by('nome', 'id')
    elif ordenar_por == 'name-desc':
        pacientes = pacientes.order_by('-nome', '-id')
    elif ordenar_por == 'contact-farthest':
        pacientes = pacientes.order_by(
            F('proximo_lembrete_data').desc(nulls_last=True),
            'id'
        )
    else:
        pacientes = pacientes.order_by(
            F('proximo_lembrete_data').asc(nulls_last=True),
            'id'
        )

    total_pacientes = pacientes.count()

    offset = (pagina - 1) * tamanho_pagina
    limite = offset + tamanho_pagina

    pacientes = pacientes[offset:limite]

    lembretes_prefetch = Prefetch(
        'lembretes',
        queryset=Lembrete.objects.order_by('data_lembrete')
    )
    consultas_prefetch = Prefetch(
        'consultas',
        queryset=Consulta.objects.order_by('-id')
    )

    pacientes = pacientes.prefetch_related(lembretes_prefetch, consultas_prefetch)

    pacientes_lista = list(pacientes)

    dados = []
    for paciente in pacientes_lista:
        lembretes = list(paciente.lembretes.all())

        lembretes_pendentes = [
            lembrete for lembrete in lembretes
            if not lembrete.concluido
        ]

        lembretes_pendentes.sort(key=lambda lembrete: lembrete.data_lembrete or date.max)

        ultimo = lembretes_pendentes[0] if len(lembretes_pendentes) >= 1 else None
        penultimo = lembretes_pendentes[1] if len(lembretes_pendentes) >= 2 else None

        if ultimo and not penultimo:
            concluidos = [
                lembrete for lembrete in lembretes
                if lembrete.concluido
            ]
            concluidos.sort(key=lambda lembrete: lembrete.data_lembrete or date.min, reverse=True)
            penultimo = concluidos[0] if concluidos else None

        igual_ao_ultimo = bool(
            ultimo and penultimo and (penultimo.regra_id == ultimo.regra_id)
        )

        consultas_serializadas = [
            {
                'id': consulta.id,
                'data_consulta': consulta.data_consulta,
                'tipo_consulta': consulta.tipo_consulta,
            }
            for consulta in paciente.consultas.all()
        ]

        item = {
            'id': paciente.id,
            'nome': paciente.nome,
            'telefone': paciente.telefone,
            'ultima_consulta': paciente.ultima_consulta_data,
            'proximo_lembrete': ultimo.data_lembrete if ultimo else None,
            'penultimo_lembrete': penultimo.data_lembrete if penultimo else None,
            'nome_lembrete': None,
            'lembretes_ativos': paciente.lembretes_ativos,
            'paciente_ativo': paciente.ativo,
            'grupo_regra_atual': paciente.grupo_lembrete.nome if paciente.grupo_lembrete else None,
            'consultas': consultas_serializadas,
        }

        if not igual_ao_ultimo and ultimo:
            item['texto_lembrete'] = (
                ultimo.regra.descricao if ultimo and ultimo.regra else ultimo.texto
            )
        else:
            item['texto_lembrete'] = "Você já enviou todos os materiais necessários."

        dados.append(item)

    possui_mais = (offset + len(dados)) < total_pacientes

    return JsonResponse({
        'pacientes': dados,
        'total': total_pacientes,
        'page': pagina,
        'page_size': tamanho_pagina,
        'has_more': possui_mais,
    })

@csrf_exempt  # prefira manter CSRF se estiver autenticando por sessão/cookies
@login_required
@require_POST
def cadastrar_paciente(request):
    # Tente decodificar JSON
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido'}, status=400)

    nome = data.get('nome')
    telefone = data.get('telefone')
    data_ultima_consulta = data.get('data_ultima_consulta')
    tipo_consulta = data.get('tipo_consulta', 'consulta')

    # Valida campos obrigatórios
    if not nome or not data_ultima_consulta:
        return JsonResponse({'erro': 'Nome e data da última consulta são obrigatórios'}, status=400)

    # Valida formato de data (YYYY-MM-DD esperado pelo parse_date)
    data_consulta = parse_date(str(data_ultima_consulta))
    if data_consulta is None:
        return JsonResponse({'erro': 'Data da última consulta inválida. Use o formato YYYY-MM-DD.'}, status=400)

    try:
        with transaction.atomic():
            paciente = Paciente.objects.create(
                nome=nome,
                telefone=telefone,
                dono=request.user
            )
            Consulta.objects.create(
                paciente=paciente,
                data_consulta=data_consulta,
                tipo_consulta=tipo_consulta
            )
    except IntegrityError:
        # Ex.: constraint NOT NULL/FK/unique
        return JsonResponse({'erro': 'Falha de integridade ao salvar os dados. Verifique os campos enviados.'}, status=422)

    return JsonResponse({'mensagem': 'Paciente cadastrado com sucesso', 'id_paciente': paciente.id}, status=201)

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
        lembrete_atual.contato_em = now().date()
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
                    texto=nova_regra.descricao,
                    contato_em=None
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

        # ver se tem algum lembrete ativo com essa regra e atualizar a data
        lembretes = Lembrete.objects.filter(regra=regra, concluido=False)
        for lembrete in lembretes:

            # buscar data do ultimo contato do paciente
            ultimo_contato = lembrete.paciente.lembretes.filter(concluido=True).order_by('-contato_em').first()
            # se existir, usa a data do ultimo contato
            data_ultimo_contato = now().date()
            if ultimo_contato:
                data_ultimo_contato = ultimo_contato.contato_em

            lembrete.data_lembrete = data_ultimo_contato + timedelta(days=regra.dias_apos)
            lembrete.texto = regra.descricao
            lembrete.save()
        
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
            texto=regra.descricao,
            contato_em=now().date()
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
    
    if req not in ['habilitar', 'desabilitar', 'excluir']:
        return JsonResponse({'erro': 'Estado deve ser "habilitar" ou "desabilitar" ou "excluir'}, status=400)
    
    estado = None

    if req == 'habilitar':
        # empurar para a primeira regra existente
        regra = RegraLembrete.objects.filter(nutricionista=request.user, grupo=paciente.grupo_lembrete).order_by('ordem').first()
        if not regra:
            return JsonResponse({'erro': 'Escolha uma regra de lembrete!'}, status=400)

        data_lembrete = now().date() + timedelta(days=regra.dias_apos)
        Lembrete.objects.create(
            paciente=paciente,
            regra=regra,
            data_lembrete=data_lembrete,
            texto=regra.descricao,
            contato_em=now().date()
        )

        paciente.ativo = True
        estado = True

        paciente.lembretes_ativos = estado
        paciente.save()

    elif req == 'desabilitar':
        paciente.grupo_lembrete = None

        # excluir lembretes futuros ou ativo
        Lembrete.objects.filter(paciente=paciente, concluido=False).delete()
        
        paciente.ativo = False
        estado = False

        paciente.lembretes_ativos = estado
        paciente.save()

    else: # excluir
        paciente.delete()

    if estado == True:
        return JsonResponse({'mensagem': 'Lembretes ativados com sucesso'})
    elif estado == False:
        return JsonResponse({'mensagem': 'Lembretes desativados com sucesso'})
    else: 
        return JsonResponse({'mensagem': 'Paciente excluído com sucesso'})

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
    tipo_consulta = data.get('tipoConsulta')

    if not data_consulta or not tipo_consulta:
        return JsonResponse({'erro': 'Todos os campos são obrigatórios'}, status=400)

    # Criar nova consulta
    Consulta.objects.create(
        paciente=paciente,
        data_consulta=parse_date(data_consulta),
        tipo_consulta=tipo_consulta
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
    paciente.ativo = True
    paciente.save()

    # buscar última consulta
    ultima_consulta = Consulta.objects.filter(paciente=paciente).values('data_consulta').order_by('-data_consulta').first()

    # Excluir lembretes em aberto para o paciente
    Lembrete.objects.filter(paciente=paciente, concluido=False).delete()

    # Buscar a primeira regra do grupo
    regra_lembrete = RegraLembrete.objects.filter(grupo=grupo_lembrete, nutricionista=request.user).order_by('ordem').first()
    if not regra_lembrete:
        return JsonResponse({'erro': 'Nenhuma regra encontrada para o grupo'}, status=400)

    # Busca o último lembrete (concluído ou não)
    ultimo_lembrete = Lembrete.objects.filter(paciente=paciente).order_by('-pk').first()

    if not ultimo_lembrete:
        # Se não tem nenhum lembrete, usa a data da consulta ou hoje como base
        if ultima_consulta and ultima_consulta.get('data_consulta'):
            base_data = ultima_consulta['data_consulta']
        else:
            base_data = now().date()
        
        nova_data = base_data + timedelta(days=regra_lembrete.dias_apos)
    else:
        # Se o último lembrete está pendente (não foi concluído)
        if not ultimo_lembrete.concluido:
            # Marca o lembrete pendente como concluído com a data de hoje
            ultimo_lembrete.concluido = True
            ultimo_lembrete.contato_em = now().date()
            ultimo_lembrete.save()
        
        # Usa a data de contato do último lembrete (se existir) ou a data do lembrete como base
        base_data = ultimo_lembrete.contato_em if ultimo_lembrete.contato_em else ultimo_lembrete.data_lembrete
        nova_data = base_data + timedelta(days=regra_lembrete.dias_apos)

    # Cria o novo lembrete (pendente)
    Lembrete.objects.create(
        paciente=paciente,
        regra=regra_lembrete,
        data_lembrete=nova_data,
        texto=regra_lembrete.descricao,
        contato_em=None,
        concluido=False
    )

    return JsonResponse({'mensagem': 'Grupo de regras atribuído com sucesso.'})
    
@login_required
@require_http_methods(["PUT", "DELETE"])
@csrf_exempt
def materiais(request, pk):
    try:
        material = Material.objects.get(dono=request.user, pk=pk)
    except Material.DoesNotExist:
        return JsonResponse({'erro': 'Material não encontrado'}, status=404)

    if request.method == 'PUT':
        data = json.loads(request.body)
        descricao = data.get('descricao')

        # Verifica se já existe outro material com a mesma descrição para o usuário
        if Material.objects.filter(dono=request.user, descricao=descricao).exclude(pk=pk).exists():
            return JsonResponse({'erro': 'Já existe um material com essa descrição.'}, status=400)

        material.descricao = descricao
        material.save()
        return JsonResponse({'mensagem': 'Material atualizado com sucesso'})

    elif request.method == 'DELETE':
        material.delete()
        return JsonResponse({'mensagem': 'Material excluído com sucesso'})

    return HttpResponseNotAllowed(['PUT', 'DELETE'])

@login_required
@require_http_methods(["GET", "POST"])
@csrf_exempt
def buscar_materiais(request):
    try:
        material = Material.objects.filter(dono=request.user)
    except Material.DoesNotExist:
        return JsonResponse({'erro': 'Material não encontrado'}, status=404)

    if request.method == 'GET':
        data = [{'id': m.id, 'descricao': m.descricao} for m in material]
        return JsonResponse({'materiais': data})

    if request.method == 'POST':
        data = json.loads(request.body)
        descricao = data.get('descricao')
        
        # Verifica se já existe outro material com a mesma descrição para o usuário
        if Material.objects.filter(dono=request.user, descricao=descricao).exists():
            return JsonResponse({'erro': 'Já existe um material com essa descrição.'}, status=400)
        else:
            Material.objects.create(
                dono=request.user,
                descricao=descricao
            )

        return JsonResponse({'mensagem': 'Novo material adicionado com sucesso'})

    return HttpResponseNotAllowed(['GET'])

@login_required
@require_http_methods(['GET'])
def historico_consulta(request, pk):
    try:
        paciente = Paciente.objects.get(pk=pk, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    consultas = Consulta.objects.filter(paciente=paciente).order_by('data_consulta')
    consultas_list = [
        {
            'id': consulta.id,
            'data_consulta': consulta.data_consulta.strftime('%d/%m/%Y') if consulta.data_consulta else None,
            'tipo_consulta': consulta.tipo_consulta,
        }
        for consulta in consultas
    ]

    return JsonResponse({'consultas': consultas_list})

@login_required
@require_http_methods(['GET'])
def historico_contatos(request, pk):
    try:
        paciente = Paciente.objects.get(pk=pk, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    contatos = ContatoNutricionista.objects.filter(paciente=paciente).order_by('-data_contato').prefetch_related('anotacoes__material_enviado')
    contatos_list = []
    for contato in contatos:
        anotacoes = []
        for anotacao in contato.anotacoes.all():
            materiais = [{'id': m.id, 'descricao': m.descricao} for m in anotacao.material_enviado.all()]
            anotacoes.append({
                'id': anotacao.id,
                'texto': anotacao.texto,
                'materiais_enviados': materiais,
                'criado_em': anotacao.criado_em,
            })
        contatos_list.append({
            'id': contato.id,
            'data_contato': contato.data_contato,
            'tipo': contato.tipo,
            'criado_em': contato.criado_em,
            'anotacoes': anotacoes,
        })

    return JsonResponse({'contatos': contatos_list})

@csrf_exempt
@login_required
@require_http_methods(["PUT"])
def atualizar_paciente(request, pk):
    try:
        paciente = Paciente.objects.get(pk=pk, dono=request.user)
    except Paciente.DoesNotExist:
        return JsonResponse({'erro': 'Paciente não encontrado'}, status=404)

    data = json.loads(request.body)
    nome = data.get('nome')
    telefone = data.get('telefone')

    if nome is not None:
        paciente.nome = nome
    if telefone is not None:
        paciente.telefone = telefone

    paciente.save()
    return JsonResponse({'mensagem': 'Paciente atualizado com sucesso'})

@login_required
def verifica_se_tem_cadastrado(request):
    user = request.user

    tem_material = Material.objects.filter(dono=user).exists()
    tem_grupo = GrupoLembrete.objects.filter(dono=user).exists()
    tem_paciente = Paciente.objects.filter(dono=user).exists()

    context = {
        'tem_material': tem_material,
        'tem_grupo': tem_grupo,
        'tem_paciente': tem_paciente,
    }

    return JsonResponse(context)

@csrf_exempt
@login_required
@require_http_methods(["DELETE"])
def excluir_grupo_regra(request, pk):
    try:
        grupo = GrupoLembrete.objects.get(pk=pk, dono=request.user)
    except GrupoLembrete.DoesNotExist:
        return JsonResponse({'erro': 'Grupo de regras não encontrado'}, status=404)

    grupo.delete()
    return JsonResponse({'mensagem': 'Grupo de regras excluído com sucesso'})

def filtrar_home(request):

    nome = request.GET.get('nome_paciente')
    status_lembrete = request.GET.get('status_lembrete')

