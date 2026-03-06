from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notes', '0005_add_archive_fields'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='note',
            index=models.Index(fields=['user', '-created_at'], name='notes_note_user_created_idx'),
        ),
        migrations.AddIndex(
            model_name='note',
            index=models.Index(fields=['public_token'], name='notes_note_public_token_idx'),
        ),
        migrations.AddIndex(
            model_name='note',
            index=models.Index(fields=['user', 'is_archived'], name='notes_note_user_archived_idx'),
        ),
    ]
