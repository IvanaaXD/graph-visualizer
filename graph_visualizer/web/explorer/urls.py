from django.urls import path 
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("search", views.apply_search, name="apply_search"),
    path("filter", views.apply_filter, name="apply_filter"),
    path("reset", views.reset_workspace, name="reset_workspace"),
    path("remove-query", views.remove_query, name="remove_query"),
]
