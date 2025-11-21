import logging
from typing import Any

import requests
from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from paciente.models import Lembrete

import environ

env = environ.Env()

logger = logging.getLogger(__name__)

def _send_whatsapp_template(to_e164: str, template_name: str, lang: str, variables: list[str]) -> dict[str, Any]:
    url = f"https://graph.facebook.com/{env('WHATSAPP_VERSION_API')}/{env('WHATSAPP_PHONE_NUMBER_ID')}/messages"
    headers = {
        "Authorization": f"Bearer {env('WHATSAPP_META_API_KEY')}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_e164,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": value} for value in variables],
                }
            ],
        },
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()

def _send_whatsapp_mensage(to_e164: str, body: str) -> dict[str, Any]:
    url = f"https://graph.facebook.com/{env('WHATSAPP_VERSION_API')}/{env('WHATSAPP_PHONE_NUMBER_ID')}/messages"
    headers = {
        "Authorization": f"Bearer {env('WHATSAPP_META_API_KEY')}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",    
        "recipient_type": "individual",
        "to": to_e164,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": body
        }
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()

@shared_task(
    bind=True,
    autoretry_for=(requests.RequestException,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def enviar_whatsapp_lembrete(self, lembrete_id: int) -> dict[str, Any]:
    lembrete = Lembrete.objects.select_related("paciente").get(pk=lembrete_id)
    paciente = lembrete.paciente
    agora = timezone.now()

    if not paciente.telefone:
        lembrete.whatsapp_status = Lembrete.WhatsappStatus.SEM_TELEFONE
        lembrete.whatsapp_disparado_em = agora
        lembrete.whatsapp_tentativas += 1
        lembrete.whatsapp_ultimo_erro = "Paciente sem telefone cadastrado"
        lembrete.save(
            update_fields=[
                "whatsapp_status",
                "whatsapp_disparado_em",
                "whatsapp_tentativas",
                "whatsapp_ultimo_erro",
            ]
        )
        return {"status": "skipped", "reason": "sem telefone"}

    data_fmt = lembrete.data_lembrete.strftime("%d/%m/%Y")

    try:
        # resp = _send_whatsapp_template(
        #     to_e164=paciente.telefone,
        #     template_name="utilidade_1",  # ajuste para o template real
        #     lang="en_US",
        #     variables=[paciente.nome, data_fmt],
        # )
        resp = _send_whatsapp_mensage(
            to_e164="5585999012483",
            body="teste_via_python",
        )

    except Exception as exc:
        lembrete.whatsapp_status = Lembrete.WhatsappStatus.ERRO
        lembrete.whatsapp_disparado_em = agora
        lembrete.whatsapp_tentativas += 1
        lembrete.whatsapp_ultimo_erro = str(exc)
        lembrete.save(
            update_fields=[
                "whatsapp_status",
                "whatsapp_disparado_em",
                "whatsapp_tentativas",
                "whatsapp_ultimo_erro",
            ]
        )
        logger.exception("Erro ao disparar WhatsApp para %s", paciente.nome)
        raise

    with transaction.atomic():
        lembrete.whatsapp_status = Lembrete.WhatsappStatus.ENVIADO
        lembrete.whatsapp_disparado_em = agora
        lembrete.whatsapp_tentativas += 1
        lembrete.whatsapp_ultimo_erro = ""
        lembrete.save(
            update_fields=[
                "whatsapp_status",
                "whatsapp_disparado_em",
                "whatsapp_tentativas",
                "whatsapp_ultimo_erro",
            ]
        )

    return {"status": "sent", "response": resp}

@shared_task
def disparar_whatsapp_programados() -> dict[str, Any]:
    """
    Executa periodicamente (configurado em CELERY_BEAT_SCHEDULE) e enfileira
    lembretes pendentes cuja data de disparo já chegou.
    """
    hoje = timezone.localdate()
    pendentes = (
        Lembrete.objects.filter(
            data_lembrete__lte=hoje,
            whatsapp_status=Lembrete.WhatsappStatus.PENDENTE,
            paciente__lembretes_ativos=True,
            paciente__ativo=True,
        ).values_list("pk", flat=True)
    )

    for lembrete_id in pendentes:
        enviar_whatsapp_lembrete.delay(lembrete_id)

    count = len(pendentes)
    logger.info("Enfileirados %s lembretes para disparo", count)
    return {"scheduled": count}
