import pgvector.django.vector
from django.db import migrations
from pgvector.django import VectorExtension


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0002_initial'),
    ]

    operations = [
        VectorExtension(),
        migrations.AddField(
            model_name='note',
            name='embedding',
            field=pgvector.django.vector.VectorField(blank=True, dimensions=384, null=True),
        ),
    ]
