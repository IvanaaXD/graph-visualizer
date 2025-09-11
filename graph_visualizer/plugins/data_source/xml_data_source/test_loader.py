from plugins.data_source.xml_data_source.xml_data_source import XmlDataSourceLoader

def test_loader():
    file_path = "plugins/data_source/xml_data_source/data/test.xml"
    loader = XmlDataSourceLoader()
    graph = loader.load_data(file_path)
    print(graph)

if __name__ == "__main__":
    test_loader()