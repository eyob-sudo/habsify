from django.contrib import admin
from django.urls import path, include

admin.site.site_header = "Habsify Admin"
admin.site.site_title = "Habsify Admin Portal"
admin.site.index_title = "Welcome to Habsify Administration"

urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth/', include('djoser.urls')),
    path('auth/', include('djoser.urls.jwt')),
    path('accounts/', include('accounts.urls')),
    path('subscriptions/', include('subscriptions.urls')),
    path('crm/',include('crm.urls')),
    path('suppliers/',include('suppliers.urls')), 
    path('sales-purchases/',include('sales_purchases.urls')), 
    path('inventory/',include('inventory.urls')), 
    path('finance/',include('finance.urls')), 
    path('api/',include('analytics.urls')), 
    path('notifications/',include('notifications.urls')), 
]

