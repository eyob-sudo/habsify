from rest_framework.routers import DefaultRouter
from .views import SupplierViewSet

routes = DefaultRouter()
routes.register('supplier',SupplierViewSet,basename='supplier')

urlpatterns = routes.urls + [
    
]