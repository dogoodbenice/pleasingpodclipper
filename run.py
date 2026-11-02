#!/usr/bin/env python3
"""
PleasingPodClipper Launcher
Starts the backend and opens the studio in your browser.
"""

import os
import sys
import subprocess
import webbrowser
import time
import signal
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(BASE_DIR, "venv", "bin", "python")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

if not os.path.exists(VENV_PYTHON):
    print("Virtual environment not found! Please run setup first.")
    sys.exit(1)

def run():
    print("=" * 60)
    print("🎙️  Starting PleasingPodClipper Studio...")
    print("=" * 60)

    is_dev = "--dev" in sys.argv

    # 1. Start FastAPI Backend
    backend_cmd = [
        VENV_PYTHON, "-m", "uvicorn",
        "backend.main:app",
        "--host", "127.0.0.1",
        "--port", "8000"
    ]
    if is_dev:
        backend_cmd.append("--reload")

    backend_proc = subprocess.Popen(backend_cmd, cwd=BASE_DIR)

    frontend_proc = None
    target_url = "http://127.0.0.1:8000/"

    if is_dev:
        print("⚡ Starting Vite dev server...")
        frontend_proc = subprocess.Popen(["npm", "run", "dev"], cwd=FRONTEND_DIR)
        target_url = "http://localhost:5173/"

    # Wait for server to become responsive
    print("⏳ Waiting for server to start...")
    ready = False
    for _ in range(20):
        time.sleep(0.3)
        if backend_proc.poll() is not None:
            print("❌ Backend failed to start. Exiting.")
            sys.exit(1)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1) as resp:
                if resp.status == 200:
                    ready = True
                    break
        except Exception:
            continue

    if not ready:
        print("⚠️ Warning: Server is taking longer than expected to respond.")

    print(f"\n🚀 Studio ready! Opening browser at: {target_url}\n")
    print("Press CTRL+C in this terminal to stop the studio.\n")
    try:
        webbrowser.open(target_url)
    except Exception:
        pass

    def shutdown(sig, frame):
        print("\n🛑 Shutting down PleasingPodClipper...")
        backend_proc.terminate()
        if frontend_proc:
            frontend_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        backend_proc.wait()
    except KeyboardInterrupt:
        shutdown(None, None)

if __name__ == "__main__":
    run()
