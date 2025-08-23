class VisualizerNotFound(Exception):
    """
    Custom exception raised when a requested visualizer is not found.
    """
    def __init__(self, key: str):
        self.key = key
        super().__init__(f"Visualizer '{key}' not found. Please check if the visualizer is registered.")