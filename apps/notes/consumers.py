import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class NoteConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            user = self.scope.get('user')
            if user is None or not user.is_authenticated:
                logger.warning('WS rejected: unauthenticated (auth_failed=%s)', self.scope.get('auth_failed', False))
                await self.close(code=4001)
                return
            self.group_name = f'user_{user.id}'
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.info('WS connected: user=%s group=%s', user.id, self.group_name)
        except Exception:
            logger.exception('WS connect error')
            raise

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def note_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'note_updated',
            'note_id': event['note_id'],
            'note_title': event.get('note_title', ''),
            'ai_status': event['ai_status'],
            'summary': event['summary'],
            'tags': event['tags'],
            'tags_with_emotions': event.get('tags_with_emotions', []),
        }))
