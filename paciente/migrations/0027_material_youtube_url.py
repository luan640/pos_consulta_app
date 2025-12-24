from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('paciente', '0026_material_random_upload'),
    ]

    operations = [
        migrations.AddField(
            model_name='material',
            name='youtube_url',
            field=models.URLField(blank=True, null=True),
        ),
    ]
