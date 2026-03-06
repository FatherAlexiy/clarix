"""
Тесты CRUD-заметок и архивирования:
  GET/POST  /api/notes/
  GET/PATCH/DELETE  /api/notes/<id>/
  POST  /api/notes/<id>/archive/
  POST  /api/notes/<id>/unarchive/

Celery-задачи мокируются через @patch чтобы не обращаться к Groq API.
"""
import pytest
from unittest.mock import patch

from tests.factories import NoteFactory

NOTES_LIST = '/api/notes/'


def note_detail(pk):
    return f'/api/notes/{pk}/'


def note_archive(pk):
    return f'/api/notes/{pk}/archive/'


def note_unarchive(pk):
    return f'/api/notes/{pk}/unarchive/'


def mock_ai_tasks(fn):
    fn = patch('apps.notes.views.generate_embedding')(fn)
    fn = patch('apps.notes.views.generate_tags')(fn)
    fn = patch('apps.notes.views.generate_summary')(fn)
    return fn


# ─── Создание заметки ─────────────────────────────────────────────────────────

@pytest.mark.django_db
@mock_ai_tasks
def test_create_note_authenticated_returns_201(
    mock_embedding, mock_tags, mock_summary, auth_client
):
    """Создание заметки авторизованным пользователем - 201, задачи запущены."""
    payload = {'title': 'Тестовая заметка', 'content': 'Содержимое заметки для теста.'}
    response = auth_client.post(NOTES_LIST, payload)

    assert response.status_code == 201
    assert response.data['title'] == payload['title']
    # Celery-задачи должны быть вызваны ровно по одному разу
    mock_summary.delay.assert_called_once()
    mock_tags.delay.assert_called_once()
    mock_embedding.delay.assert_called_once()


@pytest.mark.django_db
def test_create_note_unauthenticated_returns_401(api_client):
    """Создание заметки без токена - 401."""
    response = api_client.post(NOTES_LIST, {'title': 'X', 'content': 'Y'})
    assert response.status_code == 401


# ─── Список заметок ───────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_list_notes_returns_only_own_notes(auth_client, user, other_user):
    """
    Пользователь видит только свои заметки.
    Заметки другого пользователя не попадают в ответ.
    """
    NoteFactory(user=user)
    NoteFactory(user=user)
    NoteFactory(user=other_user)   # чужая - не должна попасть в ответ

    response = auth_client.get(NOTES_LIST)

    assert response.status_code == 200
    results = response.data.get('results', response.data)
    assert len(results) == 2


# ─── Получение чужой заметки ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_retrieve_other_user_note_returns_404(auth_client, other_user):
    """Попытка получить заметку другого пользователя - 404 (не 403, чтобы не раскрывать факт существования)."""
    other_note = NoteFactory(user=other_user)

    response = auth_client.get(note_detail(other_note.id))

    assert response.status_code == 404


# ─── Обновление заметки ───────────────────────────────────────────────────────

@pytest.mark.django_db
@mock_ai_tasks
def test_update_own_note_returns_200(
    mock_embedding, mock_tags, mock_summary, auth_client, user
):
    """PATCH своей заметки с новым содержимым - 200, данные обновлены, задачи перезапущены."""
    note = NoteFactory(user=user, content='Старое содержимое')

    response = auth_client.patch(note_detail(note.id), {
        'title':   'Новый заголовок',
        'content': 'Новое содержимое, которое отличается от старого.',
    })

    assert response.status_code == 200
    assert response.data['title'] == 'Новый заголовок'
    # Содержимое изменилось - AI-задачи перезапускаются
    mock_summary.delay.assert_called_once()
    mock_tags.delay.assert_called_once()
    mock_embedding.delay.assert_called_once()


# ─── Удаление заметки ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_delete_own_note_returns_204(auth_client, user):
    """DELETE своей заметки - 204, запись удалена из БД."""
    note = NoteFactory(user=user)

    response = auth_client.delete(note_detail(note.id))

    assert response.status_code == 204

    # Повторный GET должен вернуть 404
    response2 = auth_client.get(note_detail(note.id))
    assert response2.status_code == 404


# ─── Архивирование ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_archive_note_returns_200_and_is_archived_true(auth_client, user):
    """POST /archive/ - 200, поле is_archived = True."""
    note = NoteFactory(user=user)

    response = auth_client.post(note_archive(note.id))

    assert response.status_code == 200
    assert response.data['is_archived'] is True
    assert response.data['archived_at'] is not None


@pytest.mark.django_db
def test_archived_note_excluded_from_default_list(auth_client, user):
    """
    Архивная заметка не появляется в основном списке GET /api/notes/.
    В основном списке - только неархивные.
    """
    NoteFactory(user=user, is_archived=True)   # архивная — не должна попасть
    NoteFactory(user=user, is_archived=False)  # обычная — должна попасть

    response = auth_client.get(NOTES_LIST)

    assert response.status_code == 200
    results = response.data.get('results', response.data)
    assert len(results) == 1
    assert results[0]['is_archived'] is False


# ─── Восстановление из архива ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_unarchive_note_returns_200_and_is_archived_false(auth_client, user):
    """POST /unarchive/ - 200, поле is_archived = False."""
    note = NoteFactory(user=user, is_archived=True)

    response = auth_client.post(note_unarchive(note.id))

    assert response.status_code == 200
    assert response.data['is_archived'] is False
    assert response.data['archived_at'] is None
