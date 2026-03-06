from django.utils import timezone
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db.models import Func, Value, TextField
from pgvector.django import L2Distance

from .models import Note
from .serializers import NoteSerializer
from .tasks import generate_summary, generate_tags, generate_embedding


class _ArrayToString(Func):
    function = 'array_to_string'
    output_field = TextField()


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_public', 'ai_status']
    search_fields = ['title', 'content', 'summary']
    ordering_fields = ['created_at', 'updated_at', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Note.objects.filter(user=self.request.user).select_related('user')
        if self.action == 'list':
            archived = self.request.query_params.get('archived', 'false').lower()
            if archived == 'true':
                return qs.filter(is_archived=True)
            return qs.filter(is_archived=False)
        return qs

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        search = self.request.query_params.get('search', '').strip()
        if search:
            archived = self.request.query_params.get('archived', 'false').lower() == 'true'
            tag_qs = (
                Note.objects
                .filter(user=self.request.user, is_archived=archived)
                .select_related('user')
                .annotate(_tags_str=_ArrayToString('tags', Value(',')))
                .filter(_tags_str__icontains=search)
            )
            qs = (qs | tag_qs).distinct()
        return qs

    def perform_create(self, serializer):
        note = serializer.save(user=self.request.user)
        generate_summary.delay(str(note.id))
        generate_tags.delay(str(note.id))
        generate_embedding.delay(str(note.id))

    def perform_update(self, serializer):
        old_content = serializer.instance.content
        note = serializer.save()
        if note.content != old_content:
            note.ai_status = Note.AIStatus.PENDING
            note.save(update_fields=['ai_status'])
            generate_summary.delay(str(note.id))
            generate_tags.delay(str(note.id))
            generate_embedding.delay(str(note.id))

    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    # POST /api/notes/{id}/archive/
    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        note = self.get_object()
        note.is_archived = True
        note.archived_at = timezone.now()
        note.save(update_fields=['is_archived', 'archived_at'])
        return Response(self.get_serializer(note).data)

    # POST /api/notes/{id}/unarchive/
    @action(detail=True, methods=['post'], url_path='unarchive')
    def unarchive(self, request, pk=None):
        note = self.get_object()
        note.is_archived = False
        note.archived_at = None
        note.save(update_fields=['is_archived', 'archived_at'])
        return Response(self.get_serializer(note).data)

    # POST /api/notes/{id}/generate_summary/
    @action(detail=True, methods=['post'], url_path='generate_summary')
    def generate_summary_action(self, request, pk=None):
        note = self.get_object()
        if note.ai_status == Note.AIStatus.PROCESSING:
            return Response(
                {'detail': 'Заметка уже обрабатывается'},
                status=status.HTTP_409_CONFLICT,
            )
        note.ai_status = Note.AIStatus.PENDING
        note.save(update_fields=['ai_status'])
        generate_summary.delay(str(note.id))
        generate_tags.delay(str(note.id))
        generate_embedding.delay(str(note.id))
        return Response(self.get_serializer(note).data)

    # GET /api/notes/search/?q=текст
    @action(detail=False, methods=['get'], url_path='search')
    def search(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response({'detail': 'Параметр q обязателен'}, status=status.HTTP_400_BAD_REQUEST)
        from .embeddings import get_embedding
        query_vector = get_embedding(q)
        notes = (
            Note.objects
            .filter(user=request.user, embedding__isnull=False, is_archived=False)
            .select_related('user')
            .order_by(L2Distance('embedding', query_vector))[:10]
        )
        return Response(self.get_serializer(notes, many=True).data)

    # GET /api/notes/public/{token}/
    @action(
        detail=False,
        methods=['get'],
        url_path='public/(?P<token>[^/.]+)',
        permission_classes=[permissions.AllowAny],
    )
    def public_view(self, request, token=None):
        note = get_object_or_404(Note, public_token=token, is_public=True)
        return Response(self.get_serializer(note).data)
