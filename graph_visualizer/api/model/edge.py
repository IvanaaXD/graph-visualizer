import uuid
from api.model.node import Node
from typing import Optional

class Edge:
    _id_counter = 0

    def __init__(self, directed: bool, from_node: Node, to_node: Node, edge_type: str, edge_id: Optional[str] = None):
        self.directed = directed
        self.from_node = from_node
        self.to_node = to_node
        self.type = edge_type
        self.id = edge_id if edge_id else str(uuid.uuid4())
        Edge._id_counter += 1

    def __str__(self):
        arrow = "->" if self.directed else "--"
        return f"{self.from_node.name} {arrow} {self.to_node.name}"