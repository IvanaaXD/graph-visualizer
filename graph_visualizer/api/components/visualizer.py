from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from api.model.graph import Graph

class VisualizerPlugin(ABC):
    """
    Strategy interface for graph visualization.
    Each visualizer must have a unique `key` and implement the `render` method.
    """
    key: str  # e.g. "simple"

    @abstractmethod
    def render(
        self,
        graph: Graph,
        width: int = 900,
        height: int = 600,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Returns HTML (most often SVG) for displaying the graph."""
        raise NotImplementedError
