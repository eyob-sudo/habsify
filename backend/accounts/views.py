from rest_framework import mixins,viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.mixins import CreateModelMixin, DestroyModelMixin, RetrieveModelMixin, UpdateModelMixin
from django.http import HttpResponseRedirect
from django.conf import settings
from rest_framework.permissions import IsAuthenticated, AllowAny
import requests
from .models import OTPCode,PhoneNumber
from .serializers import OTPVerifySerializer
from rest_framework import status


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
        


class VerifyViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = OTPCode.objects.all() 
    serializer_class = OTPVerifySerializer
    # permission_classes = [IsAuthenticated]  
    # throttle_classes = [UserRateThrottle]  # limit to 5/min per user

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.create(serializer.validated_data), status=status.HTTP_200_OK)
    
class SendOTPView(mixins.CreateModelMixin, viewsets.GenericViewSet):
    permission_classes = [AllowAny]
    queryset = PhoneNumber.objects.all()
    serializer_class = SendOTPSerializer

    def create(self, request):
        return Response(
            {
                'detail': 'OTP sent successfully.',
                'redirect_url': '/verify-otp/'
            },
            status=status.HTTP_200_OK
        )