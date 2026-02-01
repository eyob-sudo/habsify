from django.contrib.auth.tokens import default_token_generator
from djoser.utils import decode_uid
from rest_framework import viewsets,mixins
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from rest_framework import status
from .models import User
from .serializers import OTPVerifySerializer,SendOTPSerializer,CreatePasswordRetypeSerializer,ResendActivationSerializer
from .utils import send_activation_email
from rest_framework.viewsets import ModelViewSet, GenericViewSet
from rest_framework.mixins import CreateModelMixin

class AuthViewSet(GenericViewSet):
    permission_classes = [AllowAny]


    def get_serializer_class(self):
        if self.action == "otp_verify":
            return OTPVerifySerializer
        if self.action == "resend_activation":
            return ResendActivationSerializer
        return None

    @action(detail=False, methods=['post'], url_path='otp-verify')
    def otp_verify(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.verify(serializer.validated_data)
        return Response(result, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get'], url_path='activate/(?P<uid>[^/.]+)/(?P<token>[^/.]+)')
    def activate(self, request, uid=None, token=None):
        try:
            uid_decoded = decode_uid(uid)
            user = User.objects.get(pk=uid_decoded)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Invalid UID"}, status=status.HTTP_400_BAD_REQUEST)

        if default_token_generator.check_token(user, token):
            user.is_active = True
            user.is_email_verified = True
            user.save(update_fields=["is_active","is_email_verified"])
            return Response({"message": "Account activated successfully"}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
        
    @action(detail=False, methods=["post"], url_path="resend-activation")
    def resend_activation(self, request):
        email = request.data.get("email")
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "No user with this email"}, status=400)

        if user.is_active:
            return Response({"error": "User already active"}, status=400)

        try:
            send_activation_email(user, request=request)
        except Exception:
            return Response({"error": "Failed to send activation email"}, status=500)

        return Response({"message": "Activation email resent"}, status=200)

            
    

    # @action(detail=False, methods=['post'])
    # def resend(self, request):
    #     # logic to resend OTP
    #     return Response({"detail": "OTP resent successfully"})

    
# class SendOTPView(mixins.CreateModelMixin, viewsets.GenericViewSet):
#     permission_classes = [AllowAny]
#     queryset = PhoneNumber.objects.select_related("user").all()
#     serializer_class = SendOTPSerializer

#     def create(self, request):
#         return Response(
#             {
#                 'detail': 'OTP sent successfully.',
#                 'redirect_url': '/verify-otp/'
#             },
#             status=status.HTTP_200_OK
#         )