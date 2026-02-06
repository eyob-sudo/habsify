from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, ProfileViewSet,EmployeeCreateViewSet

router = DefaultRouter()
router.register('profile', ProfileViewSet, basename='profile')
router.register('employees', EmployeeCreateViewSet, basename='add-employee')
router.register('', AuthViewSet, basename='auth-actions')

urlpatterns = router.urls
