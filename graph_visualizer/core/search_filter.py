import datetime as _dt
import re
from typing import Any, Iterable, Tuple
from api.model.graph import Graph
from api.model.node import Node
from api.model.edge import Edge

class FilterParseError(ValueError): ...
class FilterTypeError(ValueError): ...

def _try_num(s: str):
    try:
        if "." in s or "e" in s.lower(): return float(s)
        return int(s)
    except Exception:
        return None

def _try_date(s: str):
    s = s.strip()
    try:
        from datetime import datetime
        if "T" in s:
            return datetime.fromisoformat(s).date()
        return _dt.date.fromisoformat(s)
    except Exception:
        return None


def _coerce(sample: Any, raw: str):
    raw = raw.strip().strip('"').strip("'")
    if sample is None:
        return _try_num(raw) or _try_date(raw) or raw
    if isinstance(sample, bool):
        v = raw.lower()
        if v in ("true","1"): return True
        if v in ("false","0"): return False
        raise FilterTypeError("Expected bool")
    if isinstance(sample, int):
        n = _try_num(raw); 
        if isinstance(n,(int,float)): return int(n)
        raise FilterTypeError("Expected int")
    if isinstance(sample, float):
        n = _try_num(raw); 
        if isinstance(n,(int,float)): return float(n)
        raise FilterTypeError("Expected float")
    if isinstance(sample, _dt.date):
        d = _try_date(raw)
        if d is None: raise FilterTypeError("Expected date YYYY-MM-DD")
        return d
    return raw

def _cmp(a, op, b):
    return {"==": a == b, "!=": a != b, ">": a > b, ">=": a >= b, "<": a < b, "<=": a <= b}[op]

def _subgraph(g: Graph, keep_ids: Iterable[str]) -> Graph:
    keep = set(keep_ids)
    out = Graph()
    id2 = {}
    for n in g.nodes:
        if n.id in keep:
            clone = Node(n.name, node_id=n.id)
            for k,v in n.attributes.items(): clone.add_attribute(k,v)
            out.add_node(clone); id2[n.id] = clone
    for e in g.edges:
        if e.from_node.id in keep and e.to_node.id in keep:
            out.add_edge(Edge(e.directed, id2[e.from_node.id], id2[e.to_node.id], e.type, edge_id=e.id))
    return out

def search_graph(g: Graph, query: str) -> Graph:
    q = (query or "").strip().lower()
    if not q:
        return g

    def _pairs(attrs: dict) -> Iterable[Tuple[str, str]]:
        for k, v in attrs.items():
            if isinstance(v, (dict, list, tuple)):
                import json
                yield k, json.dumps(v, ensure_ascii=False)
            else:
                yield k, str(v)

    ids = []
    for n in g.nodes:
        if q in (n.name or "").lower() or q in (n.id or "").lower():
            ids.append(n.id); continue
        hit = any(q in str(k).lower() or q in str(v).lower() for k, v in _pairs(n.attributes))
        if hit:
            ids.append(n.id)
    return _subgraph(g, ids)

_FILTER = re.compile(r"^(?P<attr>[A-Za-z_][\w\.\-]*)\s*(?P<op>==|!=|>=|<=|>|<)\s*(?P<val>.+)$")

def parse_filter(expr: str) -> Tuple[str,str,str]:
    m = _FILTER.match((expr or "").strip())
    if not m: raise FilterParseError("Use: <attr> <op> <value>")
    return m["attr"], m["op"], m["val"]

def filter_graph(g: Graph, expr: str) -> Graph:
    """
    Returns a subgraph containing nodes that match the filter expression.
    The filter expression format is "<attribute> <operator> <value>", e.g., "age > 30".
    """
    attr, op, raw = parse_filter(expr)

    # error if the attribute doesn't exist on any node
    if all(attr not in n.attributes for n in g.nodes):
        raise FilterParseError(f"Attribute '{attr}' does not exist on any node.")

    ids = []
    for n in g.nodes:
        if attr not in n.attributes:
            continue
        left = n.attributes[attr]

        if isinstance(left, bool) and op not in ("==", "!="):
            raise FilterTypeError("For boolean attributes, only the '==' and '!=' operators are supported.")

        # coerce the right-hand value based on the actual type of 'left' for this node
        try:
            right = _coerce(left, raw)
            if _cmp(left, op, right):
                ids.append(n.id)
        except FilterTypeError:
            # propagate the error so the UI can display the message
            raise
        except TypeError as e:
            # e.g. comparing a string with a number using >/<
            raise FilterTypeError(f"Incompatible comparison for '{attr}': {e}")

    return _subgraph(g, ids)

