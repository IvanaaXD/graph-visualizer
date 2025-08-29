from lxml import etree
from typing import Dict
from api.model.edge import Edge
from api.model.graph import Graph
from api.model.node import Node
from api.components.data_source import DataSourceService

class XmlDataSourceLoader(DataSourceService):

    def id(self):
        return 'xml-loader'

    def name(self):
        return "XML Loader"

    def file_name(self):
        return "city_intersections.xml"

    def __init__(self):
        pass

    def _create_nodes(self, root: etree._Element, graph: Graph) -> Dict[str, Node]:
        """First pass: create all nodes from the XML elements and assign attributes."""
        id_to_node = {}

        # The XML structure has complex elements, which will be our nodes.
        for element in root.iter():
            id = element.attrib.get("id")
            if not id:
                continue

            # Create a new Node with the name and ID.
            node = Node(name = element.tag + " " + id, node_id = id)

            # Add attributes from the XML element to the node.
            for child_element in element:
                tag, value = child_element.tag, child_element.text

                # If the element has children, it will be created as a node, not as an attribute
                if len(child_element.getchildren()) > 0 or child_element.get("ref"):
                    continue

                node.add_attribute(tag, value)

            graph.add_node(node)
            id_to_node[id] = node

        return id_to_node

    def _create_edges(self, root: etree.Element, graph: Graph, id_to_node: Dict[str, Node]) -> None:
        """Second pass: create edges based on node relationships.
        Detects children by presence of 'id' or 'ref' attributes.
        """

        def connect(from_node: Node, elem: etree.Element, label_if_id="child", label_if_ref="ref") -> None:
            target_id = elem.get("id") or elem.get("ref")
            if not target_id or target_id not in id_to_node:
                return
            to_node = id_to_node[target_id]
            if elem.get("id"):
                graph.add_edge(Edge(graph.directed, from_node, to_node, label_if_id))
            elif elem.get("ref"):
                graph.add_edge(Edge(graph.directed, from_node, to_node, label_if_ref))

        for element in root.iter():
            node_id = element.get("id")
            if not node_id or node_id not in id_to_node:
                continue

            from_node = id_to_node[node_id]

            for child in element:
                # handle grandchildren if present
                for grandchild in child:
                    connect(from_node, grandchild)

                # handle the child itself
                connect(from_node, child)

    def load_graph(self, root: etree.Element) -> Graph:
        direction = root.get("type") == "directed"
        graph = Graph(directed = direction)
        id_to_node = self._create_nodes(root, graph)
        self._create_edges(root, graph, id_to_node)
        return graph

    def load_data(self, file_path: str) -> Graph:
        """Loads data from an XML file and returns a populated Graph."""
        try:
            tree = etree.parse(file_path)
            root = tree.getroot()
            return self.load_graph(root)
        except etree.ParseError as e:
            print(f"Error parsing XML file: {e}")
            return Graph()