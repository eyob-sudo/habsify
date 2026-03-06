from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, ProfileViewSet,EmployeeCreateViewSet,CurrentUserViewSet

router = DefaultRouter()
router.register('profile', ProfileViewSet, basename='profile')
router.register('employees', EmployeeCreateViewSet, basename='add-employee')
router.register('', AuthViewSet, basename='auth-actions')
router.register('user', CurrentUserViewSet, basename='user')

urlpatterns = router.urls
