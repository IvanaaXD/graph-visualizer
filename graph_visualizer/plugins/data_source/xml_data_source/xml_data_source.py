from lxml import etree
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

    def _create_nodes(self, element: etree._Element, graph: Graph, xpath_map: dict) -> Node:
        """
        First pass: creates nodes for elements with children
        and stores a map XPath -> Node in order to support cyclic references.
        """
        element_xpath = element.getroottree().getpath(element)

        # If a node for this XPath already exists, return it (prevents cycles)
        if element_xpath in xpath_map:
            return xpath_map[element_xpath]

        node = Node(name=element.tag + " " + str(id(element)), node_id=str(id(element)))
        xpath_map[element_xpath] = node

        for child in element:
            if len(child):  # has a subtree -> create node
                child_node = self._create_nodes(child, graph, xpath_map)
                graph.add_edge(Edge(graph.directed, node, child_node, edge_type="child"))
            elif child.tag == "reference" or child.tag == "ref":  # references will be processed later
                continue
            else:
                node.add_attribute(child.tag, child.text)

        graph.add_node(node)
        return node

    def _create_references(self, element: etree._Element, graph: Graph, xpath_map: dict):
        """
        Second pass: creates edges for references using XPath.
        """
        element_xpath = element.getroottree().getpath(element)
        from_node = xpath_map.get(element_xpath)
        if not from_node:
            return

        for child in element:
            if child.tag == "reference":
                target_path = child.text
                to_node = element.xpath(target_path)
                if to_node:
                    to_node_obj = xpath_map.get(to_node[0].getroottree().getpath(to_node[0]))
                    if to_node_obj:
                        graph.add_edge(Edge(graph.directed, from_node, to_node_obj, "reference"))
            else:
                self._create_references(child, graph, xpath_map)

    def load_graph(self, root: etree.Element) -> Graph:
        direction = root.get("type") == "directed"
        graph = Graph(directed=direction)
        xpath_map = {}

        # First pass: create all nodes
        self._create_nodes(root, graph, xpath_map)

        # Second pass: create edges for references
        self._create_references(root, graph, xpath_map)

        return graph

    def load_data(self, file_path: str) -> Graph:
        try:
            tree = etree.parse(file_path)
            root = tree.getroot()
            return self.load_graph(root)
        except etree.ParseError as e:
            print(f"Error parsing XML file: {e}")
            return Graph()
