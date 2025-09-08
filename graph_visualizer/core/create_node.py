from typing import Any, Dict
from graph_visualizer.api.model.graph import Graph
from api.model.node import Node

def create_node(g: Graph, node_data: Dict[str, Any]) -> Graph:
    node_id = node_data.get('id')
    if not node_id:
        raise ValueError("Node data must contain an 'id'.")
    
    if g.get_node_by_id(node_id):
        raise ValueError(f"Node with id '{node_id}' already exists.")

    node_name = node_data.get('label', node_id)
    new_node = Node(name=node_name, node_id=node_id)
    
    for key, value in node_data.items():
        if key not in ['id', 'label']:
            new_node.add_attribute(key, value)
            
    g.add_node(new_node)
    return g