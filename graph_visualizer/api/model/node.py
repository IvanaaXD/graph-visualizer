import uuid
from typing import Any, Dict, Optional

class Node:
    _id_counter = 0

    def __init__(self, name: str, node_id: Optional[str] = None, children=None):
        self.name = name
        self.attributes: Dict[str, Any] = {}
        self.id = node_id if node_id else str(uuid.uuid4())
        Node._id_counter += 1
        self.children = children or []

    def add_attribute(self, name: str, value: Any) -> None:
        self.attributes[name] = value

    def __str__(self):
        attr_str = "\n".join(f"\t{k}: {v}" for k, v in self.attributes.items())
        return f"{self.name} (ID: {self.id})\n{attr_str}"