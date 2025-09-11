import json
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse, HttpRequest
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
    visualizer_key = request.GET.get("visualizer", "simple")

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
        "visualizer_key": visualizer_key,  
        "current_visualizer": visualizer_key,  

    }

    active_ws = _WS_MANAGER.get_active()
    if active_ws:
        ctx.update({
            "main_html": render_graph_html(active_ws.current, visualizer_key, width=1000, height=620),
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
    visualizer = request.GET.get("visualizer", "simple")
    active_ws = _WS_MANAGER.get_active()
    if active_ws and q:
        active_ws.apply_search(q)
    return redirect(f"/?visualizer={visualizer}")

def apply_filter(request):
    expr = request.GET.get("expr", "").strip()
    visualizer = request.GET.get("visualizer", "simple")
    if not expr: return redirect(f"/?visualizer={visualizer}")
    
    active_ws = _WS_MANAGER.get_active()
    if not active_ws: return redirect(f"/?visualizer={visualizer}")
    
    try:
        active_ws.apply_filter(expr)
    except (FilterParseError, FilterTypeError) as e:
        request.session["error"] = str(e)
    return redirect(f"/?visualizer={visualizer}")


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

@require_http_methods(["POST"])
def switch_visualizer(request, visualizer_key):
    active_ws = _WS_MANAGER.get_active()
    if not active_ws:
        return JsonResponse({
            "html": "<p>No active workspace</p>",
            "visualizer": visualizer_key
        })

    try:
        body = json.loads(request.body)
        positions = body.get("positions", {})  
    except json.JSONDecodeError:
        positions = {}

    html = render_graph_html(
        active_ws.current,
        visualizer_key,
        width=1000,
        height=620,
        context={"positions": positions} 
    )

    return JsonResponse({
        "html": html,
        "visualizer": visualizer_key
    })

@require_http_methods(["POST"])
def bird_render(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
        active_ws = _WS_MANAGER.get_active()
        if not active_ws:
            return JsonResponse({"error": "No active workspace"}, status=400)

        positions = {}
        for node_id, coords in (data.get("positions") or {}).items():
            try:
                px, py = coords
                positions[node_id] = [float(px), float(py)]
            except (TypeError, ValueError, IndexError):
                positions[node_id] = [0, 0]

        visualizer = data.get("visualizer", "simple")  

        context = {
            "viewport": data.get("viewport"),
            "positions": positions,
            "visualizer": visualizer  
        }

        html = render_bird_svg(active_ws.current, context=context)
        return JsonResponse({"html": html})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        return JsonResponse({"error": str(e), "traceback": tb}, status=500)


@require_http_methods(["POST"])
def handle_graph_command_api(request: HttpRequest):
    """ 
    A single API endpoint for processing all commands sent from the CLI terminal. 
    Expects JSON format: { "command": "command_name", "payload": { ...data... } } 
    Returns a JSON response. 
    """
    try:
        data = json.loads(request.body)
        command = data.get('command')
        payload = data.get('payload', {})
        
        active_ws = _WS_MANAGER.get_active()
        if not active_ws:
            return JsonResponse({'error': 'No active workspace'}, status=404)

        if command == 'create-node':
            active_ws.create_node(payload)
        elif command == 'update-node':
            node_id = payload.get('id')
            updates = payload.get('updates')
            if not node_id or updates is None:
                raise ValueError("Update-node requires 'id' and 'updates'.")
            active_ws.update_node(node_id, updates)
        elif command == 'delete-node':
            node_id = payload.get('id')
            if not node_id:
                raise ValueError("Delete-node requires 'id'.")
            active_ws.delete_node(node_id)
        elif command == 'create-edge': 
            from_id = payload.get('from')
            to_id = payload.get('to')
            edge_type = payload.get('type', 'related')
            if not from_id or not to_id:
                raise ValueError("Create-edge requires 'from' and 'to' IDs.")
            active_ws.create_edge(from_id, to_id, edge_type)
        elif command == 'filter':
            expression = payload.get('expression')
            if not expression:
                raise ValueError("The filter requires 'expression'.")
            active_ws.apply_filter(expression)
        elif command == 'search':
            query = payload.get('query')
            if query is None:
                 raise ValueError("Search requires a 'query'.")
            active_ws.apply_search(query)
        else:
            return JsonResponse({'error': f'Unknown command: {command}'}, status=400)

        current_graph = active_ws.current
        graph_json = {
            "nodes": [{"id": n.id, "name": n.name, "attributes": n.attributes} for n in current_graph.nodes],
            "edges": [{"id": e.id, "from": e.from_node.id, "to": e.to_node.id, "type": e.type} for e in current_graph.edges]
        }
        
        return JsonResponse({'status': 'success', 'graph': graph_json})

    except (ValueError, FilterParseError, FilterTypeError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON in request body'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'An internal server error occurred: {e}'}, status=500)
