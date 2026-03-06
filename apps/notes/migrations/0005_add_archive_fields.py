from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0004_add_tags_with_emotions'),
    ]

    operations = [
        migrations.AddField(
            model_name='note',
            name='is_archived',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='note',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
