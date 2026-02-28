from rest_framework.pagination import PageNumberPagination

class CustomerPagination(PageNumberPagination):
    page_size = 1           
    page_size_query_param = 'page_size'   # ?page_size=50
    max_page_size = 100     
    page_query_param = 'page' 

