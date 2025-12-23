from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_accessrequest'),
    ]

    operations = [
        migrations.CreateModel(
            name='PerfilUsuario',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(blank=True, max_length=150)),
                ('foto', models.ImageField(blank=True, null=True, upload_to='perfil/')),
                ('whatsapp_notificacoes', models.BooleanField(default=True)),
                ('atualizado_em', models.DateTimeField(auto_now=True)),
                ('usuario', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='perfil', to='users.customuser')),
            ],
        ),
    ]
