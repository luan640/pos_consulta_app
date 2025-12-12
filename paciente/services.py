# paciente/services.py

from django.utils.timezone import now
from django.utils import timezone
from django.db import transaction

from paciente.models import (
    Paciente,
    RegraLembrete,
    ContatoNutricionista,
    AnotacaoContato,
    Material,
    Lembrete,
    InteracaoWhatsapp
)

from datetime import timedelta
from typing import Optional, Any
import environ
import requests

env = environ.Env()

def registrar_contato_service(
    usuario,
    paciente_id: int,
    tipo_contato: str = None,
    anotacao_texto: str = "",
    materiais: list = None,
):
    """
    Lógica de registrar contato, extraída da view.
    Pode ser usada em views, webhooks, tasks etc.
    """

    materiais = materiais or []

    with transaction.atomic():
        # 1. Validar paciente
        try:
            paciente = Paciente.objects.get(id=paciente_id, dono=usuario)
        except Paciente.DoesNotExist:
            raise ValueError("Paciente não encontrado")

        # 2. Verifica se existe alguma regra
        if not RegraLembrete.objects.filter(nutricionista=usuario).exists():
            raise ValueError("Crie uma regra para registrar contato.")

        # 3. Criar contato
        contato = ContatoNutricionista.objects.create(
            paciente=paciente,
            data_contato=now().date(),
            tipo=tipo_contato,
        )

        # 4. Criar anotação
        anotacao = AnotacaoContato.objects.create(
            contato=contato,
            texto=anotacao_texto,
        )

        # 5. Associar materiais
        for nome in materiais:
            material_obj, _ = Material.objects.get_or_create(
                descricao=nome,
                dono=usuario,
            )
            anotacao.material_enviado.add(material_obj)

        anotacao.save()

        # 6. Marcar lembrete atual como concluído
        lembrete_atual = (
            Lembrete.objects.filter(paciente=paciente, concluido=False)
            .order_by("data_lembrete")
            .first()
        )

        proximo_lembrete_data = None

        if lembrete_atual:
            lembrete_atual.concluido = True
            lembrete_atual.contato_em = now().date()
            lembrete_atual.save()

            # 7. Achar próxima regra
            regra_atual = lembrete_atual.regra
            nova_regra = None

            if regra_atual:
                regras = list(
                    RegraLembrete.objects.filter(
                        nutricionista=usuario,
                        grupo=paciente.grupo_lembrete,
                    ).order_by("ordem")
                )

                regras_por_ordem = {r.ordem: r for r in regras}
                proxima_ordem = regra_atual.ordem + 1

                nova_regra = (
                    regras_por_ordem.get(proxima_ordem, regra_atual)
                )  # se não houver próxima, repete a última

            # 8. Criar novo lembrete
            if nova_regra:
                nova_data = now().date() + timedelta(days=nova_regra.dias_apos)

                if not Lembrete.objects.filter(
                    paciente=paciente,
                    data_lembrete=nova_data,
                    concluido=False,
                ).exists():

                    Lembrete.objects.create(
                        paciente=paciente,
                        regra=nova_regra,
                        data_lembrete=nova_data,
                        texto=nova_regra.descricao,
                        contato_em=None,
                    )

                proximo_lembrete_data = nova_data

        return {
            "mensagem": "Contato registrado com sucesso",
            "proximo_lembrete": (
                proximo_lembrete_data.strftime("%d/%m/%Y")
                if proximo_lembrete_data
                else None
            ),
        }

def verifica_janela_24_hrs(id_nutri: int, tel_nutri: str) -> bool:

    # buscar dentro de paciente.lembrete apenas os pacientes do id_nutri
    # buscar o campo de whatsapp_respondido_em e comparar com hora atual
    
    agora = now()

    ultima_resposta_nutri = (InteracaoWhatsapp.objects
                            .filter(telefone__endswith=tel_nutri[-8:])
                            .order_by("-criado_em").first()
                        )
    
    delta = agora - ultima_resposta_nutri.criado_em

    ja_passou_24h = delta > timedelta(hours=24)

    if ja_passou_24h:
        return True

def _send_whatsapp_template(    
    tel_nutri: Optional[str],
    nome_nutri: Optional[str],
    nome_paciente: Optional[str],
    tel_paciente: Optional[str],
    acao: Optional[str],
    materiais: Optional[list] = None,
    enviado_para= Optional[str],
    lembrete=None,
) -> dict[str, Any]:
    """
    Envia um template do WhatsApp para o profissional (nutri).
    O template deve estar cadastrado no WhatsApp Cloud API com os placeholders
    na mesma ordem das variáveis abaixo.
    """

    if not tel_nutri:
        raise ValueError("tel_nutri é obrigatório para envio do template.")

    # Monta string dos materiais
    if materiais:
        materiais_msg = "; ".join([f"• {m}" for m in materiais])
    else:
        materiais_msg = "Nenhum material necessário."

    # Nome do template cadastrado no Meta
    template_name = "confirmar_contato_com_paciente "

    # Código de idioma do template
    lang = "en_US"

    # ORDEM DOS PLACEHOLDERS DEVE BATER COM O TEMPLATE
    # {{1}} -> nome_nutri ou "Profissional"
    # {{2}} -> nome_paciente
    # {{3}} -> tel_paciente
    # {{4}} -> acao
    # {{5}} -> materiais_msg
    variables = [
        nome_nutri,
        nome_paciente,
        tel_paciente or "Não informado",
        acao or "atendimento",
        materiais_msg,
    ]

    url = f"https://graph.facebook.com/{env('WHATSAPP_VERSION_API')}/{env('WHATSAPP_PHONE_NUMBER_ID')}/messages"

    headers = {
        "Authorization": f"Bearer {env('WHATSAPP_META_API_KEY')}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "to": tel_nutri,
        "type": "template",
        "template": {
            "name": "confirmar_contato_com_paciente",
            "language": { "code": "en_US" },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": nome_nutri},
                        {"type": "text", "text": nome_paciente},
                        {"type": "text", "text": acao},
                        {"type": "text", "text": materiais_msg},
                        {"type": "text", "text": tel_paciente},
                    ]
                }
            ]
        }
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        # Pega o ID da mensagem retornado pelo WhatsApp
        message_id = (
            data.get("messages", [{}])[0].get("id")
            if isinstance(data, dict)
            else None
        )

        # Se tiver um lembrete vinculado, salva as infos nele
        if lembrete is not None:
            lembrete.whatsapp_tentativas += 1
            lembrete.tipo_mensagem = 'paga'
            lembrete.enviado_para = enviado_para

            if message_id:
                lembrete.whatsapp_message_id = message_id
                lembrete.whatsapp_status = Lembrete.WhatsappStatus.ENVIADO
                lembrete.whatsapp_disparado_em = timezone.now()
            else:
                lembrete.whatsapp_status = Lembrete.WhatsappStatus.ERRO
                lembrete.whatsapp_ultimo_erro = "Resposta sem messages[0].id da API"

            lembrete.save()

        return data

    except requests.RequestException as e:
        # Em caso de erro na requisição, também atualiza o lembrete (se existir)
        if lembrete is not None:
            lembrete.whatsapp_tentativas += 1
            lembrete.whatsapp_status = Lembrete.WhatsappStatus.ERRO
            lembrete.whatsapp_ultimo_erro = str(e)
            lembrete.enviado_para = enviado_para

            lembrete.save()

        raise

def _send_whatsapp_message(
    tel_nutri: Optional[str],
    nome_nutri: Optional[str],
    nome_paciente: Optional[str],
    tel_paciente: Optional[str],
    acao: Optional[str],
    materiais: Optional[list],
    enviado_para: Optional[str],
    lembrete: Optional[Lembrete] = None,
) -> dict[str, Any]:
    url = f"https://graph.facebook.com/{env('WHATSAPP_VERSION_API')}/{env('WHATSAPP_PHONE_NUMBER_ID')}/messages"
    headers = {
        "Authorization": f"Bearer {env('WHATSAPP_META_API_KEY')}",
        "Content-Type": "application/json",
    }

    materiais_msg = (
        "\n".join([f"{i+1}. {materiais[i]}" for i in range(len(materiais))])
        if materiais
        else "Sem material para enviar."
    )

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": tel_nutri,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": (
                    f"Olá, *{nome_nutri or 'Profissional'}*! 👋\n"
                    f"Passando aqui só para te lembrar de entrar em contato com o(a) paciente *{nome_paciente}*.\n\n"
                    f"📞 Telefone: *{tel_paciente}*\n\n"
                    f"🩺 Ação necessária: *{acao}*.\n\n"
                    "📄 Materiais para enviar:\n\n"
                    f"{materiais_msg}\n\n"
                    "Se puder mandar mensagem para ele(a) ainda hoje, ótimo! "
                    "Assim mantemos o acompanhamento bem alinhado e contínuo. 💚✨"
                )
            },
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": "BTN_CONFIRMA_ENVIO",
                            "title": "Ok, vou enviar",
                        },
                    }
                ]
            },
        },
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        # Pega o ID da mensagem retornado pelo WhatsApp
        message_id = (
            data.get("messages", [{}])[0].get("id")
            if isinstance(data, dict)
            else None
        )

        # Se tiver um lembrete vinculado, salva as infos nele
        if lembrete is not None:
            lembrete.whatsapp_tentativas += 1
            lembrete.tipo_mensagem = 'gratis'
            lembrete.enviado_para = enviado_para

            if message_id:
                lembrete.whatsapp_message_id = message_id
                lembrete.whatsapp_status = Lembrete.WhatsappStatus.ENVIADO
                lembrete.whatsapp_disparado_em = timezone.now()
            else:
                lembrete.whatsapp_status = Lembrete.WhatsappStatus.ERRO
                lembrete.whatsapp_ultimo_erro = "Resposta sem messages[0].id da API"

            lembrete.save()

        return data

    except requests.RequestException as e:
        # Em caso de erro na requisição, também atualiza o lembrete (se existir)
        if lembrete is not None:
            lembrete.whatsapp_tentativas += 1
            lembrete.whatsapp_status = Lembrete.WhatsappStatus.ERRO
            lembrete.whatsapp_ultimo_erro = str(e)
            lembrete.save()

        raise
