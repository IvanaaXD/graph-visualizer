from typing import Dict, List
from api.components.visualizer import VisualizerPlugin
from .exceptions import VisualizerNotFound
_visualizers: Dict[str, VisualizerPlugin] = {}

def register_visualizer(plugin: VisualizerPlugin) -> None:
    if not getattr(plugin, "key", None):
        raise ValueError("Visualizer must define key")
    _visualizers[plugin.key] = plugin

def get_visualizer(key: str) -> VisualizerPlugin:
    try:
        return _visualizers[key]
    except KeyError:
        raise VisualizerNotFound(key)

def available_visualizers() -> List[str]:
    return list(_visualizers.keys())
