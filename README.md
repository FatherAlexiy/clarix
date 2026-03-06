# Clarix

[![CI](https://github.com/FatherAlexiy/clarix/actions/workflows/ci.yml/badge.svg)](https://github.com/FatherAlexiy/clarix/actions/workflows/ci.yml)

Clarix - умный блокнот с ИИ-обработкой заметок: автоматически генерирует саммари, теги с эмоциональной окраской и векторные эмбеддинги для семантического поиска. Работает на Django + Channels (WebSocket) + Celery + Groq LLM.

---

## Как запустить локально

### Вариант 1 — Docker (рекомендуется)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/FatherAlexiy/clarix.git
cd clarix

# 2. Создать .env из примера и заполнить переменные
cp .env.example .env

# 3. Запустить все сервисы
docker-compose up --build
```

Приложение будет доступно на `http://localhost:8000`

---

### Вариант 2 — Без Docker

**Требования:** Python 3.12, PostgreSQL 16 с расширением pgvector, Redis

```bash
# 1. Создать и активировать виртуальное окружение
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# 2. Установить зависимости
pip install -r requirements.txt

# 3. Создать .env из примера и заполнить переменные
cp .env.example .env

# 4. Запустить PostgreSQL и Redis
#    (или только их через Docker)
docker-compose up -d db redis

# 5. Применить миграции
python manage.py migrate

# 6. Запустить сервер (в отдельном терминале)
daphne -p 8000 config.asgi:application

# 7. Запустить Celery (в отдельном терминале)
celery -A config worker --loglevel=info --pool=solo

# 8. Запустить Redis через WSL (если установлен там)
wsl sudo service redis-server start
```

---

## Переменные окружения

Скопируй `.env.example` в `.env` и заполни значения:

| Переменная | Обязательная | Описание | Пример |
|---|---|---|---|
| `SECRET_KEY` | Да | Django secret key — длинная случайная строка | `django-insecure-...` |
| `DEBUG` | Нет | Режим отладки. `False` в продакшне | `True` |
| `DATABASE_URL` | Да | Строка подключения к PostgreSQL | `postgresql://user:pass@localhost:5432/clarix` |
| `ALLOWED_HOSTS` | Да | Список разрешённых хостов через запятую | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | Нет | Разрешённые origins для CORS | `http://localhost:3000` |
| `REDIS_URL` | Да | URL подключения к Redis | `redis://localhost:6379/0` |
| `GROQ_API_KEY` | Да | API ключ Groq для LLM | `gsk_...` |
| `GROQ_MODEL` | Нет | Модель Groq для генерации | `llama-3.3-70b-versatile` |

Получить `GROQ_API_KEY` можно бесплатно на [console.groq.com](https://console.groq.com)

---

## Стек

- **Backend:** Django 5, Django REST Framework, SimpleJWT (httpOnly cookies)
- **Realtime:** Django Channels, Daphne (ASGI), WebSocket
- **AI:** Groq LLM (саммари и теги), sentence-transformers (эмбеддинги)
- **БД:** PostgreSQL + pgvector (векторный поиск)
- **Очереди:** Celery + Redis
- **Контейнеризация:** Docker + docker-compose
