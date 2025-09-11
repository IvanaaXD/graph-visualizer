from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Final, Dict
from api.model.graph import Graph
from .search_filter import search_graph, filter_graph

class QueryStrategy(ABC):
    kind: str  # "search" | "filter"

    @abstractmethod
    def apply(self, g: Graph, value: str) -> Graph: ...
    @abstractmethod
    def label(self, value: str) -> str: ...

class Search(QueryStrategy):
    kind = "search"
    def apply(self, g: Graph, value: str) -> Graph:
        return search_graph(g, value)
    def label(self, value: str) -> str:
        return f"search: {value}"

class Filter(QueryStrategy):
    kind = "filter"
    def apply(self, g: Graph, value: str) -> Graph:
        return filter_graph(g, value)
    def label(self, value: str) -> str:
        return f"filter: {value}"

STRATEGIES: Final[dict[str, QueryStrategy]] = {
    "search": Search(),
    "filter": Filter(),
}
