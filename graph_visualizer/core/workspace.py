from typing import List, Dict
from api.model.graph import Graph
from .search_filter import search_graph, filter_graph

Query = Dict[str, str] 

class GraphWorkspace:
    def __init__(self, graph: Graph):
        self._original = graph
        self._history: List[Graph] = [graph]
        self._cursor = 0
        self._queries: List[Query] = []

    @property
    def current(self) -> Graph: return self._history[self._cursor]
    @property
    def queries(self) -> List[Query]: return list(self._queries)

    def reset(self):
        self._history = [self._original]; self._cursor = 0; self._queries.clear()

    def apply_search(self, q: str) -> Graph:
        g = search_graph(self.current, q)
        self._history.append(g); self._cursor += 1
        self._queries.append({"type":"search","value":q,"label":f"search: {q}"})

        return g

    def apply_filter(self, expr: str) -> Graph:
        g = filter_graph(self.current, expr)
        self._history.append(g); self._cursor += 1
        self._queries.append({"type":"filter","value":expr,"label":f"filter: {expr}"})
        return g

    def remove_query(self, index: int) -> None:
        kept = [q for i,q in enumerate(self._queries) if i != index]
        self._history = [self._original]; self._cursor = 0; self._queries = []
        for q in kept:
            if q["type"] == "search": self.apply_search(q["value"])
            else: self.apply_filter(q["value"])
