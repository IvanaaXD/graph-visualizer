import json
from typing import Any, Dict
from api.model.edge import Edge
from api.model.graph import Graph
from api.model.node import Node
from api.components.data_source import DataSourceService


class JsonDataSourceLoader(DataSourceService):

    def id(self):
        return 'people-json'

    def name(self):
        return "People JSON Loader"

    def file_name(self):
        return "people.json"

    def __init__(self):
        pass

    def _create_nodes(self, data: Dict[str, Dict[str, Any]], graph: Graph) -> Dict[str, Node]:
        """First pass: create all nodes and assign attributes."""
        id_to_node = {}

        for person_id, attributes in data.items():
            node = Node(attributes.get("name", person_id), node_id=person_id)

            for key, value in attributes.items():
                if key == "knows":
                    continue  # relationships are handled separately
                node.add_attribute(key, value)

            graph.add_node(node)
            id_to_node[person_id] = node

        return id_to_node

    def _create_edges(self, data: Dict[str, Dict[str, Any]], graph: Graph, id_to_node: Dict[str, Node]) -> None:
        """Second pass: create edges for all 'knows' relationships."""
        for person_id, attributes in data.items():
            from_node = id_to_node[person_id]

            knows_list = attributes.get("knows", [])
            for target_id in knows_list:
                if target_id in id_to_node:
                    to_node = id_to_node[target_id]
                    graph.add_edge(Edge(True, from_node, to_node, "knows"))

    def load_graph(self, data: Dict[str, Dict[str, Any]]) -> Graph:
        graph = Graph()
        id_to_node = self._create_nodes(data, graph)
        self._create_edges(data, graph, id_to_node)
        return graph

    def load_data(self, file_path: str) -> Graph:
        with open(file_path, 'r') as file:
            data = json.load(file)
            return self.load_graph(data)