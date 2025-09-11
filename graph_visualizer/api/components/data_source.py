from abc import ABC, abstractmethod
from api.model.graph import Graph

class DataSourceService(ABC):

    @abstractmethod
    def load_data(self, file_path: str) -> Graph:
        pass

    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def id(self) -> str:
        pass