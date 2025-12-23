from django.db import migrations, models
import paciente.models


class Migration(migrations.Migration):

    dependencies = [
        ('paciente', '0025_remove_perfilusuario'),
    ]

    operations = [
        migrations.AlterField(
            model_name='material',
            name='arquivo_foto',
            field=models.FileField(blank=True, null=True, upload_to=paciente.models.gerar_nome_arquivo_materiais),
        ),
        migrations.AlterField(
            model_name='material',
            name='arquivo_imagem',
            field=models.FileField(blank=True, null=True, upload_to=paciente.models.gerar_nome_arquivo_materiais),
        ),
        migrations.AlterField(
            model_name='material',
            name='arquivo_pdf',
            field=models.FileField(blank=True, null=True, upload_to=paciente.models.gerar_nome_arquivo_materiais),
        ),
        migrations.AlterField(
            model_name='material',
            name='arquivo_video',
            field=models.FileField(blank=True, null=True, upload_to=paciente.models.gerar_nome_arquivo_materiais),
        ),
    ]
