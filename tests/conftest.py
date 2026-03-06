import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from tests.factories import UserFactory, NoteFactory


# ─── HTTP clients ─────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    """Неаутентифицированный API-клиент."""
    return APIClient()


@pytest.fixture
def auth_client(user):
    """APIClient с cookie access_token для пользователя `user`."""
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.cookies['access_token'] = str(token.access_token)
    return client


@pytest.fixture
def other_auth_client(other_user):
    """APIClient с cookie access_token для пользователя `other_user`."""
    client = APIClient()
    token = RefreshToken.for_user(other_user)
    client.cookies['access_token'] = str(token.access_token)
    return client


# ─── Users ────────────────────────────────────────────────────────────────────

@pytest.fixture
def user(db):
    """Обычный аутентифицированный пользователь."""
    return UserFactory()


@pytest.fixture
def other_user(db):
    """Второй пользователь — для тестирования изоляции данных."""
    return UserFactory()


# ─── Notes ────────────────────────────────────────────────────────────────────

@pytest.fixture
def note(user):
    """Заметка, принадлежащая `user` (создаётся через ORM, без Celery)."""
    return NoteFactory(user=user)
