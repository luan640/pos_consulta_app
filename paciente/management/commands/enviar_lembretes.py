from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from paciente.models import Lembrete
import requests

def send_whatsapp_template(to_e164: str, template_name: str, lang: str, variables: list[str]) -> dict:
    url = f"https://graph.facebook.com/v22.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json"
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
                    "parameters": [{"type": "text", "text": v} for v in variables]
                }
            ]
        }
    }
    r = requests.post(url, headers=headers, json=payload, timeout=15)
    r.raise_for_status()
    return r.json()

class Command(BaseCommand):
    help = "Envia mensagens de lembrete via template utilidade_1 para lembretes com vencimento em 2 dias"

    def handle(self, *args, **kwargs):
        alvo = date.today() + timedelta(days=2)
        lembretes = (
            Lembrete.objects.filter(data_lembrete=alvo, concluido=False)
            .select_related("paciente")
        )

        if not lembretes.exists():
            self.stdout.write(self.style.WARNING("Nenhum lembrete para enviar hoje."))
            return

        for lembrete in lembretes:
            paciente = lembrete.paciente
            if not paciente.telefone:
                self.stdout.write(self.style.ERROR(f"{paciente.nome} sem telefone cadastrado."))
                continue

            data_fmt = lembrete.data_lembrete.strftime("%d/%m/%Y")
            try:
                resp = send_whatsapp_template(
                    to_e164=paciente.telefone,
                    template_name="utilidade_1",
                    lang="en_US",
                    variables=[paciente.nome, data_fmt],
                )
                self.stdout.write(self.style.SUCCESS(
                    f"Enviado para {paciente.nome}: {resp}"
                ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"Erro ao enviar para {paciente.nome}: {e}"
                ))
