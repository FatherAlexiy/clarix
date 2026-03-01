from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
	password = serializers.CharField(write_only = True, min_length = 8)

	class Meta:
		model = User
		fields = ('email', 'username', 'password')

	def create(self, validated_data):
		user = User.objects.create_user(
			email = validated_data['email'],
			username = validated_data.get('username', ''),
			password = validated_data['password']
		)
		return user


class UserSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ('id', 'email', 'username', 'telegram_id', 'created_at')
		read_only_fields = ('id', 'created_at')
