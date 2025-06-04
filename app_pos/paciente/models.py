from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

### Paciente

class Paciente(models.Model):
    nome = models.CharField(max_length=255)
    telefone = models.CharField(max_length=20, null=True, blank=True)
    dono = models.ForeignKey(User, on_delete=models.CASCADE)
    lembretes_ativos = models.BooleanField(default=True)

    def __str__(self):
        return self.nome

### Consulta e contato com o paciente

class Consulta(models.Model):
    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name='consultas')
    data_consulta = models.DateField()

    def __str__(self):
        return f"Consulta de {self.paciente.nome} em {self.data_consulta}"

### Materiais e Anotações

class Material(models.Model):
    descricao = models.CharField(max_length=20, null=True, blank=True)
    dono = models.ForeignKey(User, on_delete=models.CASCADE, related_name='materiais_criados')
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.descricao or 'Sem descrição'}"
    
class RegraLembrete(models.Model):
    nutricionista = models.ForeignKey(User, on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    dias_apos = models.IntegerField(help_text="Dias após o evento para criar o lembrete")
    descricao = models.TextField()
    primeira_consulta = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.nome} ({self.dias_apos} dias)"
    
class Lembrete(models.Model):
    paciente = models.ForeignKey(Paciente, on_delete=models.CASCADE, related_name='lembretes')
    regra = models.ForeignKey(RegraLembrete, on_delete=models.SET_NULL, null=True, blank=True, related_name='lembretes_criados')
    data_lembrete = models.DateField()
    texto = models.TextField()
    concluido = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

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
    tipo = models.CharField(max_length=255, help_text="Ex: Whatsapp, Email, Telefone")
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
