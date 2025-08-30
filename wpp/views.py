import json
import logging
from typing import Dict, Any
from django.conf import settings
from django.http import HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt

from .services import wpp_send_template

logger = logging.getLogger(__name__)

@csrf_exempt
def whatsapp_webhook(request):
    """
    Webhook para WhatsApp Cloud API SEM validação de assinatura.
    - GET: verificação do endpoint (hub.challenge)
    - POST: eventos (mensagens recebidas e status de envio)
    """
    if request.method == "GET":
        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")

        expected = getattr(settings, "WHATSAPP_VERIFY_TOKEN", None)
        if mode == "subscribe" and token == expected:
            return HttpResponse(challenge or "", status=200, content_type="text/plain")
        return HttpResponseBadRequest("Token inválido.")

    if request.method == "POST":
        try:
            raw_body = request.body.decode("utf-8") or "{}"
            data: Dict[str, Any] = json.loads(raw_body)
            logger.debug(f"[WEBHOOK IN] {data}")

            for entry in data.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    _route_event(value)

        except Exception as e:
            # Retorna 200 para evitar redelivery infinito da Meta,
            # mas deixa o stacktrace no log para investigação.
            logger.exception(f"Erro no webhook: {e}")
            return HttpResponse(status=200)

        return HttpResponse(status=200)

    return HttpResponse(status=405)  # método não permitido

def _route_event(value: Dict[str, Any]) -> None:
    """Identifica e despacha o tipo de evento recebido."""
    # Mensagens recebidas do usuário
    if value.get("messages"):
        for msg in value["messages"]:
            _handle_incoming_message(value, msg)
        return

    # Status de mensagens enviadas por você (sent, delivered, read, failed)
    if value.get("statuses"):
        for st in value["statuses"]:
            _handle_status_update(value, st)
        return

    if value.get("errors"):
        logger.error(f"[WEBHOOK ERRORS] {value['errors']}")


def _handle_incoming_message(value: Dict[str, Any], msg: Dict[str, Any]) -> None:
    """Trata mensagem recebida do usuário (text, image, button, etc.)."""
    contacts = value.get("contacts", [])
    wa_id = contacts[0].get("wa_id") if contacts else None

    from_ = msg.get("from")          # E.164 sem '+'
    msg_id = msg.get("id")
    msg_type = msg.get("type")
    timestamp = msg.get("timestamp")

    if msg_type == "text":
        text = (msg.get("text") or {}).get("body", "")
        logger.info(f"[INCOMING] from={from_} wa_id={wa_id} text={text}")
        # TODO: salvar no banco / acionar fluxo / classificar intenção
    else:
        logger.info(f"[INCOMING] from={from_} type={msg_type} payload={msg}")
        # TODO: tratar outros tipos (image, button, interactive, etc.)

    # Envia o template hello_world assim que receber QUALQUER mensagem
    try:
        resp = wpp_send_template(
            to_e164=from_,
            template_name="hello_world",
            lang=getattr(settings, "WHATSAPP_TEMPLATE_LANG", "en_US"),
        )
        logger.info(f"[TEMPLATE SENT] to={from_} resp={resp}")
        # TODO: gravar provider_msg_id em MessageLog se quiser
    except Exception as e:
        logger.exception(f"[TEMPLATE ERROR] to={from_} err={e}")


def _handle_status_update(value: Dict[str, Any], st: Dict[str, Any]) -> None:
    """Atualiza status de mensagens enviadas por você (entrega/leitura/falha)."""
    status = st.get("status")         # sent, delivered, read, failed
    message_id = st.get("id")
    timestamp = st.get("timestamp")
    recipient = st.get("recipient_id")
    errors = st.get("errors", [])

    if status == "failed" and errors:
        err = errors[0]
        code = err.get("code")
        title = err.get("title")
        detail = err.get("detail")
        logger.error(f"[STATUS] id={message_id} -> FAILED ({code}) {title}: {detail}")
    else:
        logger.info(f"[STATUS] id={message_id} -> {status} (to={recipient})")

    # TODO: atualizar seu MessageLog:
    # MessageLog.objects.filter(provider_msg_id=message_id).update(status=status)
