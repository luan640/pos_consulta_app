from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('paciente', '0024_perfil_usuario'),
    ]

    operations = [
        migrations.DeleteModel(
            name='PerfilUsuario',
        ),
    ]
