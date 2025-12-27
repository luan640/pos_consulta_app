from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from paciente.models import GrupoLembrete, RegraLembrete
from paciente.regra_templates import DEFAULT_GROUP_TEMPLATES
from .models import CustomUser


@receiver(post_save, sender=CustomUser)
def criar_grupos_padrao(sender, instance, created, **kwargs):
    if not created:
        return

    with transaction.atomic():
        for template in DEFAULT_GROUP_TEMPLATES:
            grupo, created_group = GrupoLembrete.objects.get_or_create(
                dono=instance,
                nome=template["nome"],
                defaults={"descricao": template["descricao"]},
            )

            if not created_group:
                continue

            for idx, (nome, dias, desc) in enumerate(template["regras"], start=1):
                RegraLembrete.objects.create(
                    nutricionista=instance,
                    nome=nome,
                    dias_apos=dias,
                    descricao=desc,
                    ordem=idx,
                    grupo=grupo,
                )
