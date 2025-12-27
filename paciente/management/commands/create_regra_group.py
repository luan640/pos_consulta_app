from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth import get_user_model

from paciente.models import GrupoLembrete, RegraLembrete, Material
from paciente.regra_templates import DEFAULT_GROUP_TEMPLATES


class Command(BaseCommand):
    help = "Cria um grupo de regras padrao para um usuario."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Email do usuario dono do grupo.")
        parser.add_argument(
            "--group-name",
            default="Pos-consulta - Reeducacao 30 dias",
            help="Nome do grupo de regras.",
        )
        parser.add_argument(
            "--descricao",
            default="Sequencia de acompanhamento pos-consulta para 30 dias",
            help="Descricao do grupo.",
        )
        parser.add_argument(
            "--skip-materials",
            action="store_true",
            help="Nao vincula materiais as regras.",
        )
        parser.add_argument(
            "--template",
            choices=["reeducacao", "ganho-massa", "retorno"],
            default="reeducacao",
            help="Template de regras a ser usado.",
        )

    def handle(self, *args, **options):
        email = options["email"]
        group_name = options["group_name"]
        descricao = options["descricao"]
        skip_materials = options["skip_materials"]
        template = options["template"]

        User = get_user_model()
        user = User.objects.filter(email=email).first()
        if not user:
            raise CommandError("Usuario nao encontrado para o email informado.")

        materiais = []
        if not skip_materials:
            materiais = list(Material.objects.filter(dono=user).order_by("id"))

        templates = {
            "reeducacao": DEFAULT_GROUP_TEMPLATES[0],
            "ganho-massa": DEFAULT_GROUP_TEMPLATES[1],
            "retorno": DEFAULT_GROUP_TEMPLATES[2],
        }
        regras_base = templates[template]["regras"]

        with transaction.atomic():
            grupo = GrupoLembrete.objects.create(
                dono=user,
                nome=group_name,
                descricao=descricao,
            )

            for idx, (nome, dias, desc) in enumerate(regras_base, start=1):
                regra = RegraLembrete.objects.create(
                    nutricionista=user,
                    nome=nome,
                    dias_apos=dias,
                    descricao=desc,
                    ordem=idx,
                    grupo=grupo,
                )
                if materiais:
                    material = materiais[(idx - 1) % len(materiais)]
                    regra.materiais.add(material)

        self.stdout.write(self.style.SUCCESS(f"Grupo criado: {grupo.id}"))
        if not materiais and not skip_materials:
            self.stdout.write(self.style.WARNING("Nenhum material encontrado para vincular."))
