from typing import List, Optional
from api.model.edge import Edge
from api.model.node import Node

class Graph:
    def __init__(self, directed: bool):
        self.directed = directed
        self.nodes: List[Node] = []
        self.edges: List[Edge] = []

    def add_node(self, node: Node) -> None:
        self.nodes.append(node)

    def add_edge(self, edge: Edge) -> None:
        self.edges.append(edge)

    def remove_node(self, node: Node) -> None:
        self.nodes = [n for n in self.nodes if n.id != node.id]
        
        # remove all edges associated with that node
        self.edges = [e for e in self.edges if e.from_node.id != node.id and e.to_node.id != node.id]

    def remove_edge(self, edge: Edge) -> None:
        self.edges = [e for e in self.edges if e.id != edge.id]

    def get_node_by_id(self, node_id: str) -> Optional[Node]:
        return next((n for n in self.nodes if n.id == node_id), None)

    def get_edge_by_id(self, edge_id: str) -> Optional[Edge]:
        return next((e for e in self.edges if e.id == edge_id), None)

    def __str__(self):
        nodes_str = "\n".join(str(node) for node in self.nodes)
        edges_str = "\n".join(str(edge) for edge in self.edges)
        return f"Nodes:\n{nodes_str}\n\nEdges:\n{edges_str}"