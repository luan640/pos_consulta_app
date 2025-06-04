from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from datetime import date
from django.http import JsonResponse
from django.db.models import Max, Min
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_date
from django.utils.timezone import now

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

        # Buscar regras da primeira consulta
        regras = RegraLembrete.objects.filter(nutricionista=request.user, ordem=0)

        # Criar lembretes com base nas regras
        for regra in regras:
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
