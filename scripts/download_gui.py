"""Small Windows GUI for the checksum-verifying release downloader."""
import contextlib
import importlib.util
import os
from pathlib import Path
import queue
import re
import sys
import threading
import tkinter as tk
from tkinter import filedialog, ttk

ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[1]))
DATA = ROOT / 'design/os-site/downloads'
spec = importlib.util.spec_from_file_location('release_download', DATA / 'get-boralancesos.py')
downloader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(downloader)
events = queue.Queue()


class Log:
    def write(self, text):
        if text.strip(): events.put(('log', text.strip()))
    def flush(self): pass


def main():
    window = tk.Tk()
    window.title('BoralancesOS • Download V1')
    window.geometry('620x370')
    window.minsize(560, 350)
    window.configure(bg='#101827')
    style = ttk.Style()
    style.theme_use('clam')
    style.configure('TFrame', background='#101827')
    style.configure('TLabel', background='#101827', foreground='#e4edff', font=('Segoe UI', 11))
    frame = ttk.Frame(window, padding=28)
    frame.pack(fill='both', expand=True)
    ttk.Label(frame, text='BoralancesOS V1', font=('Segoe UI', 24, 'bold')).pack(anchor='w')
    ttk.Label(frame, text='Download the live / installation ISO. Each part is SHA-256 verified.').pack(anchor='w', pady=(8, 20))
    folder = tk.StringVar(value=str(Path.home() / 'Downloads' / 'BoralancesOS'))
    row = ttk.Frame(frame)
    row.pack(fill='x')
    entry = ttk.Entry(row, textvariable=folder)
    entry.pack(side='left', fill='x', expand=True)
    def browse():
        selected = filedialog.askdirectory(parent=window)
        if selected: folder.set(selected)
    chooser = ttk.Button(row, text='Choose folder', command=browse)
    chooser.pack(side='right', padx=(8, 0))
    status = tk.StringVar(value='Needs about 7.1 GiB of free space. You can close and resume later.')
    ttk.Label(frame, textvariable=status, wraplength=550).pack(anchor='w', pady=18)
    progress = ttk.Progressbar(frame, maximum=100)
    progress.pack(fill='x')
    running = [False]
    destination = [None]
    def worker(output):
        try:
            manifest, base = downloader.load_manifest(str(DATA / 'boralancesos-v1.json'))
            # Use the verified manifest bundled with this version; files come from GitHub.
            with contextlib.redirect_stdout(Log()):
                result = downloader.assemble(manifest, None, 'iso', output)
            events.put(('done', str(result)))
        except Exception as error:
            events.put(('error', str(error)))
    def start():
        if running[0]: return
        running[0] = True
        destination[0] = folder.get()
        for widget in (button, chooser, entry): widget.configure(state='disabled')
        status.set('Checking saved progress and available space…')
        threading.Thread(target=worker, args=(folder.get(),), daemon=True).start()
    button = ttk.Button(frame, text='Download ISO', command=start)
    button.pack(anchor='w', pady=18)
    def poll():
        while not events.empty():
            kind, text = events.get()
            if kind == 'log':
                match = re.search(r'Downloading (\d+)/(\d+)', text)
                if match:
                    number, count = map(int, match.groups())
                    progress['value'] = (number - 1) * 100 / count
                    status.set(f'Downloading and verifying part {number} of {count}…')
            else:
                running[0] = False
                for widget in (button, chooser, entry): widget.configure(state='normal')
                if kind == 'done':
                    progress['value'] = 100
                    status.set('ISO verified and ready: ' + text)
                    button.configure(text='Open download folder', command=lambda: os.startfile(destination[0]))
                else:
                    status.set('Download stopped: ' + text)
                    button.configure(text='Resume download')
        window.after(150, poll)
    poll()
    if '--smoke-test' in sys.argv: window.after(500, window.destroy)
    window.mainloop()


if __name__ == '__main__': main()
