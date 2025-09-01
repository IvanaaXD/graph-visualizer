from core.workspace import GraphWorkspace

class WorkspaceManager:
    def __init__(self):
        self.workspaces: dict[str, GraphWorkspace] = {}
        self.active_id: str | None = None
        self.counter = 1
    
    def create_workspace(self, graph=None):
        wspace_id = f"workspace{self.counter}"
        self.counter += 1
        wspace = GraphWorkspace(graph = graph)
        self.workspaces[wspace_id] = wspace
        self.active_id = wspace_id
        return wspace_id, wspace
    
    def close_workspace(self, wspace_id: str):
        if wspace_id in self.workspaces and len(self.workspaces) > 1:
            del self.workspaces[wspace_id]
            if self.active_id == wspace_id:
                self.active_id = next(iter(self.workspaces.keys()))
            
    def switch_workspace(self, wspace_id: str):
        if wspace_id in self.workspaces:
            self.active_id = wspace_id
    
    def get_active(self) -> GraphWorkspace:
        return self.workspaces.get(self.active_id)
    
    def get_all(self):
        return self.workspaces

