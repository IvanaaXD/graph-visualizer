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

#### 2.  Set Up the project

1.  `cd ./graph-visualizer`
2.  `python -m venv .venv`
3.  `.venv/Scripts/activate`
4.  `pip install -e graph_visualizer`
5.  `cd graph_visualizer`
6.  `pip install -e api`
7.  `cd plugins/data_source`
8.  `pip install -e json_data_source`
9.  `pip install -e xml_data_source`
10. `cd ..\..`
11. `pip install lxml`
12. `pip install django`
13. `pip install numpy`
14. `pip install networkx`
15. `python web/manage.py migrate`
16. `python web/manage.py runserver`