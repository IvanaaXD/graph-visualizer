from typing import Any, Type

class NodeAttribute:
    _id_counter = 0

    def __init__(self, name: str, value: Any, value_type: Type):
        self.name = name
        self.value = value
        self.value_type = value_type  # int, float, str, date
        self.id = NodeAttribute._id_counter
        NodeAttribute._id_counter += 1

    def __str__(self):
        return f"{self.name} ({self.value_type.__name__}): {self.value}"