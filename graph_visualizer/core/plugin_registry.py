from importlib.metadata import entry_points
from typing import Dict, List, Type
from api.components.visualizer import VisualizerPlugin
from api.components.data_source import DataSourceService
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

def load_plugins() -> Dict[str, Type[DataSourceService]]:
    plugins = {}
    for ep in entry_points(group="graph_explorer.datasources"):
        plugin_cls = ep.load()
        if issubclass(plugin_cls, DataSourceService):
            plugins[ep.name] = plugin_cls
    return plugins

PLUGINS: Dict[str, Type[DataSourceService]] = load_plugins()

def get_plugin_names():
    return list(PLUGINS.keys())