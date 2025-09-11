from django.urls import path 
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("search", views.apply_search, name="apply_search"),
    path("filter", views.apply_filter, name="apply_filter"),
    path("reset", views.reset_workspace, name="reset_workspace"),
    path("remove-query", views.remove_query, name="remove_query"),
    path('create-workspace/', views.create_workspace, name='create_workspace'),
    path('switch-workspace/<str:wspace_id>/', views.switch_workspace, name='switch_workspace'),
    path('close-workspace/<str:wspace_id>/', views.close_workspace, name='close_workspace'),
    path("switch-visualizer/<str:visualizer_key>/", views.switch_visualizer, name="switch_visualizer"),
    path("bird-render/", views.bird_render, name="bird_render"),
    path("api/graph-command/", views.handle_graph_command_api, name="graph_command_api"),
]
