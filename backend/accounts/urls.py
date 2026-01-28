from django.urls import path
from .views import ActivationView

urlpatterns = [ 
    path('activate/<str:uid>/<str:token>/', ActivationView.as_view()),
]