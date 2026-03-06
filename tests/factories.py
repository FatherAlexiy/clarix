import factory
from factory.django import DjangoModelFactory
from faker import Faker
from django.contrib.auth import get_user_model

from apps.notes.models import Note

fake = Faker('en_US')
User = get_user_model()


# ─── Users ────────────────────────────────────────────────────────────────────

class UserFactory(DjangoModelFactory):
    """
    Фабрика кастомного пользователя (CustomUser).
    Логин: email, пароль по умолчанию: 'testpass123'
    """
    class Meta:
        model = User

    email    = factory.LazyAttribute(lambda o: fake.unique.email())
    username = factory.LazyAttribute(lambda o: fake.unique.user_name())
    password = factory.PostGenerationMethodCall('set_password', 'testpass123')


# ─── Notes ────────────────────────────────────────────────────────────────────

class NoteFactory(DjangoModelFactory):
    """
    Фабрика заметки.
    Создаёт запись напрямую в БД — Celery-задачи не вызываются.
    """
    class Meta:
        model = Note

    user              = factory.SubFactory(UserFactory)
    title             = factory.LazyAttribute(lambda o: fake.sentence(nb_words=5))
    content           = factory.LazyAttribute(lambda o: fake.paragraph(nb_sentences=3))
    tags              = factory.LazyFunction(list)
    tags_with_emotions = factory.LazyFunction(list)
    ai_status         = Note.AIStatus.PENDING
    is_archived       = False
    embedding         = None
