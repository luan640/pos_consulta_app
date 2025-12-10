from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

### Paciente

class Paciente(models.Model):
    nome = models.CharField(max_length=255)
    telefone = models.CharField(max_length=20, null=True, blank=True)
    dono = models.ForeignKey(User, on_delete=models.CASCADE)
    lembretes_ativos = models.BooleanField(default=True)
    ativo = models.BooleanField(default=True)
    grupo_lembrete = models.ForeignKey('GrupoLembrete', blank=True, null=True, on_delete=models.CASCADE, related_name='grupo_paciente')
    created_at = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    def __str__(self):
        return self.nome

### Consulta e contato com o paciente

class Consulta(models.Model):
    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name='consultas')
    data_consulta = models.DateField()
    tipo_consulta = models.CharField(max_length=100, help_text="Ex: Consulta, Retorno", default='consulta')
    created_at = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    def __str__(self):
        return f"Consulta de {self.paciente.nome} em {self.data_consulta}"

### Materiais e Anotações

class Material(models.Model):
    descricao = models.CharField(max_length=100, null=True, blank=True)
    dono = models.ForeignKey(User, on_delete=models.CASCADE, related_name='materiais_criados')
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.descricao or 'Sem descrição'}"

class GrupoLembrete(models.Model):
    dono = models.ForeignKey(User, on_delete=models.CASCADE, related_name='grupos_lembrete')
    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    def __str__(self):
        return self.nome

class RegraLembrete(models.Model):
    nutricionista = models.ForeignKey(User, on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    dias_apos = models.IntegerField(help_text="Dias após o evento para criar o lembrete")
    descricao = models.TextField()
    ordem = models.IntegerField(help_text="Ordem de prioridade para a regra")
    grupo = models.ForeignKey(GrupoLembrete, on_delete=models.SET_NULL, related_name='regras', null=True)
    created_at = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    materiais = models.ManyToManyField(
        Material,
        related_name='regras',  # permite material.regras.all()
        blank=True
    )

    def __str__(self):
        return f"{self.nome} ({self.dias_apos} dias)"
    
class Lembrete(models.Model):
    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name='lembretes')
    regra = models.ForeignKey(RegraLembrete, on_delete=models.SET_NULL, null=True, blank=True, related_name='lembretes_criados')
    data_lembrete = models.DateField()
    texto = models.TextField()
    concluido = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    contato_em = models.DateField(null=True, blank=True)

    class WhatsappStatus(models.TextChoices):
        PENDENTE = ("pendente", "Pendente")
        ENVIADO = ("enviado", "Enviado")
        ERRO = ("erro", "Erro")
        SEM_TELEFONE = ("sem_telefone", "Sem telefone")

    whatsapp_status = models.CharField(
        max_length=20,
        choices=WhatsappStatus.choices,
        default=WhatsappStatus.PENDENTE,
    )
    whatsapp_disparado_em = models.DateTimeField(null=True, blank=True)
    whatsapp_tentativas = models.PositiveIntegerField(default=0)
    whatsapp_ultimo_erro = models.TextField(blank=True)

    # NOVOS CAMPOS RELACIONADOS AO WHATSAPP / WEBHOOK
    # ID da mensagem no WhatsApp (wamid...)
    whatsapp_message_id = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        help_text="ID da mensagem retornado pela API do WhatsApp (messages[0].id).",
    )

    # Quando houve alguma resposta / interação relevante
    whatsapp_respondido_em = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Data/hora em que o paciente respondeu ou interagiu pela primeira vez.",
    )

    # ID da resposta (por ex: ID do botão clicado)
    whatsapp_resposta_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="ID da resposta/interação (ex: button_reply.id).",
    )

    # Texto da resposta (título do botão ou mensagem digitada)
    whatsapp_resposta_texto = models.TextField(
        blank=True,
        help_text="Conteúdo da resposta (ex: título do botão ou mensagem de texto).",
    )

    tipo_mensagem = models.CharField(max_length=50, null=True, blank=True) # livre ou template (free ou paga)

    enviado_para = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return f"Lembrete para {self.paciente.nome} em {self.data_lembrete}"

class MaterialEnviado(models.Model):
    lembrete = models.ForeignKey(Lembrete, on_delete=models.CASCADE, related_name='material_lembrete')
    anotacao = models.ForeignKey('AnotacaoContato', on_delete=models.CASCADE, related_name='materiais_enviados')
    nome_material = models.CharField(max_length=255)
    enviado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nome_material} enviado em {self.enviado_em.date()}"

class ContatoNutricionista(models.Model):
    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name='contatos')
    data_contato = models.DateField()
    tipo = models.CharField(max_length=255, help_text="Ex: Whatsapp, Email, Telefone", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.paciente.nome} - {self.data_contato}"

class AnotacaoContato(models.Model):
    contato = models.ForeignKey(ContatoNutricionista, on_delete=models.CASCADE, related_name='anotacoes')
    texto = models.TextField()
    material_enviado = models.ManyToManyField(Material, blank=True, related_name='materiais_enviados')
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Anotação para {self.contato.paciente.nome} em {self.contato.data_contato}"

class InteracaoWhatsapp(models.Model):
    
    criado_em = models.DateTimeField(auto_now_add=True)  # data/hora da interação
    telefone = models.CharField(max_length=20)           # ex: 5585999012345
    mensagem = models.TextField()                        # conteúdo da msg
