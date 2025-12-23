from django.db import migrations, models
import users.models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_perfilusuario'),
    ]

    operations = [
        migrations.AlterField(
            model_name='perfilusuario',
            name='foto',
            field=models.ImageField(blank=True, null=True, upload_to=users.models.gerar_nome_arquivo_perfil),
        ),
    ]
