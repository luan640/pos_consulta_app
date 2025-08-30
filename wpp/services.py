# services.py
import requests
from django.conf import settings

def wpp_send_template(to_e164: str,
                      template_name: str = "hello_world",
                      lang: str | None = None) -> dict:
    """
    Envia um template (sem variáveis) para um destinatário E.164 (sem '+').
    """
    phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
    access_token    = settings.WHATSAPP_ACCESS_TOKEN
    lang_code       = (lang or getattr(settings, "WHATSAPP_TEMPLATE_LANG", "en_US"))

    url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_e164,               # ex.: 5585987654321 (sem '+')
        "type": "template",
        "template": {
            "name": template_name,   # "hello_world"
            "language": {"code": lang_code}
        },
    }
    r = requests.post(url, headers=headers, json=payload, timeout=15)
    r.raise_for_status()
    return r.json()
