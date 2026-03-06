"""
Тесты авторизации:
  POST /api/auth/register/  — регистрация
  POST /api/auth/login/     — вход (JWT в cookie)
  GET  /api/auth/me/        — профиль текущего пользователя
"""
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()

REGISTER = '/api/auth/register/'
LOGIN    = '/api/auth/login/'
ME       = '/api/auth/me/'


# ─── Регистрация ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_register_valid_data_returns_201(api_client):
    """Регистрация с корректными данными - 201, пользователь создан."""
    payload = {
        'email':    'newuser@example.com',
        'username': 'newuser',
        'password': 'StrongPass1',
    }
    response = api_client.post(REGISTER, payload)

    assert response.status_code == 201
    assert User.objects.filter(email='newuser@example.com').exists()


@pytest.mark.django_db
def test_register_existing_email_returns_400(api_client, user):
    """Регистрация с уже занятым email - 400."""
    payload = {
        'email':    user.email,   # этот email уже в базе
        'username': 'anotheruser',
        'password': 'StrongPass1',
    }
    response = api_client.post(REGISTER, payload)

    assert response.status_code == 400


# ─── Логин ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_login_valid_credentials_returns_200_with_cookies(api_client, user):
    """Вход с правильными данными - 200, cookie access_token и refresh_token установлены."""
    response = api_client.post(LOGIN, {
        'email':    user.email,
        'password': 'testpass123',
    })

    assert response.status_code == 200
    # Токены передаются через httpOnly-cookie
    assert 'access_token' in response.cookies
    assert 'refresh_token' in response.cookies
    # Cookie не пустые
    assert response.cookies['access_token'].value
    assert response.cookies['refresh_token'].value


@pytest.mark.django_db
def test_login_wrong_password_returns_401(api_client, user):
    """Вход с неверным паролем - 401."""
    response = api_client.post(LOGIN, {
        'email':    user.email,
        'password': 'WrongPassword!',
    })

    assert response.status_code == 401


# ─── Профиль /me/ ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_me_with_valid_token_returns_200_and_user_data(auth_client, user):
    """GET /api/auth/me/ с токеном - 200 и данные пользователя."""
    response = auth_client.get(ME)

    assert response.status_code == 200
    assert response.data['email'] == user.email
    # Пароль не должен утекать в ответе
    assert 'password' not in response.data


@pytest.mark.django_db
def test_me_without_token_returns_401(api_client):
    """GET /api/auth/me/ без токена - 401."""
    response = api_client.get(ME)

    assert response.status_code == 401
