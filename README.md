### Graph Visualizer

Welcome to `Graph Visualizer`! This application is a powerful platform for visualizing complex graphs, allowing you to display data in an intuitive and interactive way.

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

First, clone the project from GitHub:

```bash
git clone [URL_of_your_repository]
cd graph-visualizer
```

#### 2. Set Up the Project

This section provides a streamlined guide for setting up the virtual environment and installing all necessary components.

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