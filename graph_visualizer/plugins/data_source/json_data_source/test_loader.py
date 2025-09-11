from .dataset.dataset_config import (
    NETWORK_JSON_CONFIG,
    PEOPLE_JSON_CONFIG,
    PROJECT_JSON_CONFIG,
    SOCIAL_JSON_CONFIG
)
from .json_data_source import JsonDataSourceLoader
import os

def get_loader_for_file(file_name: str) -> JsonDataSourceLoader:
    """Selects the appropriate loader based on the filename."""
    if file_name == PEOPLE_JSON_CONFIG["file_name"]:
        return JsonDataSourceLoader(PEOPLE_JSON_CONFIG)
    elif file_name == NETWORK_JSON_CONFIG["file_name"]:
        return JsonDataSourceLoader(NETWORK_JSON_CONFIG)
    elif file_name == SOCIAL_JSON_CONFIG["file_name"]:
        return JsonDataSourceLoader(SOCIAL_JSON_CONFIG)
    elif file_name == PROJECT_JSON_CONFIG["file_name"]:
        return JsonDataSourceLoader(PROJECT_JSON_CONFIG)
    else:
        raise ValueError(f"Unknown configuration for file: {file_name}")

def test_loader():
    options = {
        "1": PEOPLE_JSON_CONFIG["file_name"],
        "2": NETWORK_JSON_CONFIG["file_name"],
        "3": SOCIAL_JSON_CONFIG["file_name"],
        "4": PROJECT_JSON_CONFIG["file_name"]
    }

    print("Available JSON files to load:")
    for key, value in options.items():
        print(f"[{key}] {value}")

    choice = input("Enter the number of the option you want to load: ")    
    file_name = options.get(choice)
    
    if not file_name:
        print("Incorrect entry. Please choose a number from 1 to 4.")
        return

    file_path = os.path.join("plugins", "data_source", "json_data_source", "dataset", file_name)
    
    try:
        loader = get_loader_for_file(file_name)
        graph = loader.load_data(file_path)

        print(graph)
        
        print(f"\nSuccessfully uploded file: {file_name}")
        print(f"Total number of nodes: {len(graph.nodes)}")
        print(f"Total number of connections: {len(graph.edges)}")
        
    except FileNotFoundError:
        print(f"\nError: File '{file_path}'not found.")
    except ValueError as e:
        print(f"\nLoading error: {e}")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")

if __name__ == "__main__":
    test_loader()