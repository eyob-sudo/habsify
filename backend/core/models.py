from django.db import models


class Company(models.Model):
    name = models.CharField(max_length=255, unique=True) 
    owner = models.ForeignKey(
        "accounts.User", 
        on_delete=models.CASCADE,
        related_name="owned_companies"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['owner', 'is_active']),
        ]

    def __str__(self):
        return self.name