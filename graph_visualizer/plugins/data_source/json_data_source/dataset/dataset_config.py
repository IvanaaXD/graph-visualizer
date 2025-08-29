from typing import Dict, Any

PEOPLE_JSON_CONFIG: Dict[str, Any] = {
    "loader_id": "people-json",
    "loader_name": "People JSON Loader",
    "file_name": "people_dataset.json",
    "nodes_path": None,
    "node_id_key": None,
    "edge_keys": {
        "knows": "knows"
    },
    "is_directed": True
}

NETWORK_JSON_CONFIG: Dict[str, Any] = {
    "loader_id": "network-json",
    "loader_name": "Network JSON Loader",
    "file_name": "network_dataset.json",
    "nodes_path": ["nodes"], 
    "node_id_key": "@id",
    "edge_keys": {
        "connected": "connects"
    },
    "is_directed": False
}

SOCIAL_JSON_CONFIG: Dict[str, Any] = {
    "loader_id": "social-json",
    "loader_name": "Social Network Loader",
    "file_name": "social_dataset.json",
    "nodes_path": ["nodes"],
    "node_id_key": "id",
    "edge_keys": {
        "follows": "follows",
        "likes": "likes"
    },
    "is_directed": True
}

PROJECT_JSON_CONFIG: Dict[str, Any] = {
    "loader_id": "project-data-loader",
    "loader_name": "Project Data Loader",
    "file_name": "project_dataset.json",
    "nodes_path": ["nodes"],
    "node_id_key": "@id",
    "node_name_key": "name",
    "edge_keys": {
        "contributors": "has_contributor",
        "projects": "contributes_to"
    },
    "is_directed": True
}