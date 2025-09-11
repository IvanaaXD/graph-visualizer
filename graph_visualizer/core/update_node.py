from typing import Any, Dict
from graph_visualizer.api.model.graph import Graph
from api.model.node import Node


def update_node(g: Graph, node_id: str, updates: Dict[str, Any]) -> Graph:
    node_to_update = g.get_node_by_id(node_id)
    
    if not node_to_update:
        raise ValueError(f"Node with id '{node_id}' not found.")
        
    for key, value in updates.items():
        if key == 'name':
            node_to_update.name = value
        else:
            node_to_update.add_attribute(key, value)
            
    return g