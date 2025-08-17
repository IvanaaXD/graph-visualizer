from plugins.data_source.json_data_source.json_data_source import JsonDataSourceLoader

def test_loader():
    file_path = "plugins/data_source/json_data_source/dataset.json"
    loader = JsonDataSourceLoader()
    graph = loader.load_data(file_path)
    print(graph)

if __name__ == "__main__":
    test_loader()