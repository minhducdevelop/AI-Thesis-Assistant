"""Start the backend server directly."""
import subprocess
import os
import sys

backend_dir = os.path.dirname(__file__)
venv_py = os.path.join(backend_dir, 'venv', 'Scripts', 'python.exe')

if not os.path.exists(venv_py):
    print(f"ERROR: venv python not found at {venv_py}")
    sys.exit(1)

print(f"Starting uvicorn from {backend_dir}...")
subprocess.Popen(
    [venv_py, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    creationflags=subprocess.CREATE_NEW_CONSOLE,
    cwd=backend_dir
)
print("Backend server launched in a new window!")
