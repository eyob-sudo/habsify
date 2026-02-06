from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, ProfileViewSet

router = DefaultRouter()
router.register('profile', ProfileViewSet, basename='profile')
router.register('', AuthViewSet, basename='auth-actions')

urlpatterns = router.urls
