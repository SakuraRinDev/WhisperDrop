"""PyInstaller runtime hook: ensure PortAudio DLL is findable.

In onefile mode the temp extraction directory is not on the system DLL
search path, so sounddevice's CFFI binding cannot locate libportaudio.
We add the directory to both os.environ["PATH"] and (on Python 3.8+)
os.add_dll_directory() before sounddevice is imported.
"""

import os
import sys

base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
pa_dir = os.path.join(base, "_sounddevice_data", "portaudio-binaries")

if os.path.isdir(pa_dir):
    os.environ["PATH"] = pa_dir + os.pathsep + os.environ.get("PATH", "")
    if hasattr(os, "add_dll_directory"):
        os.add_dll_directory(pa_dir)
