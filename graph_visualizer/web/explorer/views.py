from django.shortcuts import render, redirect
from django.views.decorators.http import require_http_methods
from core.workspace_manager import WorkspaceManager
from core.render_service import render_graph_html
from core.tree_render import render_tree_details
from core.bird_render import render_bird_svg
from core.search_filter import FilterParseError, FilterTypeError
import os
from core.plugin_registry import get_plugin_names, PLUGINS
from django.urls import reverse
from graph_visualizer.plugins.data_source.json_data_source.json_data_source import JsonDataSourceLoader
from graph_visualizer.plugins.data_source.xml_data_source.xml_data_source import XmlDataSourceLoader
from plugins.data_source.json_data_source.dataset.dataset_config import (
    PEOPLE_JSON_CONFIG, NETWORK_JSON_CONFIG, SOCIAL_JSON_CONFIG, PROJECT_JSON_CONFIG
)

# One global manager instance
_WS_MANAGER = WorkspaceManager()

JSON_CONFIGS = {
    c["file_name"]: c for c in [PEOPLE_JSON_CONFIG, NETWORK_JSON_CONFIG, SOCIAL_JSON_CONFIG, PROJECT_JSON_CONFIG]
}

def home(request):
    err = request.session.pop("error", None)

    ctx = {
        "plugins": get_plugin_names(),
        "error": err,
        "main_html": "",
        "tree_html": "",
        "bird_html": "",
        "applied_queries": [],
        "stats": {"nodes": 0, "edges": 0},
        "workspaces": {},
        "active_id": None,
    }

    active_ws = _WS_MANAGER.get_active()
    if active_ws:
        ctx.update({
            "main_html": render_graph_html(active_ws.current, "simple", width=1000, height=620),
            "tree_html": render_tree_details(active_ws.current),
            "bird_html": render_bird_svg(active_ws.current),
            "applied_queries": active_ws.queries,
            "stats": {"nodes": len(active_ws.current.nodes), "edges": len(active_ws.current.edges)},
            "workspaces": _WS_MANAGER.get_all(),
            "active_id": _WS_MANAGER.active_id,
        })
        
    return render(request, "explorer.html", ctx)

@require_http_methods(["POST"])
def create_workspace(request):
    try:
        uploaded_file = request.FILES.get("file")

        if not uploaded_file:
            raise ValueError("File not provided.")

        file_name = uploaded_file.name
        _, file_extension = os.path.splitext(file_name)

        if file_extension.lower() == ".json":
            config = JSON_CONFIGS.get(file_name)
            if not config:
                raise ValueError(f"No configuration found for JSON file: {file_name}")
            
            loader = JsonDataSourceLoader(config)
            
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            file_path = os.path.join(BASE_DIR, "plugins", "data_source", "json_data_source", "dataset", file_name)
            
        elif file_extension.lower() == ".xml":
            loader = XmlDataSourceLoader()
            
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            file_path = os.path.join(BASE_DIR, "plugins", "data_source", "xml_data_source", "data", file_name)
            
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}. Make sure it exists in the correct directory.")

        graph = loader.load_data(file_path)
        _WS_MANAGER.create_workspace(graph=graph)

    except (ValueError, FileNotFoundError) as e:
        request.session["error"] = str(e)
    except Exception as e:
        request.session["error"] = f"An unexpected error occurred: {e}"

    return redirect("home")

@require_http_methods(["POST"])
def switch_workspace(request, wspace_id):
    _WS_MANAGER.switch_workspace(wspace_id)
    return redirect("home")

@require_http_methods(["POST"])
def close_workspace(request, wspace_id):
    _WS_MANAGER.close_workspace(wspace_id)
    return redirect("home")

def apply_search(request):
    q = request.GET.get("q", "").strip()
    active_ws = _WS_MANAGER.get_active()
    if active_ws and q:
        active_ws.apply_search(q)
    return redirect("home")

def apply_filter(request):
    expr = request.GET.get("expr", "").strip()
    if not expr: return redirect("home")
    
    active_ws = _WS_MANAGER.get_active()
    if not active_ws: return redirect("home")
    
    try:
        active_ws.apply_filter(expr)
    except (FilterParseError, FilterTypeError) as e:
        request.session["error"] = str(e)
    return redirect("home")

@require_http_methods(["POST"])
def reset_workspace(request):
    active_ws = _WS_MANAGER.get_active()
    if active_ws:
        active_ws.reset()
    return redirect("home")

@require_http_methods(["POST"])
def remove_query(request):
    idx = int(request.POST.get("idx", "-1"))
    active_ws = _WS_MANAGER.get_active()
    if active_ws and idx >= 0:
        active_ws.remove_query(idx)
    return redirect("home")