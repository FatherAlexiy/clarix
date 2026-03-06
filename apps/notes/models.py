import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.conf import settings
from pgvector.django import VectorField


class Note(models.Model):
    class AIStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        DONE = 'done', 'Done'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notes')
    title = models.CharField(max_length=255)
    content = models.TextField()
    summary = models.TextField(null=True, blank=True)
    tags = ArrayField(
        base_field=models.CharField(max_length=50),
        default=list,
        blank=True,
        size=10
    )
    ai_status = models.CharField(
        max_length=20,
        choices=AIStatus.choices,
        default=AIStatus.PENDING
    )
    tags_with_emotions = models.JSONField(default=list, blank=True)
    embedding = VectorField(dimensions=384, null=True, blank=True)
    is_public = models.BooleanField(default=False)
    public_token = models.UUIDField(default=uuid.uuid4, unique=True, null=True, blank=True)
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['public_token']),
            models.Index(fields=['user', 'is_archived']),
        ]

    def __str__(self):
        return self.title
