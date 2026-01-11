from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
import uuid
import os

def gerar_nome_arquivo(prefixo, filename):
    _, ext = os.path.splitext(filename)
    return f"{prefixo}/{uuid.uuid4().hex[:12]}{ext}"


def gerar_nome_arquivo_perfil(instance, filename):
    return gerar_nome_arquivo('perfil', filename)


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('O e-mail é obrigatório')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # salva hash da senha
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    nome = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    telefone = models.CharField(max_length=20, null=True, blank=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nome']

    def __str__(self):
        return self.email


class PerfilUsuario(models.Model):
    usuario = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='perfil')
    nome = models.CharField(max_length=150, blank=True)
    foto = models.ImageField(upload_to=gerar_nome_arquivo_perfil, null=True, blank=True)
    whatsapp_notificacoes = models.BooleanField(default=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nome or self.usuario.email


class AccessRequest(models.Model):
    nome = models.CharField(max_length=255)
    email = models.EmailField()
    whatsapp = models.CharField(max_length=20)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-criado_em',)
        verbose_name = 'Solicitação de acesso'
        verbose_name_plural = 'Solicitações de acesso'

    def __str__(self):
        return f'{self.nome} ({self.email})'
