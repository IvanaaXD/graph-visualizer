#!/usr/bin/env python
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "gvsite.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
