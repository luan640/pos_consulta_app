from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('paciente', '0028_alter_material_tipo_arquivo'),
    ]

    operations = [
        migrations.AddField(
            model_name='material',
            name='ativo',
            field=models.BooleanField(default=True),
        ),
    ]
