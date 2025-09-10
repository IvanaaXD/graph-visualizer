## Graph Visualizer

Welcome to **Graph Visualizer**! This application is a powerful platform for visualizing complex graphs, allowing you to display data in an intuitive and interactive way.

---

### Team

This project was developed by a team of dedicated programmers.

**Team Members:**

* Milan Lazarević, SV 4/2022
* Marina Ivanović, SV 6/2022
* Milica Stanojlović, SV 18/2022
* Ivana Radovanović, SV 23/2022

---

### Installation and Running the Project

Follow these steps to set up and run the project.

#### 1. Clone the Repository

```bash
git clone https://github.com/marina-ivanovic/graph-visualizer
cd graph-visualizer
```

#### 2. Set Up the Project

```bash
python -m venv .venv
.venv/Scripts/activate (source .venv/bin/activate)
pip install -e graph_visualizer
cd graph_visualizer
pip install -e api
cd plugins/data_source
pip install -e json_data_source
pip install -e xml_data_source
cd ..\..
pip install lxml
pip install django
pip install numpy
pip install networkx
python web/manage.py migrate
python web/manage.py runserver
```

---

# How the Application Works

The application is designed for **graph visualization**. Its architecture is modular and based on **plugins**, which makes it easy to extend and replace components.

## 1. Main Components

1. **API (abstraction library)**

   * Defines common interfaces for all plugins (data source and visualizers).
   * Models the core entities: `Graph`, `Node`, `Edge`.
   * Enables communication between the platform and plugins without tight coupling.

2. **Platform (core part)**

   * Manages the graph and enables operations on it.
   * Handles communication between plugins.
   * Stores the current state of the graph and workspaces.
   * Provides **search**, **filtering**, **multi-graph workspaces**, **history of changes**, and visualization in multiple views.

3. **Data source plugins**

   * Responsible for **parsing data sources** (e.g., JSON, XML).
   * Each plugin can read its format and convert it into `Graph`, `Node`, `Edge` objects.

4. **Visualizer plugins**

   * Display the graph to the user in different ways.
   * `SimpleVisualizer` provides a basic overview (node + essential info).
   * `BlockVisualizer` displays a node with all attributes in a block format.

5. **Web application (Django)**

   * Provides user interaction with graphs through a UI.
   * Uses **D3.js** on the frontend for rendering and Django templates for display.
   * Supports views: **Main View**, **Tree View**, **Bird View**.

---

## 2. Application Workflow

1. **User selects a data source**

   * The platform detects installed **data source plugins**.
   * The user chooses which source to load the graph from (e.g., JSON file).
   * The selected plugin parses the data and creates a `Graph` object.

2. **Workspace creation**

   * Each loaded graph is stored in its **workspace** along with applied filters and searches.
   * The user can work with multiple workspaces in parallel.

3. **Graph visualization**

   * The platform sends the `Graph` object to the chosen **visualizer plugin**.
   * The plugin generates the HTML/JS representation of the graph.
   * The Django app integrates it into the user interface.

4. **Graph views**

   * **Main View** – central view with pan, zoom, drag-and-drop.
   * **Tree View** – shows the graph as a tree, expandable and collapsible.
   * **Bird View** – bird’s-eye perspective of the entire graph, synchronized with Main View.

5. **Graph manipulation**

   * Users can search and filter nodes.

     * Search: by keywords (`contains`).
     * Filter: using expressions like `Age > 30`.
   * Each query results in a **new subgraph** (not just highlighting).
   * Changes are reflected in all three views.

6. **CLI support** (optional)

   * Users can also work with the graph via a command-line interface: create nodes, edit attributes, add edges, search, and filter.

---

## 3. Link Between Class Diagram and Functionality

* `Graph`, `Node`, `Edge` → data model.
* `DataSourceService` → abstraction for data loading.

  * `JsonDataSourceLoader`, `XmlDataSourceLoader` → concrete implementations.
* `QueryStrategy` → defines **search and filtering**.

  * `Search`, `Filter` → concrete implementations.
* `VisualizerPlugin` → abstract base for visualization.

  * `SimpleVisualizer`, `BlockVisualizer` → concrete implementations.
* `GraphWorkspace` → stores a graph and operation history.
* `WorkspaceManager` → enables working with multiple graphs.

---
<img width="1896" height="876" alt="image" src="https://github.com/user-attachments/assets/e8bcf60b-1717-4327-892a-39fface0ce5d" />

