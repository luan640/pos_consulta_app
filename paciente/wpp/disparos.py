import requests

# Regra 1: Após registrar o contato, verificar se o próximo contato é < 1 dia, se for, enviar lembrete.
# Regra 2: Script para rodar todos os dias as 07:00 e varrer tudo que tem para vencer 1 dia antes.

def verifica_dias():

    "Verifica se o lembrete do paciente está faltando 1 dia para vencer"
    "return: Str (atrasado ou em_dia)"
    "Se está a 1 dia para vencer = 'em_dia' se está a 5 dias vencido = 'atrasado' "

    return "atrasado"

def verifica_disparo_ativo():

    "Verifica se o nutricionista tem a flag de disparo ativo"

    return True

def acao_lembrete():

    "Busca a ação para aquele lembrete daquele paciente"

    return "Entrar em contato com o paciente"

def enviar_lembrete_paciente(
        situacao_dia = 'em_dia',
        nome_paciente = 'LUAN ARAÚJO',
        telefone_paciente = '5585999012483',
        telefone_nutricionista = '5585999012483',
        acao = "Enviar boas vindas"
    ):

    # criar mensagem

    situacao_dia = 'em_dia'
    nome_paciente = 'LUAN ARAÚJO'
    telefone_paciente = '5585999012483'
    telefone_nutricionista = '5585999012483'
    acao = "Enviar boas vindas"

    status_txt = (
        "vence em 1 dia."
        if situacao_dia != "atrasado"
        else "venceu há 5 dias."
    )

    mensagem = (
        "Olá, você tem alguns lembretes para hoje.\n"
        f"Entre em contato com o paciente *{nome_paciente}* e envie os materiais:\n"
        f"Ação: {acao}\n\n"
        f"O contato desse paciente {status_txt}\n"
        f"Clique aqui para ir ao WhatsApp https://wa.me/{telefone_paciente}"
    )

    # enviar 

    requests.post(
        "https://waha.manutencaocemag.com.br/enviar",
        json={"telefone": f"{telefone_nutricionista}", "mensagem": mensagem}
    )
