import json
from typing import Any, Dict, List, Optional
from api.model.edge import Edge
from api.model.graph import Graph
from api.model.node import Node
from api.components.data_source import DataSourceService


class JsonDataSourceLoader(DataSourceService):
    def __init__(self, config: Dict[str, Any]):
        self._config = config
        self._is_directed = config.get("is_directed", False)
        
    def id(self):
        return self._config.get("loader_id", "generic-json")

    def name(self):
        return self._config.get("loader_name", "Generic JSON Loader")

    def file_name(self):
        return self._config.get("file_name", "data.json")

    def _get_data_from_path(self, data: Dict[str, Any], path: Optional[List[str]]) -> Any:
        """Helper function to navigate through JSON using a path."""
        if not path:
            # If there is no path, return all data except the 'directed' key
            temp_data = data.copy()
            temp_data.pop("directed", None)
            return temp_data
        
        current_data = data
        for key in path:
            current_data = current_data.get(key, {})
        return current_data

    def _create_nodes_from_simple_list_or_dict(self, data: Any, graph: Graph) -> Dict[str, Node]:
        """Creates nodes from a simple list or dictionary."""
        id_to_node = {}
        node_id_key = self._config.get("node_id_key")
        node_name_key = self._config.get("node_name_key", "name")
        edge_keys = list(self._config.get("edge_keys", {}).keys())

        if isinstance(data, list):
            for attributes in data:
                node_id = attributes.get(node_id_key)
                if not node_id: continue
                node_name = attributes.get(node_name_key, node_id)
                node = Node(node_name, node_id=node_id)
                for key, value in attributes.items():
                    if key not in [node_id_key, node_name_key] + edge_keys:
                        node.add_attribute(key, value)
                graph.add_node(node)
                id_to_node[node_id] = node
        elif isinstance(data, dict):
            for node_id, attributes in data.items():
                node_name = attributes.get(node_name_key, node_id)
                node = Node(node_name, node_id=node_id)
                for key, value in attributes.items():
                    if key not in edge_keys:
                        node.add_attribute(key, value)
                graph.add_node(node)
                id_to_node[node_id] = node
        return id_to_node

    def _create_edges_from_simple_list_or_dict(self, data: Any, graph: Graph, id_to_node: Dict[str, Node]) -> None:
        """Creates links from a simple list or dictionary."""
        node_id_key = self._config.get("node_id_key")
        edge_keys_map = self._config.get("edge_keys", {})

        node_iterator = data.values() if isinstance(data, dict) else data
        
        for attributes in node_iterator:
            from_node_id = attributes.get(node_id_key) if node_id_key else None
            if not from_node_id:
                if isinstance(data, dict):
                    from_node_id = next((k for k, v in data.items() if v == attributes), None)
            
            from_node = id_to_node.get(from_node_id)
            if not from_node: continue
            
            for json_key, edge_label in edge_keys_map.items():
                target_ids = attributes.get(json_key)
                
                if isinstance(target_ids, list):
                    for target in target_ids:
                        # Is the target a nested dictionary?
                        if isinstance(target, dict):
                            # Extract the id from it
                            target_id = target.get(node_id_key)
                        else:
                            # Assume it's an ID directly
                            target_id = target

                        to_node = id_to_node.get(target_id)
                        if to_node:
                            graph.add_edge(Edge(self._is_directed, from_node, to_node, edge_label))

    def load_graph(self, data: Dict[str, Any]) -> Graph:
        graph = Graph(self._is_directed)
        
        nodes_path = self._config.get("nodes_path")
        graph_data = self._get_data_from_path(data, nodes_path)
        
        id_to_node = self._create_nodes_from_simple_list_or_dict(graph_data, graph)
        self._create_edges_from_simple_list_or_dict(graph_data, graph, id_to_node)
        
        return graph

    def load_data(self, file_path: str) -> Graph:
        with open(file_path, 'r') as file:
            data = json.load(file)
            return self.load_graph(data)