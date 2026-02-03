from django.contrib.auth.tokens import default_token_generator
from djoser.utils import decode_uid,encode_uid
from rest_framework import viewsets, mixins
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from rest_framework import status
from .models import User,OTPCode
from .serializers import (OTPVerifySerializer, 
                          ForgotPasswordSerializer, 
                          ResendActivationSerializer, 
                          CreatePasswordRetypeSerializer,
                          PasswordResetConfirmSerializer)
from .utils import send_activation_email,generate_reset_token
from rest_framework.viewsets import GenericViewSet
# from ratelimit.decorators import ratelimit  
from django.utils.decorators import method_decorator

class AuthViewSet(GenericViewSet):
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action == "create":
            return CreatePasswordRetypeSerializer
        if self.action == "otp_verify":
            return OTPVerifySerializer
        if self.action == "resend_activation":
            return ResendActivationSerializer
        if self.action == "forgot_password":
            return ForgotPasswordSerializer
        if self.action == "reset_password":
            return PasswordResetConfirmSerializer
        return super().get_serializer_class()

    # @method_decorator(ratelimit(key='ip', rate='5/m', method='POST', block=True))
    @action(detail=False, methods=['post'], url_path='otp-verify')
    def otp_verify(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        otp = serializer.validated_data["otp"]
        user = serializer.validated_data["user"]
        if not otp.verify(serializer.validated_data["code"]):
            if otp.is_locked:
                otp.mark_used()
                raise serializers.ValidationError("Too many failed attempts. OTP invalidated.")
            raise serializers.ValidationError("Incorrect OTP code.")
        purpose = otp.purpose
        print("=====================================================================",purpose)
        if purpose in [OTPCode.PURPOSE_SIGNUP, OTPCode.PURPOSE_VERIFY]:
            user.is_active = True
            if otp.type == OTPCode.TYPE_SMS:
                user.is_phone_verified = True
                phone = user.phone_numbers.first()
                if phone:
                    phone.mark_verified()
            else:
                user.is_email_verified = True
            user.save()
            otp.mark_used()
            return Response({"message": "OTP verified successfully"}, status=status.HTTP_200_OK)
        elif purpose == OTPCode.PURPOSE_RESET:
            reset_token = default_token_generator.make_token(user)
            uid = encode_uid(user.pk)
            otp.mark_used()
            return Response({
                "uid": uid,
                "reset_token": reset_token,
                "message": "OTP verified. Use the token to reset password."
            }, status=status.HTTP_200_OK)
        else:
            otp.mark_used()
            raise serializers.ValidationError("Invalid OTP purpose.")

    # @method_decorator(ratelimit(key='ip', rate='5/m', method='GET', block=True))
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
            user.save(update_fields=["is_active", "is_email_verified"])
            return Response({"message": "Account activated successfully"}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

    # @method_decorator(ratelimit(key='ip', rate='3/m', method='POST', block=True))
    @action(detail=False, methods=["post"], url_path="resend-activation")
    def resend_activation(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        user = User.objects.get(email=email)
        try:
            send_activation_email(user, request=request)
        except Exception:
            return Response({"error": "Failed to send activation email"}, status=500)
        return Response({"message": "Activation email resent"}, status=200)

    # @method_decorator(ratelimit(key='ip', rate='5/m', method='POST', block=True))
    @action(detail=False, methods=["post"], url_path="forgot-password")
    def forgot_password(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        from .utils import create_otp_for_user, send_otp_to_phone, send_otp_email
        otp_type = OTPCode.TYPE_SMS if serializer.validated_data.get("phone") else OTPCode.TYPE_EMAIL
        otp, _ = create_otp_for_user(user=user, otp_type=otp_type, seconds=300, purpose=OTPCode.PURPOSE_RESET)
        try:
            if serializer.validated_data.get("phone"):
                send_otp_to_phone(otp_code=otp, phone=serializer.validated_data.get("phone"))
            else:
                send_otp_email(user=user, otp_code=otp, purpose="reset_password")
            return Response({"message": "OTP sent successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to send OTP for password reset: {e}")
            return Response({"error": "Failed to send OTP"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

    @action(detail=False, methods=['post'], url_path='reset-password')
    def reset_password(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Password reset successfully"}, status=status.HTTP_200_OK)

