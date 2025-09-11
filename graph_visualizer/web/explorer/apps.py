import importlib
import sys
from pathlib import Path
from django.apps import AppConfig

class ExplorerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'explorer'

    def ready(self):
        # /.../graph_visualizer/web/explorer/apps.py → parents[2] = /.../graph_visualizer
        project_root = Path(__file__).resolve().parents[2]
        pr = str(project_root)
        if pr not in sys.path:
            sys.path.insert(0, pr)

        importlib.import_module("plugins.visualizer.simple_visualizer")
        importlib.import_module("plugins.visualizer.block_visualizer")

