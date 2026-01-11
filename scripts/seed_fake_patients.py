"""
Script para popular 50 pacientes de teste.

Uso:
    python manage.py shell < scripts/seed_fake_patients.py

Ou, se preferir executar diretamente:
    python scripts/seed_fake_patients.py
"""
import os
import random
import sys
from pathlib import Path

import django


def configurar_django():
    base_dir = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(base_dir))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app_pos.settings")
    django.setup()


def gerar_telefone():
    # Formato básico brasileiro: DDD (11) + 9 dígitos iniciando em 9
    ddd = random.choice(["11", "21", "31", "41", "51"])
    resto = f"9{random.randint(10000000, 99999999)}"
    return f"{ddd}{resto}"


def main():
    configurar_django()
    from django.contrib.auth import get_user_model
    from paciente.models import Paciente

    User = get_user_model()
    usuario = User.objects.first()
    if not usuario:
        print("Nenhum usuário encontrado. Crie um usuário antes de rodar o script.")
        sys.exit(1)

    criados = 0
    for i in range(1, 51):
        nome = f"Paciente Teste {i:02d}"
        telefone = gerar_telefone()
        _, created = Paciente.objects.update_or_create(
            nome=nome,
            dono=usuario,
            defaults={
                "telefone": telefone,
                "lembretes_ativos": True,
                "ativo": True,
            },
        )
        if created:
            criados += 1

    print(f"Pacientes criados ou atualizados: 50 (novos: {criados}).")


if __name__ == "__main__":
    main()
