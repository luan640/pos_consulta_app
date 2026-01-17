from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("paciente", "0031_grupolembrete_acao_final_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="paciente",
            name="data_inicio_contagem",
            field=models.DateField(
                blank=True,
                help_text="Quando o paciente deve começar a contagem do fluxo de lembretes (base para o 1º lembrete ao atribuir grupo).",
                null=True,
            ),
        ),
    ]

