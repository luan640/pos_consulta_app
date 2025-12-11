
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone

from paciente.models import Lembrete, InteracaoWhatsapp
from paciente.views import registrar_contato
from paciente.services import *

import json
import logging
import environ

logger = logging.getLogger(__name__)
env = environ.Env()

@csrf_exempt
@require_http_methods(["GET", "POST"])
def webhook(request):
    """
    Webhook para Meta:
    - GET: verificação do webhook (verify_token)
    - POST: recebe eventos (mensagens, status etc.)
    """

    # ================================================================
    # 1. VERIFICAÇÃO DO META (GET)
    # ================================================================
    if request.method == "GET":
        verify_token = env("META_VERIFY_TOKEN")

        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")

        if mode == "subscribe" and token == verify_token:
            logger.info("Webhook verificado com sucesso pelo Meta.")
            return HttpResponse(challenge)

        logger.warning("Falha na verificação do webhook. Token inválido.")
        return HttpResponse("Forbidden", status=403)

    # ================================================================
    # 2. RECEBIMENTO DE EVENTOS (POST)
    # ================================================================
    body_text = (request.body or b"").decode("utf-8", errors="replace")

    try:
        payload = json.loads(body_text) if body_text else {}
    except json.JSONDecodeError:
        payload = {}

    logger.info("Webhook recebido: %s", payload)
    print("Webhook recebido:", payload)

    # Normalização da estrutura
    try:
        entry = payload["entry"][0]
        change = entry["changes"][0]
        value = change["value"]
    except (TypeError, KeyError, IndexError):
        return JsonResponse({"status": "ignored"})

    # ================================================================
    # CASO 1 → STATUS (sent, delivered, read...)
    # ================================================================
    if "statuses" in value:
        status_obj = value["statuses"][0]

        message_id = status_obj["id"]
        novo_status = status_obj["status"]   # sent/delivered/read/etc

        lembrete = Lembrete.objects.filter(whatsapp_message_id=message_id).first()

        if lembrete:
            lembrete.whatsapp_status = novo_status
            lembrete.save()

    # ================================================================
    # CASO 2 → INTERAÇÃO COM BOTÃO
    # ================================================================
    if "messages" in value:
        msg = value["messages"][0]

        # Apenas mensagens interativas (botões)
        if msg.get("type") == "interactive":
            interactive = msg["interactive"]
            button_reply = interactive.get("button_reply")
            context = msg.get("context", {})

            botao_id = button_reply["id"]
            botao_texto = button_reply.get("title", "")
            message_id_origem = context.get("id")

            lembrete = Lembrete.objects.filter(whatsapp_message_id=message_id_origem).first()

            if lembrete:
                lembrete.whatsapp_resposta_id = botao_id
                lembrete.whatsapp_resposta_texto = botao_texto
                lembrete.whatsapp_respondido_em = timezone.now()
                lembrete.save()
            
            usuario = lembrete.regra.nutricionista

            if lembrete.regra:
                materiais = list(
                    lembrete.regra.materiais.values_list("descricao", flat=True)
                )
            else:
                materiais = []

            registrar_contato_service(
                usuario=usuario,
                paciente_id=lembrete.paciente_id,
                tipo_contato="whatsapp_button",
                anotacao_texto = f"Resposta via WhatsApp: {lembrete.whatsapp_resposta_texto}",
                materiais=materiais
            )

            InteracaoWhatsapp.objects.create(
                telefone=value["messages"][0]["from"],
                mensagem=botao_texto
            )

        elif msg.get("type") == "button":
            button = msg["button"]
            botao_id = button.get("payload")
            botao_texto = button.get("text", "")
            context = msg.get("context", {})

            message_id_origem = context.get("id")

            lembrete = Lembrete.objects.filter(whatsapp_message_id=message_id_origem).first()

            if lembrete:
                lembrete.whatsapp_resposta_id = botao_id
                lembrete.whatsapp_resposta_texto = botao_texto
                lembrete.whatsapp_respondido_em = timezone.now()
                lembrete.save()
            
                usuario = lembrete.regra.nutricionista

                if lembrete.regra:
                    materiais = list(
                        lembrete.regra.materiais.values_list("descricao", flat=True)
                    )
                else:
                    materiais = []

                registrar_contato_service(
                    usuario=usuario,
                    paciente_id=lembrete.paciente_id,
                    tipo_contato="whatsapp_button",
                    anotacao_texto = f"Resposta via WhatsApp: {lembrete.whatsapp_resposta_texto}",
                    materiais=materiais
                )

            InteracaoWhatsapp.objects.create(
                telefone=value["messages"][0]["from"],
                mensagem=botao_texto
            )

        elif msg.get("type") == 'text':

            InteracaoWhatsapp.objects.create(
                telefone=value["messages"][0]["from"],
                mensagem=value["messages"][0]["text"]["body"]
            )


    return JsonResponse({"status": "ok"})
