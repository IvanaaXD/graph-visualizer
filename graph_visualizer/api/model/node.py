from typing import Any, List, Optional, Type
import uuid

from api.model.node_attribute import NodeAttribute

class Node:
    _id_counter = 0

    def __init__(self, name: str, node_id: Optional[str] = None):
        self.name = name
        self.attributes: List[NodeAttribute] = []
        self.id = node_id if node_id else str(uuid.uuid4())
        Node._id_counter += 1

    def add_attribute(self, name: str, value: Any, value_type: Type) -> None:
        self.attributes.append(NodeAttribute(name, value, value_type))

    def __str__(self):
        attr_str = "\n".join(f"\t{attr}" for attr in self.attributes)
        return f"{self.name} (ID: {self.id})\n{attr_str}"
