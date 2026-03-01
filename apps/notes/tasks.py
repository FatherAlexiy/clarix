import json
import logging
import random

from celery import shared_task
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from groq import Groq

COLOR_RANGES = {
    'positive':      ['#16a34a', '#15803d', '#047857', '#0e7490', '#0891b2', '#059669', '#10b981', '#34d399'],
    'negative':      ['#dc2626', '#ef4444', '#f87171', '#e11d48', '#f43f5e', '#fb7185', '#e879f9', '#c026d3'],
    'neutral':       ['#3b82f6', '#60a5fa', '#93c5fd', '#38bdf8', '#7dd3fc', '#67e8f9', '#6366f1', '#818cf8'],
    'philosophical': ['#a855f7', '#c084fc', '#d8b4fe', '#e879f9', '#f0abfc', '#8b5cf6', '#7c3aed', '#9333ea'],
}

logger = logging.getLogger(__name__)


def ask_groq(prompt: str) -> str:
    client = Groq(api_key=settings.GROQ_API_KEY)
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.3,
        max_tokens=500,
    )
    return response.choices[0].message.content.strip()


def _notify_user(note):
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_{note.user_id}',
            {
                'type': 'note_updated',
                'note_id': str(note.id),
                'ai_status': note.ai_status,
                'summary': note.summary,
                'tags': note.tags,
                'tags_with_emotions': note.tags_with_emotions,
            },
        )
    except Exception as exc:
        logger.warning('WebSocket notify failed for note %s: %s', note.id, exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_summary(self, note_id: str):
    from .models import Note

    try:
        note = Note.objects.get(id=note_id)
    except Note.DoesNotExist:
        logger.warning('generate_summary: Note %s not found', note_id)
        return

    try:
        note.ai_status = Note.AIStatus.PROCESSING
        note.save(update_fields=['ai_status'])

        prompt = (
            'Analyze the text language and write a summary in THE SAME language as the text.\n'
            'If text is Russian - write in Russian. If English - in English. If German - in German. And so on.\n'
            'Write 2-3 sentences, only the essence, no preamble.\n\n'
            f'Text: {note.content}'
        )
        note.summary = ask_groq(prompt)
        note.ai_status = Note.AIStatus.DONE
        note.save(update_fields=['summary', 'ai_status'])

        _notify_user(note)

    except Exception as exc:
        logger.error('generate_summary failed for %s: %s', note_id, exc)
        try:
            note.ai_status = Note.AIStatus.FAILED
            note.save(update_fields=['ai_status'])
        except Exception:
            pass
        raise self.retry(exc=exc)


@shared_task
def generate_tags(note_id: str):
    from .models import Note

    try:
        note = Note.objects.get(id=note_id)
    except Note.DoesNotExist:
        logger.warning('generate_tags: Note %s not found', note_id)
        return

    response = None
    try:
        prompt = (
            f'Analyze the text and extract 3-5 key tags.\n\n'
            f'For each tag:\n'
            f'1. Determine emotion: positive, negative, neutral, or philosophical\n'
            f'2. Choose a unique hex color from the allowed range for that emotion:\n'
            f'   - positive: {COLOR_RANGES["positive"]}\n'
            f'   - negative: {COLOR_RANGES["negative"]}\n'
            f'   - neutral: {COLOR_RANGES["neutral"]}\n'
            f'   - philosophical: {COLOR_RANGES["philosophical"]}\n'
            f'3. Write the tag in the SAME language as the text '
            f'(if Russian - tags in Russian, if German - tags in German)\n\n'
            f'Return ONLY a JSON array, no explanations, no markdown:\n'
            f'[{{"tag": "example", "emotion": "positive", "color": "#16a34a"}}]\n\n'
            f'Text: {note.content}'
        )
        response = ask_groq(prompt)
        clean = response.strip().replace('```json', '').replace('```', '').strip()
        tags_data = json.loads(clean)

        for item in tags_data:
            emotion = item.get('emotion', 'neutral')
            color = item.get('color', '')
            allowed = COLOR_RANGES.get(emotion, COLOR_RANGES['neutral'])
            if color not in allowed:
                item['color'] = random.choice(allowed)

        note.tags = [item['tag'].lower() for item in tags_data]
        note.tags_with_emotions = tags_data
        note.save(update_fields=['tags', 'tags_with_emotions'])
        _notify_user(note)

    except Exception as exc:
        logger.error('generate_tags failed for %s: %s', note_id, exc)
        try:
            tags = [t.strip().lower() for t in (response or '').split(',') if t.strip()][:5]
            note.tags = tags
            note.tags_with_emotions = []
            note.save(update_fields=['tags', 'tags_with_emotions'])
        except Exception:
            pass


@shared_task
def generate_embedding(note_id: str):
    from .models import Note
    from .embeddings import get_embedding

    try:
        note = Note.objects.get(id=note_id)
    except Note.DoesNotExist:
        logger.warning('generate_embedding: Note %s not found', note_id)
        return

    try:
        tags_str = ' '.join(note.tags) if note.tags else ''
        text = ' '.join(filter(None, [note.title, note.content, note.summary, tags_str]))
        note.embedding = get_embedding(text)
        note.save(update_fields=['embedding'])
    except Exception as exc:
        logger.error('generate_embedding failed for %s: %s', note_id, exc)
