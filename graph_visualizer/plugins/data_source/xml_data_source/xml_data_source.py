import xml.etree.ElementTree as ET
from typing import Any, Dict
from api.model.edge import Edge
from api.model.graph import Graph
from api.model.node import Node
from api.components.data_source import DataSourceService

class XmlDataSourceLoader(DataSourceService):

    def id(self):
        return 'city-intersections-xml'

    def name(self):
        return "City Intersections XML Loader"

    def file_name(self):
        return "city_intersections.xml"

    def __init__(self):
        pass

    def _create_nodes(self, root: ET.Element, graph: Graph) -> Dict[str, Node]:
        """First pass: create all nodes from the XML elements and assign attributes."""
        id_to_node = {}

        # The XML structure has 'Street' elements, which will be our nodes.
        for street_element in root.findall('Street'):
            street_id = street_element.attrib.get("id")
            if not street_id:
                continue

            # Create a new Node with the name and ID.
            node = Node(street_element.attrib.get("name", street_id), node_id=street_id)

            # Add attributes from the XML element to the node.
            for key, value in street_element.attrib.items():
                node.add_attribute(key, value)

            graph.add_node(node)
            id_to_node[street_id] = node

        return id_to_node

    def _create_edges(self, root: ET.Element, graph: Graph, id_to_node: Dict[str, Node]) -> None:
        """Second pass: create edges based on 'Neighbour' relationships."""
        for street_element in root.findall('Street'):
            street_id = street_element.attrib.get("id")
            if street_id not in id_to_node:
                continue

            from_node = id_to_node[street_id]

            # The relationships are nested in 'Neighbour' elements.
            for neighbour_element in street_element.findall('Neighbour'):
                target_id = neighbour_element.attrib.get("ref")
                if target_id in id_to_node:
                    to_node = id_to_node[target_id]
                    # Create a directed edge representing the 'Neighbour' relationship.
                    graph.add_edge(Edge(True, from_node, to_node, "neighbour"))

    def load_graph(self, root: ET.Element) -> Graph:
        graph = Graph()
        id_to_node = self._create_nodes(root, graph)
        self._create_edges(root, graph, id_to_node)
        return graph

    def load_data(self, file_path: str) -> Graph:
        """Loads data from an XML file and returns a populated Graph."""
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            return self.load_graph(root)
        except ET.ParseError as e:
            print(f"Error parsing XML file: {e}")
            return Graph()