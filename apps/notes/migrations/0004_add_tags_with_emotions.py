from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0003_add_embedding_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='note',
            name='tags_with_emotions',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
