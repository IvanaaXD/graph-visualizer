from django.shortcuts import render, redirect 
from django.views.decorators.http import require_http_methods 
from api.model.graph import Graph
from api.model.node import Node
from api.model.edge import Edge
from core.workspace import GraphWorkspace
from core.render_service import render_graph_html
from core.tree_render import render_tree_details
from core.bird_render import render_bird_svg
from core.search_filter import FilterParseError, FilterTypeError
import os
from plugins.data_source.json_data_source.json_data_source import JsonDataSourceLoader

# A single global workspace (by specification - one user)
_WS = None


def _ensure_ws():
    global _WS
    if _WS is None:
        loader = JsonDataSourceLoader()
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        file_path = os.path.join(BASE_DIR, "plugins", "data_source", "json_data_source", "dataset.json")
        g = loader.load_data(file_path)
        _WS = GraphWorkspace(g)

def _ctx():
    html = render_graph_html(_WS.current, "simple", width=1000, height=620)
    return {
        "main_html": html,
        "tree_html": render_tree_details(_WS.current),
        "bird_html": render_bird_svg(_WS.current),
        "applied_queries": _WS.queries,
        "stats": {"nodes": len(_WS.current.nodes), "edges": len(_WS.current.edges)},
        "error": None,
    }

def home(request):
    _ensure_ws()
    # error message from the session (if it exists)
    err = request.session.pop("error", None)
    ctx = _ctx()
    ctx["error"] = err
    return render(request, "explorer.html", ctx)

def apply_search(request):
    _ensure_ws()
    q = request.GET.get("q","").strip()
    if q: _WS.apply_search(q)
    return redirect("home")

def apply_filter(request):
    _ensure_ws()
    expr = request.GET.get("expr","").strip()
    if not expr: return redirect("home")
    try:
        _WS.apply_filter(expr)
    except (FilterParseError, FilterTypeError) as e:
        request.session["error"] = str(e)
    return redirect("home")

@require_http_methods(["POST"])
def reset_workspace(request):
    _ensure_ws(); _WS.reset(); return redirect("home")

@require_http_methods(["POST"])
def remove_query(request):
    _ensure_ws()
    idx = int(request.POST.get("idx","-1"))
    if idx >= 0: _WS.remove_query(idx)
    return redirect("home")
