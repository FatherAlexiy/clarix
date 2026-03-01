from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
	username = models.CharField(max_length = 150, blank = True, null = True)
	email = models.EmailField(unique = True)

	telegram_id = models.BigIntegerField(null = True, blank = True, unique = True)
	created_at = models.DateTimeField(auto_now_add = True)
	updated_at = models.DateTimeField(auto_now = True)

	USERNAME_FIELD = 'email'
	REQUIRED_FIELDS = ['username']

	def __str__(self):
		return self.email
