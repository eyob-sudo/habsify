from rest_framework.views import exception_handler
from rest_framework.exceptions import ErrorDetail


def get_error_messages(data):
    messages = []
    
    if isinstance(data, ErrorDetail):
        messages.append(str(data))
    
    elif isinstance(data, dict):
        for key in ("detail", "error", "errors", "message", "non_field_errors", "msg"):
            if key in data:
                return get_error_messages(data[key])
        
        for value in data.values():
            messages.extend(get_error_messages(value))
    
    elif isinstance(data, (list, tuple)):
        for item in data:
            messages.extend(get_error_messages(item))
    
    else:
        msg = str(data).strip()
        if msg:
            messages.append(msg)
    
    return messages


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    
    if response is not None:
        messages = get_error_messages(response.data)
        
        seen = set()
        clean_messages = [m for m in messages if m not in seen and not seen.add(m)]
        
        response.data = {"detail": clean_messages} if clean_messages else {"detail": ["An unexpected error occurred."]}
    
    return response