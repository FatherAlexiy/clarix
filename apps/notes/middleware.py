from http.cookies import SimpleCookie

from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _get_user(token_key: str):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        token = AccessToken(token_key)
        return User.objects.get(id=token['user_id'])
    except Exception:
        return None  # None = токен был, но невалидный


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        token = self._get_token(scope)
        if token:
            user = await _get_user(token)
            if user is None:
                scope['user'] = AnonymousUser()
                scope['auth_failed'] = True  # токен присутствовал, но невалидный
            else:
                scope['user'] = user
        else:
            scope['user'] = AnonymousUser()
        return await super().__call__(scope, receive, send)

    @staticmethod
    def _get_token(scope) -> str | None:
        headers = dict(scope.get('headers', []))
        cookie_header = headers.get(b'cookie', b'').decode()
        if cookie_header:
            jar = SimpleCookie()
            jar.load(cookie_header)
            morsel = jar.get('access_token')
            if morsel:
                return morsel.value
        return None
