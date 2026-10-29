"""On-demand Linux companions. No background audio or remote control service."""
from datetime import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import sys

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import (QApplication, QGridLayout, QGroupBox, QHBoxLayout,
    QLabel, QLineEdit, QMainWindow, QMessageBox, QPushButton, QScrollArea, QTextEdit,
    QVBoxLayout, QWidget)


def output(*args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=10)
    return result.stdout.strip() or result.stderr.strip()


def launch(*args):
    subprocess.Popen(args, start_new_session=True)


class Base(QMainWindow):
    def __init__(self, title, subtitle):
        super().__init__()
        self.setWindowTitle(title + ' · BoralancesOS')
        self.resize(800, 590)
        root = QWidget()
        self.layout = QVBoxLayout(root)
        self.layout.setContentsMargins(32, 28, 32, 28)
        self.layout.setSpacing(16)
        heading = QLabel(title)
        heading.setStyleSheet('font-size:30px;font-weight:600;')
        self.layout.addWidget(heading)
        note = QLabel(subtitle)
        note.setWordWrap(True)
        self.layout.addWidget(note)
        self.setCentralWidget(root)
        self.setStyleSheet('''
            QMainWindow,QWidget{background:#101827;color:#eaf0ff;font:14px Inter;}
            QPushButton,QLineEdit{background:#23314c;border:1px solid #536383;border-radius:12px;padding:12px;}
            QPushButton:hover{background:#304262;} QPushButton:focus{border:2px solid #acd0ff;}
            QTextEdit,QGroupBox{background:#19243a;border:1px solid #374965;border-radius:12px;padding:12px;}
            QGroupBox{margin-top:12px;} QGroupBox::title{subcontrol-origin:margin;left:12px;}
        ''')

    def button(self, title, callback):
        button = QPushButton(title)
        button.clicked.connect(callback)
        self.layout.addWidget(button)
        return button


class Jarvis(Base):
    def __init__(self):
        super().__init__('JARVIS', 'A quiet workspace companion. Local commands run only when you ask.')
        self.transcript = QTextEdit()
        self.transcript.setReadOnly(True)
        self.layout.addWidget(self.transcript, 1)
        self.input = QLineEdit()
        self.input.setPlaceholderText('Try “time”, “open browser”, “note …”, “timer 5 minutes”, or “help”')
        self.input.returnPressed.connect(self.submit)
        self.layout.addWidget(self.input)
        self.button('Run command', self.submit)
        self.respond('Linux edition: typed commands, notes, timers, media and scrcpy. Voice wake, AI chat and Windows remote control have not been ported.')
        self.timers = []
        self.notes = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share')) / 'boralances-jarvis/notes.txt'

    def respond(self, text):
        # Plain text prevents markup injection from saved notes or command output.
        self.transcript.insertPlainText('JARVIS  ' + text + '\n\n')

    def submit(self):
        text = self.input.text().strip()
        self.input.clear()
        if not text:
            return
        self.transcript.insertPlainText('You  ' + text + '\n')
        lower = text.lower()
        try:
            commands = {'open browser': ['boralances-browser'], 'open files': ['thunar'],
                        'open calculator': ['qalculate-gtk'], 'open launcher': ['boralances-launcher'],
                        'glass connect': ['boralances-glass-connect'], 'mirror phone': ['scrcpy'],
                        'play music': ['playerctl', 'play'], 'pause music': ['playerctl', 'pause'],
                        'mute': ['wpctl', 'set-mute', '@DEFAULT_AUDIO_SINK@', 'toggle']}
            if lower in ('time', 'saat kaç'):
                self.respond(datetime.now().strftime('%H:%M'))
            elif lower == 'date':
                self.respond(datetime.now().strftime('%A, %d %B %Y'))
            elif lower in commands:
                launch(*commands[lower])
                self.respond('Opened ' + lower + '.')
            elif lower.startswith('search for '):
                launch('boralances-browser', text[11:])
                self.respond('Opened your search in BoralancesBrowser.')
            elif lower.startswith('note '):
                self.notes.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with self.notes.open('a', encoding='utf-8') as stream:
                    stream.write(datetime.now().isoformat(timespec='minutes') + '  ' + text[5:] + '\n')
                self.respond('Note saved locally.')
            elif lower == 'show notes':
                self.respond(self.notes.read_text(encoding='utf-8') if self.notes.exists() else 'No notes yet.')
            elif lower in ('system status', 'durum'):
                self.respond(output('free', '-h'))
            elif match := re.fullmatch(r'(?:set a )?timer(?: for)? (\d+) (seconds?|minutes?)', lower):
                seconds = int(match[1]) * (60 if match[2].startswith('minute') else 1)
                if not 1 <= seconds <= 86400:
                    self.respond('Choose a timer between one second and one day.')
                    return
                timer = QTimer(self)
                timer.setSingleShot(True)
                timer.timeout.connect(lambda: (self.respond('Your timer has finished.'),
                    launch('notify-send', 'JARVIS', 'Your timer has finished.')))
                timer.start(seconds * 1000)
                self.timers.append(timer)
                self.respond('Timer set. Keep JARVIS open until it finishes.')
            else:
                self.respond('Commands: time, date, system status, open browser/files/calculator/launcher, search for …, note …, show notes, timer 5 minutes, mirror phone, glass connect, play music, pause music, mute. No arbitrary shell commands are executed.')
        except (OSError, subprocess.SubprocessError) as error:
            self.respond('Could not complete that command: ' + str(error))


class GlassConnect(Base):
    def __init__(self):
        super().__init__('Glass Connect', 'Display tools and your Liquid Glass workspace. Changes use the current Wayland session.')
        self.monitors = QTextEdit()
        self.monitors.setReadOnly(True)
        self.layout.addWidget(self.monitors, 1)
        self.button('Refresh connected displays', self.refresh)
        self.button('Open display configuration', lambda: launch('nwg-displays'))
        self.button('Preview glass in BoralancesBrowser', lambda: launch('boralances-browser'))
        self.button('Appearance & performance', lambda: launch('boralances-control', 'settings'))
        self.refresh()

    def refresh(self):
        try:
            result = output('hyprctl', '-j', 'monitors')
            displays = json.loads(result)
            self.monitors.setPlainText('\n\n'.join(
                f'{d["name"]} · {d.get("description", "")}\n{d["width"]} × {d["height"]} @ {d["refreshRate"]:.1f} Hz · scale {d["scale"]}'
                for d in displays))
        except (OSError, ValueError, KeyError, subprocess.SubprocessError):
            self.monitors.setPlainText('Open this tool inside a BoralancesOS Hyprland session to inspect displays.')


class Overview(Base):
    def __init__(self):
        super().__init__('Your workspaces', 'Choose a window to return to it. This lightweight overview shows titles, without live screen capture.')
        self.resize(1060, 680)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content = QWidget()
        grid = QGridLayout(content)
        self.layout.addWidget(scroll, 1)
        scroll.setWidget(content)
        try:
            clients = json.loads(output('hyprctl', '-j', 'clients'))
            groups = {}
            for client in clients:
                if client.get('mapped', True):
                    groups.setdefault(client['workspace']['name'], []).append(client)
            for index, (name, windows) in enumerate(sorted(groups.items())):
                group = QGroupBox('Workspace ' + name)
                column = QVBoxLayout(group)
                for window in windows:
                    address = window['address']
                    if not re.fullmatch(r'0x[0-9a-fA-F]+', address):
                        continue
                    button = QPushButton(f'{window.get("class", "Application")}\n{window.get("title", "")[:65]}')
                    button.clicked.connect(lambda _checked=False, address=address: self.focus(address))
                    column.addWidget(button)
                grid.addWidget(group, index // 3, index % 3)
            if not groups:
                grid.addWidget(QLabel('Your workspace is clear. Super+Space opens applications.'), 0, 0)
        except (OSError, ValueError, KeyError, subprocess.SubprocessError):
            grid.addWidget(QLabel('Workspace overview needs a running Hyprland session.'), 0, 0)

    def focus(self, address):
        # Address has been checked against a hex-only pattern, never a title.
        subprocess.run(['hyprctl', 'eval', f'hl.dispatch(hl.dsp.focus({{window="address:{address}"}})); hl.dispatch(hl.dsp.window.bring_to_top())'], check=False)
        self.close()


if __name__ == '__main__':
    from experience import Welcome, ControlCenter, Installer, Shortcuts
    from quick_settings import QuickSettings
    from calendar_panel import CalendarPanel
    from system_menu import SystemMenu,NavigationMenu
    from launcher_menu import LauncherMenu
    from device_centers import DeviceCenter
    from window_switcher import WindowSwitcher
    from workspaces import Workspaces
    from hardware_center import HardwareCenter
    application = QApplication(sys.argv)
    application.setApplicationName('BoralancesOS')
    mode = sys.argv[1] if len(sys.argv) > 1 else 'jarvis'
    QIcon.setThemeName('Boralances')
    icon_name={'gpu-center':'gpu','nvidia-center':'nvidia','devices':'usb','audio-center':'sound','control-center':'settings','overview-ui':'overview','window-switcher':'overview','workspaces':'workspaces','welcome':'os'}.get(mode,mode)
    application.setWindowIcon(QIcon('/etc/boralances/icons/boralances-'+icon_name+'.svg'))
    application.setDesktopFileName({'control-center': 'boralances-settings',
        'overview-ui': 'boralances-overview', 'quick-settings': 'boralances-quick-settings', 'calendar': 'boralances-calendar'}.get(mode, 'boralances-' + mode))
    factories = {'workspaces':Workspaces,'window-switcher':lambda:WindowSwitcher('--previous' in sys.argv),'file-menu':lambda:NavigationMenu('file-menu'),'go-menu':lambda:NavigationMenu('go-menu'),'jarvis': Jarvis, 'glass-connect': GlassConnect, 'overview-ui': Overview,
              'welcome': Welcome, 'control-center': ControlCenter, 'quick-settings': QuickSettings, 'calendar': CalendarPanel, 'system-menu': SystemMenu, 'shortcuts': Shortcuts, 'start-menu': LauncherMenu, 'center': lambda:DeviceCenter(sys.argv[sys.argv.index('--section')+1] if '--section' in sys.argv else 'network'), 'installer': Installer}
    factories.update({'gpu-center':HardwareCenter,'nvidia-center':lambda:HardwareCenter('nvidia'),'devices':lambda:HardwareCenter('devices'),'audio-center':lambda:HardwareCenter('audio')})
    window=factories[mode]()
    if mode == 'control-center' and '--page' in sys.argv:
        index = sys.argv.index('--page') + 1
        pages = window.PAGE_IDS
        if index < len(sys.argv) and sys.argv[index] in pages:
            window.categories.setCurrentRow(pages.index(sys.argv[index]))
    if mode in ('quick-settings','calendar','system-menu','start-menu','center','file-menu','go-menu','workspaces','window-switcher'):
        from panel_behavior import PanelBehavior
        window.panel_behavior=PanelBehavior(window)
    window.show()
    raise SystemExit(application.exec())
