from rest_framework import viewsets,mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import OrderingFilter, SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from crm.permissions import HasActiveSubscription
from .models import Notification
from .serializers import NotificationSerializer
from .pagination import NotificationPagination
from .filters import NotificationFilter


class NotificationViewSet(mixins.ListModelMixin,mixins.RetrieveModelMixin,viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, HasActiveSubscription]
    filter_backends = [OrderingFilter, SearchFilter,DjangoFilterBackend]
    filterset_class = NotificationFilter
    search_fields = ["message"]
    ordering_fields = ["created_at"]
    ordering = ["is_read", "-created_at"]
    pagination_class = NotificationPagination 

    def get_queryset(self):
        user = self.request.user
        if user.role == "super_admin":
            return Notification.objects.all()
        return Notification.objects.filter(company=user.company, user=user)
    
    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            company=self.request.user.company
        )

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({"detail": "marked as read"},status=200)

    @action(detail=False, methods=["get"])
    def unread(self, request):
        qs = self.filter_queryset(self.get_queryset().filter(is_read=False))
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = self.get_serializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    
    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        qs = self.get_queryset().filter(is_read=False)
        return Response({"unread_count": qs.count()})