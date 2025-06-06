from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from datetime import date
from django.http import JsonResponse, HttpResponseNotAllowed
from django.db.models import Max, Min
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_date
from django.utils.timezone import now
from django.views.decorators.http import require_http_methods

from .models import (
    Paciente, Lembrete, ContatoNutricionista,
    AnotacaoContato, Material, MaterialEnviado,
    RegraLembrete, Consulta
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
            'lembretes_ativos': True
        })

    return JsonResponse({'pacientes': dados})

@csrf_exempt
@login_required
def cadastrar_paciente(request):
    if request.method == 'POST':

        # Buscar a primeira regra de lembrete
        if not RegraLembrete.objects.filter(nutricionista=request.user).exists():
            return JsonResponse({'erro': 'Nenhuma regra de lembrete encontrada'}, status=400)

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

        # Obter a primeira regra de lembrete
        regra = RegraLembrete.objects.filter(nutricionista=request.user).order_by('ordem').first()

        # Criar lembretes com base nas regras
        # for regra in regras:
        data_lembrete = data_consulta + timedelta(days=regra.dias_apos)
        Lembrete.objects.create(
            paciente=paciente,
            data_lembrete=data_lembrete,
            texto=regra.descricao,
            regra=regra
        )

        return JsonResponse({'mensagem': 'Paciente cadastrado com sucesso'})
    
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
    tipo_contato = data.get('tipo')  # ex: "first" ou "followup"
    anotacao_texto = data.get('anotacao', '')
    materiais = data.get('materiais', [])  # lista de strings

    if not paciente_id or not tipo_contato:
        return JsonResponse({'erro': 'Paciente e tipo de contato são obrigatórios'}, status=400)

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
            regras = list(RegraLembrete.objects.filter(nutricionista=request.user).order_by('ordem'))
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

    # Última consulta
    ultima_consulta = (
        ContatoNutricionista.objects
        .filter(paciente=paciente)
        .order_by('-data_contato')
        .first()
    )

    # Próximo lembrete
    lembrete = (
        Lembrete.objects
        .filter(paciente=paciente, concluido=False)
        .order_by('data_lembrete')
        .first()
    )

    data = {
        'id': paciente.id,
        'nome': paciente.nome,
        'telefone': paciente.telefone,
        'ultima_consulta': ultima_consulta.data_contato.isoformat() if ultima_consulta else None,
        'proximo_lembrete': lembrete.data_lembrete.isoformat() if lembrete else None,
        'texto_lembrete': lembrete.texto if lembrete else None,
        'nome_lembrete': lembrete.regra.nome if lembrete and lembrete.regra else None,
        'lembretes_ativos': lembrete is not None,
    }

    return JsonResponse(data)

@csrf_exempt
@login_required
def regras_list_create(request):
    if request.method == 'GET':
        regras = RegraLembrete.objects.filter(nutricionista=request.user).order_by('ordem')
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

        # busca a ordem da ultima regra
        ultima_ordem = RegraLembrete.objects.filter(nutricionista=request.user).aggregate(Max('ordem'))['ordem__max']

        regra = RegraLembrete.objects.create(
            nutricionista=request.user,
            nome=data.get('nome'),
            dias_apos=data.get('dias_apos'),
            descricao=data.get('descricao', ''),
            ordem=ultima_ordem + 1 if ultima_ordem is not None else 0,
        )
        return JsonResponse({'id': regra.id, 'mensagem': 'Regra criada com sucesso'})

    return HttpResponseNotAllowed(['GET', 'POST'])

@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
@login_required
def regras_detail_update(request, pk):
    try:
        regra = RegraLembrete.objects.get(pk=pk, nutricionista=request.user)
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
def regra_mover_up(request, pk):
    try:
        regra = RegraLembrete.objects.get(pk=pk, nutricionista=request.user)
    except RegraLembrete.DoesNotExist:
        return JsonResponse({'erro': 'Regra não encontrada'}, status=404)

    anterior = RegraLembrete.objects.filter(
        nutricionista=request.user,
        ordem__lt=regra.ordem
    ).order_by('-ordem').first()

    if anterior:
        regra.ordem, anterior.ordem = anterior.ordem, regra.ordem
        regra.save()
        anterior.save()

    return JsonResponse({'mensagem': 'Movido para cima'})

@csrf_exempt
@login_required
def regra_mover_down(request, pk):
    try:
        regra = RegraLembrete.objects.get(pk=pk, nutricionista=request.user)
    except RegraLembrete.DoesNotExist:
        return JsonResponse({'erro': 'Regra não encontrada'}, status=404)

    posterior = RegraLembrete.objects.filter(
        nutricionista=request.user,
        ordem__gt=regra.ordem
    ).order_by('ordem').first()

    if posterior:
        regra.ordem, posterior.ordem = posterior.ordem, regra.ordem
        regra.save()
        posterior.save()

    return JsonResponse({'mensagem': 'Movido para baixo'})