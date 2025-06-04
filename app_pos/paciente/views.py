from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from datetime import date
from django.http import JsonResponse
from django.db.models import Max, Min
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_date

from .models import Paciente, Consulta, Lembrete, RegraLembrete, Material

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
        regras = RegraLembrete.objects.filter(nutricionista=request.user, primeira_consulta=True)

        # Criar lembretes com base nas regras
        for regra in regras:
            data_lembrete = data_consulta + timedelta(days=regra.dias_apos)
            Lembrete.objects.create(
                paciente=paciente,
                data_lembrete=data_lembrete,
                texto=regra.descricao
            )

        return JsonResponse({'mensagem': 'Paciente cadastrado com sucesso'})
    
    return JsonResponse({'erro': 'Método não permitido'}, status=405)

@login_required
def listar_materiais(request):
    materiais = Material.objects.filter(dono=request.user).values_list('descricao', flat=True)
    return JsonResponse({'materiais': list(materiais)})
