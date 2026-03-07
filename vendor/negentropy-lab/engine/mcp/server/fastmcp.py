# Mock MCP Library for Phase 4.1-Lite

class FastMCP:
    def __init__(self, name):
        self.name = name
        self._tools = []

    def tool(self):
        def decorator(func):
            self._tools.append(func)
            return func
        return decorator

    def resource(self, path):
        def decorator(func): return func
        return decorator

    def prompt(self, name):
        def decorator(func): return func
        return decorator

    def run(self, *args, **kwargs):
        import sys
        import time
        sys.stderr.write(f"🚀 [Mock MCP] Service '{self.name}' is simulated.\n")
        sys.stderr.write(f"Registered {len(self._tools)} tools.\n")
        # Keep alive
        while True:
            time.sleep(3600)
