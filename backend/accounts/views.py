from django.contrib.auth.tokens import default_token_generator
from djoser.utils import decode_uid,encode_uid
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import viewsets, mixins
from rest_framework.response import Response
from rest_framework.permissions import AllowAny,IsAuthenticated,IsAdminUser
from rest_framework.decorators import action
from rest_framework import status
from .models import User,OTPCode,Profile
from .serializers import (OTPVerifySerializer, 
                          ForgotPasswordSerializer, 
                          ResendActivationSerializer, 
                          CreatePasswordRetypeSerializer,
                          PasswordResetConfirmSerializer,
                          ChangePasswordSerializer,
                          ProfileSerializer,
                          EmployeeCreateSerializer,
                          LogoutSerializer,
                          OTPResetSerializer)
from .utils import send_activation_email
from .permissions import IsBusinessAdmin,IsBusinessOrAdmin
from rest_framework.viewsets import GenericViewSet
# from ratelimit.decorators import ratelimit  

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
            return OTPResetSerializer
        if self.action == "change_password":
            return ChangePasswordSerializer
        if self.action == "logout":
            return LogoutSerializer
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
                raise serializers.ValidationError({"detail": "Too many failed attempts. OTP invalidated."})
            raise serializers.ValidationError({"detail": "Incorrect OTP code."})
        purpose = otp.purpose
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
            return Response({"detail": "OTP verified successfully"}, status=status.HTTP_200_OK)
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
            raise serializers.ValidationError({"detail": "Invalid OTP purpose."})

    # @method_decorator(ratelimit(key='ip', rate='5/m', method='GET', block=True))
    @action(detail=False, methods=['get'], url_path='activate/(?P<uid>[^/.]+)/(?P<token>[^/.]+)',authentication_classes=[],permission_classes=[AllowAny])
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
            return Response({"detail": "Account activated successfully"}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

    # @method_decorator(ratelimit(key='ip', rate='3/m', method='POST', block=True))
    @action(detail=False, methods=["post"], url_path="resend-activation",authentication_classes=[],permission_classes=[AllowAny])
    def resend_activation(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        user = User.objects.get(email=email)
        try:
            send_activation_email(user, request=request)
        except Exception:
            return Response({"detail": "Failed to send activation email"}, status=500)
        return Response({"detail": "Activation email resent"}, status=200)

    # @method_decorator(ratelimit(key='ip', rate='5/m', method='POST', block=True))
    @action(detail=False, methods=["post"], url_path="forgot-password",authentication_classes=[],permission_classes=[AllowAny])
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
            return Response({"detail": "OTP sent successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to send OTP for password reset: {e}")
            return Response({"detail": "Failed to send OTP"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    @action(detail=False, methods=['post'], url_path='reset-password',authentication_classes=[],permission_classes=[AllowAny])
    def reset_password(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password reset successfully"}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=["post"],url_path="change-password",permission_classes=[IsAuthenticated])
    def change_password(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password changed successfully"},status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], url_path='logout', permission_classes=[IsAuthenticated])
    def logout(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True) 

        try:
            token = RefreshToken(serializer.validated_data['refresh'])
            token.blacklist() 

            return Response({"detail": "Successfully logged out"}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({"detail": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get', 'put'], permission_classes=[IsAuthenticated])
    def me(self, request):
        try:
            profile = Profile.objects.get(user=request.user)
        except Profile.DoesNotExist:
            return Response({"detail": "Profile not found."}, status=404)
        
        if request.method == 'GET':
            serializer = ProfileSerializer(profile)
            return Response(serializer.data)
        
        if request.method == 'PUT':
            serializer = ProfileSerializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

class EmployeeCreateViewSet(mixins.CreateModelMixin, GenericViewSet):
    queryset = User.objects.all()
    serializer_class = EmployeeCreateSerializer
    permission_classes = [IsAuthenticated]


    

