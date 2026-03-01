from rest_framework import serializers
from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = [
            'id', 'user', 'title', 'content', 'summary', 'tags', 'tags_with_emotions',
            'ai_status', 'is_public', 'public_token', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'summary', 'tags', 'tags_with_emotions', 'ai_status', 'public_token', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
