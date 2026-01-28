from rest_framework.views import APIView
from django.http import HttpResponseRedirect
from django.conf import settings 
import requests

class ActivationView(APIView):
    permission_classes = []

    def get(self, request, uid, token):
        activation_url = request.build_absolute_uri('/auth/users/activation/')
        payload = {'uid': uid, 'token': token}

        resp = requests.post(activation_url, json=payload)

        if resp.status_code in (200, 204):
            return HttpResponseRedirect(f"{settings.BASE_URL}/auth/jwt/create/")
        else:
            return HttpResponseRedirect(f"{settings.BASE_URL}/auth/users/")
