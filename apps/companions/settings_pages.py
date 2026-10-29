"""On-demand system settings. Commands run asynchronously to keep input smooth."""
import json
import os
from pathlib import Path
import platform
import getpass
import shutil

from PySide6.QtCore import Qt, QProcess, QSize, QTimer
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import (QCheckBox, QComboBox, QFrame, QHBoxLayout, QLabel,
    QLineEdit, QListWidget, QListWidgetItem, QMessageBox, QPushButton, QScrollArea,
    QSlider, QStackedWidget, QVBoxLayout, QWidget)

CONFIG = Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config')) / 'boralances'


class SettingsPages:
    PAGE_IDS=('desktop','appearance','dock','displays','graphics','input','sound','network','gaming','storage','widgets','about')
    def build_settings(self):
        try:
            self.state = json.loads((CONFIG / 'state.json').read_text())
        except (OSError, ValueError):
            self.state = {}
        self.pending = []
        self.process = QProcess(self)
        self.process.finished.connect(self.command_finished)
        self.process.errorOccurred.connect(self.command_error)
        self.layout.setContentsMargins(0, 0, 0, 0)
        columns = QHBoxLayout()
        columns.setSpacing(0)
        self.layout.addLayout(columns, 1)
        sidebar = QFrame()
        sidebar.setObjectName('sidebar')
        sidebar.setFixedWidth(232)
        side = QVBoxLayout(sidebar)
        side.setContentsMargins(16, 24, 16, 16)
        account = QLabel('B   '+getpass.getuser()+'\n     Personal workspace')
        account.setStyleSheet('font-size:14px;font-weight:600;padding:2px 4px 15px;')
        side.addWidget(account)
        search = QLineEdit()
        search.setPlaceholderText('Search settings')
        search.setAccessibleName('Search settings categories')
        side.addWidget(search)
        self.categories = QListWidget()
        self.categories.setSpacing(2)
        self.categories.setIconSize(QSize(18, 18))
        self.categories.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.categories.setTextElideMode(Qt.TextElideMode.ElideRight)
        side.addWidget(self.categories, 1)
        columns.addWidget(sidebar)
        content = QWidget()
        right = QVBoxLayout(content)
        right.setContentsMargins(0, 0, 0, 0)
        self.pages = QStackedWidget()
        right.addWidget(self.pages, 1)
        self.feedback = QLabel('Changes are saved for your account.')
        self.feedback.setWordWrap(True)
        self.feedback.setStyleSheet('color:#9eafc9;padding:8px 26px 16px;font-size:11px;')
        right.addWidget(self.feedback)
        columns.addWidget(content, 1)
        self.categories.currentRowChanged.connect(self.pages.setCurrentIndex)
        search.textChanged.connect(self.search_categories)
        self.setStyleSheet(self.styleSheet() + '''
          QFrame#sidebar { background:rgba(216,230,255,8);border-right:1px solid rgba(255,255,255,20); }
          QListWidget { background:transparent;border:0;outline:0;font-size:12px; }
          QListWidget::item { padding:7px 8px;border-radius:8px;color:#becce1; }
          QListWidget::item:selected { background:#395878;color:#ffffff; }
          QListWidget::item:hover { background:rgba(200,220,255,18); }
          QScrollArea { background:transparent;border:0; }
          QScrollBar:vertical { background:transparent;width:6px; }
          QScrollBar::handle:vertical { background:#66758d;border-radius:3px;min-height:25px; }
          QScrollBar::add-line:vertical,QScrollBar::sub-line:vertical { height:0; }
          QCheckBox::indicator:checked { background:#a9ccff; }
          QComboBox { min-width:138px; }
        ''')
        if self.state.get('theme') == 'light':
            self.setStyleSheet(self.styleSheet() + '''
              QListWidget::item { color:#405875; }
              QListWidget::item:selected { background:#ccdef4;color:#173656; }
              QFrame#sidebar { background:rgba(70,110,170,10); }
            ''')
        self.desktop_page()
        self.appearance_page()
        self.dock_page()
        self.displays_page()
        self.graphics_page()
        self.input_page()
        self.sound_page()
        self.network_page()
        self.performance_page()
        self.storage_page()
        self.widgets_page()
        self.about_page()
        self.categories.setCurrentRow(0)
        self.stats_timer = QTimer(self)
        self.stats_timer.timeout.connect(self.refresh_stats)
        self.stats_timer.start(5000)
        self.refresh_stats()

    def search_categories(self, text):
        first = None
        for index in range(self.categories.count()):
            item = self.categories.item(index)
            hidden = text.casefold() not in item.text().casefold()
            item.setHidden(hidden)
            if not hidden and first is None:
                first = index
        if first is not None:
            self.categories.setCurrentRow(first)

    def page(self, name, subtitle, icon):
        item = QListWidgetItem(name)
        icon_file = Path('/etc/boralances/icons') / (icon + '.svg')
        if icon_file.exists():
            item.setIcon(QIcon(str(icon_file)))
        self.categories.addItem(item)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        body = QWidget()
        layout = QVBoxLayout(body)
        layout.setContentsMargins(28, 26, 28, 20)
        layout.setSpacing(12)
        self.label(name, 'headline', layout)
        self.label(subtitle, layout=layout)
        layout.addSpacing(5)
        self.pages.addWidget(scroll)
        scroll.setWidget(body)
        return layout

    def row(self, layout, title, note, control):
        card = QFrame()
        card.setObjectName('card')
        row = QHBoxLayout(card)
        row.setContentsMargins(16, 12, 16, 12)
        text = QVBoxLayout()
        heading = QLabel(title)
        heading.setStyleSheet('font-weight:600;')
        heading.setWordWrap(True)
        text.addWidget(heading)
        if note:
            detail = QLabel(note)
            detail.setWordWrap(True)
            detail.setStyleSheet('color:' + ('#596e88' if self.state.get('theme') == 'light' else '#a8b8d1') + ';font-size:11px;')
            text.addWidget(detail)
        row.addLayout(text, 1)
        row.addSpacing(10)
        row.addWidget(control)
        layout.addWidget(card)

    def combo(self, key, choices, default):
        combo = QComboBox()
        for title, value in choices:
            combo.addItem(title, value)
        combo.setCurrentIndex(max(0, combo.findData(self.state.get(key, default))))
        combo.currentIndexChanged.connect(lambda _i: self.set_preference(key, combo.currentData()))
        return combo

    def switch(self, key, default=False):
        box = QCheckBox()
        box.setAccessibleName(key.replace('-', ' '))
        box.setChecked(self.state.get(key, 'true' if default else 'false') == 'true')
        box.toggled.connect(lambda value: self.set_preference(key, 'true' if value else 'false'))
        return box

    def action(self, title, *args):
        button = QPushButton(title)
        button.clicked.connect(lambda _checked=False: self.open_app(*args))
        return button

    def set_preference(self, key, value):
        if key in ('theme', 'profile'):
            self.dispatch('boralances-control', key, value)
        else:
            self.dispatch('boralances-control', 'set', key, value)

    def dispatch(self, *args):
        self.pending.append(args)
        if self.process.state() == QProcess.ProcessState.NotRunning:
            self.next_command()

    def next_command(self):
        if not self.pending:
            return
        args = self.pending.pop(0)
        self.feedback.setText('Applying your setting…')
        self.process.start(args[0], list(args[1:]))

    def command_finished(self, code, _status):
        if code == 0:
            self.feedback.setText('Saved. Your desktop is up to date.')
        else:
            error = bytes(self.process.readAllStandardError()).decode(errors='replace').strip()
            self.feedback.setText('Could not apply this setting. ' + error[-180:])
        QTimer.singleShot(0, self.next_command)

    def command_error(self, error):
        if error == QProcess.ProcessError.FailedToStart:
            self.feedback.setText('This control needs the installed BoralancesOS desktop.')
            QTimer.singleShot(0, self.next_command)

    def open_app(self, *args):
        started, _pid = QProcess.startDetached(args[0], list(args[1:]))
        self.feedback.setText('Opened.' if started else 'This application is unavailable.')

    def desktop_page(self):
        page = self.page('Desktop', 'A familiar place to work, with floating windows and a visible application dock.', 'boralances-os')
        self.row(page, 'Window arrangement', 'Applies to newly opened windows. Super+V toggles the current window.',
                 self.combo('layout', [('Floating windows', 'floating'), ('Dynamic tiling', 'tiling')], 'floating'))
        self.row(page, 'Workspace overview', 'Switch windows across your desktops. Super+Tab.', self.action('Open overview', 'boralances-overview-ui'))
        self.row(page, 'Spotlight-style search', 'Search and launch installed applications. Super+Space.', self.action('Search apps', 'rofi', '-show', 'drun'))
        self.row(page, 'Dock & menu bar', 'Restart navigation without logging out. Super+Ctrl+R.', self.action('Repair desktop', 'boralances-control', 'shell-restart'))
        self.row(page, 'Your account', 'Change your login and sudo password.', self.action('Change password', 'boralances-terminal', '-e', 'passwd'))
        page.addStretch()

    def appearance_page(self):
        page = self.page('Appearance', 'Quiet colors, considered contrast, and static wallpapers that stay light on resources.', 'boralances-glass-connect')
        self.row(page, 'Appearance', 'New native windows follow your chosen appearance.', self.combo('theme', [('Dark', 'dark'), ('Light', 'light'), ('Follow system', 'system')], 'dark'))
        self.row(page, 'Accent color', 'Window borders and active workspace indicators.', self.combo('accent', [('Ocean blue', 'blue'), ('Lilac', 'purple'), ('Mint', 'mint'), ('Apricot', 'orange')], 'blue'))
        self.row(page, 'Wallpaper', 'Original BoralancesOS artwork. No animated background process.', self.combo('wallpaper', [('Coast', 'coast'), ('Dusk', 'dusk'), ('Graphite', 'graphite'), ('Aurora', 'aurora')], 'coast'))
        self.row(page, 'Desktop effects', 'Fluid animates windows without expensive background blur.', self.combo('profile', [('Fluid (recommended for VM)', 'fluid'), ('Performance', 'performance'), ('Balanced', 'balanced'), ('Liquid Glass', 'glass'), ('Reduce motion', 'reduced-motion')], 'fluid'))
        self.row(page,'Glass surface opacity','Controls translucent Boralances panels in Liquid Glass mode.',self.combo('glass-opacity',[(f'{n}%',str(n)) for n in (45,55,68,75,85,95)],'68'))
        self.row(page,'App window opacity','Applies to app windows in Liquid Glass mode. Choose 100% for solid app content.',self.combo('window-opacity',[(f'{n}%',str(n)) for n in (85,90,94,97,100)],'94'))
        self.row(page,'Corner radius','Window and shell corner shape.',self.combo('corner-radius',[(f'{n} px',str(n)) for n in (8,12,16,20,24,28)],'24'))
        self.row(page,'Motion strength','Animation style for Liquid Glass. Optimization and Reduce Motion disable it.',self.combo('motion-intensity',[('Subtle','subtle'),('Smooth','normal'),('Expressive','expressive')],'normal'))
        page.addStretch()

    def dock_page(self):
        page = self.page('Dock & Menu Bar', 'Your pinned apps and running windows, always within reach.', 'boralances-launcher')
        self.row(page, 'Automatically hide the dock', 'Off by default so navigation stays visible.', self.switch('dock-autohide'))
        self.row(page, 'Position on screen', 'A permanent dock reserves space for your windows.', self.combo('dock-position', [('Bottom', 'bottom'), ('Left', 'left'), ('Right', 'right')], 'bottom'))
        self.row(page, 'Icon size', 'Choose comfortable targets for your screen.', self.combo('dock-size', [(f'{n} px', str(n)) for n in (32, 40, 48, 56, 64)], '48'))
        self.row(page,'Dock magnification','Icons lift and grow around the pointer in Liquid Glass mode.',self.switch('dock-magnification',True))
        self.row(page, 'Show resource meters', 'Keep the menu bar calm, or show CPU and RAM.', self.switch('menu-details'))
        self.row(page, 'Menu bar size', 'A compact strip or larger click targets.', self.combo('menu-size',[('Compact','compact'),('Normal','normal'),('Large','large')],'normal'))
        self.row(page, 'Clock', 'Date and time in the menu bar.', self.combo('clock-format', [('24-hour', '24h'), ('12-hour', '12h')], '24h'))
        self.label('Right-click a dock icon to pin an app, close a window, float it or enter full screen.', layout=page)
        page.addStretch()

    def displays_page(self):
        page = self.page('Displays', 'Resolution, scaling and arrangement for your connected screens.', 'boralances-glass-connect')
        self.row(page, 'Display configuration', 'Choose a comfortable resolution, refresh rate and scale.', self.action('Configure', 'nwg-displays'))
        self.row(page, 'Display information', 'Inspect the displays detected by the current desktop.', self.action('View displays', 'boralances-glass-connect'))
        self.row(page, 'Capture a region', 'Select, annotate, save or copy. Super+Shift+4.', self.action('Take screenshot', 'boralances-control', 'screenshot'))
        self.row(page, 'Capture the desktop', 'Save a PNG to Pictures/Screenshots. Super+Shift+3.', self.action('Save screenshot', 'boralances-control', 'screenshot-full'))
        page.addStretch()

    def input_page(self):
        page = self.page('Keyboard & Mouse', 'Make typing, pointing and scrolling feel right.', 'boralances-terminal')
        self.row(page,'Click desktop to minimize','Click the bare wallpaper to minimize the current app. Panels close automatically.',self.switch('desktop-click-minimize',True))
        self.row(page, 'Keyboard layout', 'Alt+Shift switches between enabled layouts.', self.combo('keyboard-layout', [('English + Turkish', 'us,tr'), ('English (US)', 'us'), ('Turkish Q', 'tr')], 'us,tr'))
        self.row(page, 'Caps Lock acts as Escape', 'Useful for editors and terminal workflows.', self.switch('caps-escape'))
        self.row(page, 'Pointer speed', 'Applies immediately to your pointing devices.', self.combo('pointer-speed', [('Slow', '-0.5'), ('Normal', '0'), ('Fast', '0.3'), ('Faster', '0.6')], '0'))
        self.row(page, 'Natural touchpad scrolling', 'Move content in the direction of your fingers.', self.switch('natural-scroll', True))
        self.row(page, 'Tap to click', 'Tap the touchpad instead of pressing it.', self.switch('tap-to-click', True))
        self.label('Windows key: apps · Alt+F4: close · Alt+Tab: switch windows\nWin+E: Files · Win+I: Settings · Win+A: quick settings · Win+D: desktop\nWin+Left/Right: snap · Win+Up: maximize · Win+Down: restore/minimize\nWin+L: lock · Win+R: Run · Ctrl+Shift+Esc: Activity Monitor\nWin+M: minimize · Win+Shift+M: restore · Win+Ctrl+Left/Right: desktops', layout=page)
        page.addStretch()

    def sound_page(self):
        page = self.page('Sound & Notifications', 'Control your outputs, microphone, notifications and focus.', 'boralances-jarvis')
        self.row(page, 'Sound', 'Select devices, adjust volume and test inputs.', self.action('Sound settings', 'pavucontrol'))
        self.row(page, 'Do Not Disturb', 'Pause notification banners until you turn this off.', self.switch('notifications-paused'))
        self.row(page, 'Notification history', 'Show the most recent notification again.', self.action('Show previous', 'dunstctl', 'history-pop'))
        self.row(page, 'Lock after inactivity', 'Native installs lock and then blank the display. VirtualBox uses host idle management; Win+L locks manually.', self.combo('lock-minutes', [(f'{n} minutes', str(n)) for n in (5, 10, 15, 30, 60)], '10'))
        self.row(page, 'Lock screen', 'Keep your current apps open. Super+Shift+L.', self.action('Lock now', 'hyprlock'))
        page.addStretch()

    def network_page(self):
        page = self.page('Network', 'Manage wired connections, Wi-Fi profiles and saved networks.', 'boralances-browser')
        self.row(page, 'Connections', 'Edit network profiles and connection security.', self.action('Network settings', 'nm-connection-editor'))
        self.row(page, 'Connection details', 'Inspect NetworkManager status in a terminal.', self.action('Open status', 'boralances-terminal', '-e', 'nmtui'))
        self.label('VirtualBox uses a wired NAT connection. Wi-Fi controls appear when a wireless adapter is available to the guest.', layout=page)
        page.addStretch()

    def performance_page(self):
        page = self.page('Gaming & Performance', 'Use fewer effects when responsiveness matters most.', 'boralances-launcher')
        self.row(page,'Startup mode','Remember your selected theme, or explicitly choose a fixed startup mode.',self.combo('startup-profile',[('Remember last mode','last-used'),('Optimization','performance'),('Fluid','fluid'),('Balanced','balanced'),('Liquid Glass','glass')],'last-used'))
        self.stats = self.label('Reading system memory…', layout=page)
        self.row(page, 'Desktop profile', 'Fluid keeps window animations light in VirtualBox.', self.combo('profile', [('Fluid (recommended for VM)', 'fluid'), ('Performance', 'performance'), ('Balanced', 'balanced'), ('Liquid Glass', 'glass'), ('Reduce motion', 'reduced-motion')], 'fluid'))
        self.row(page, 'Activity monitor', 'Processes, CPU, memory and storage activity.', self.action('Open monitor', 'boralances-terminal', '-e', 'btop'))
        self.row(page, 'Steam', 'Your library and Proton compatibility settings.', self.action('Open Steam', 'steam'))
        self.row(page, 'Boralances Launcher', 'Minecraft instances, Java versions and mod management.', self.action('Open launcher', 'boralances-launcher'))
        self.row(page, 'Lutris', 'Manage installed games and compatibility runners.', self.action('Open Lutris', 'lutris'))
        self.label('GameMode reduces desktop effects while a game is active. VirtualBox exposes a virtual GPU; game performance differs from a native installation.', layout=page)
        page.addStretch()

    def storage_page(self):
        page = self.page('Storage & Apps', 'Keep your files organized and see available space.', 'boralances-files')
        self.disk = self.label('', layout=page)
        self.row(page, 'Files', 'Home, removable devices and network locations.', self.action('Open Files', 'thunar'))
        self.row(page, 'Downloads', 'Your downloaded files and application bundles.', self.action('Open Downloads', 'thunar', str(Path.home() / 'Downloads')))
        self.row(page, 'Trash', 'Review deleted files before emptying the trash.', self.action('Open Trash', 'thunar', 'trash:///'))
        self.row(page, 'Installed applications', 'Search your installed Linux apps and tools.', self.action('Browse apps', 'rofi', '-show', 'drun'))
        self.label('AppImages and Windows applications depend on their runtime and graphics requirements. Launchers and games keep their normal graphics environment.', layout=page)
        page.addStretch()

    def graphics_page(self):
        page=self.page('Graphics & GPU','Native NVIDIA, AMD Radeon and Ryzen integrated graphics. VirtualBox exposes a virtual adapter.','boralances-gpu')
        self.label('The right driver for your hardware.','headline',page)
        self.row(page,'GPU & Device Center','NVIDIA tools, GPU monitoring, USB devices, microphone and output selection.',self.action('Open center','boralances-gpu-center'))
        self.row(page,'Detected graphics','View the PCI GPU, loaded kernel driver and setup commands.',self.action('Inspect GPUs','boralances-terminal','-e','boralancesos','gpu'))
        self.row(page,'AMD Radeon / Ryzen Radeon','Mesa OpenGL, RADV Vulkan and 32-bit graphics are included. Linux loads amdgpu for supported devices.',self.action('Vulkan diagnostics','boralances-terminal','-e','boralancesos','gpu','test'))
        self.row(page,'NVIDIA GTX 16 / RTX 20 and newer','On a native installation, prepare the NVIDIA open-module driver and hybrid PRIME offload, then reboot.',self.action('NVIDIA setup…','boralances-terminal','-e','sudo','boralancesos','drivers','nvidia','install'))
        self.row(page,'AMD native boot profile','Enable early amdgpu initialization on a native AMD installation. Not needed for ordinary working graphics.',self.action('AMD setup…','boralances-terminal','-e','sudo','boralancesos','drivers','amd','install'))
        self.label('Native installations use a newer pinned kernel; this VirtualBox configuration keeps the tested 6.12 compatibility kernel. Legacy NVIDIA GPUs need an appropriate driver branch. CPU branding alone does not identify a GPU. Driver setup needs network access and free disk space.',layout=page)
        self.label('Use a discrete GPU: boralancesos gpu run <application>\nUnreal Engine: boralancesos unreal guide',layout=page)
        page.addStretch()

    def about_page(self):
        page = self.page('About & Power', 'BoralancesOS V1 · Your system and developer tools', 'boralances-os')
        self.label('Designed for a clear, familiar workspace.', 'headline', page)
        self.label(f'Linux {platform.release()} · {os.cpu_count()} logical processors\nWayland desktop · Original Boralances artwork', layout=page)
        self.row(page,'GPU & devices','Inspect detected graphics, audio and adapters.',self.action('Hardware information','boralances-terminal','-e','boralancesos','gpu'))
        self.row(page,'NVIDIA & Unreal Engine','Native PC installation is required for the physical NVIDIA GPU. Epic supplies the Linux editor.',self.action('Unreal setup guide','boralances-terminal','-e','boralancesos','unreal','guide'))
        self.label('Terminal commands: boralancesos install <package> · search <package> · gpu · devices · audio · wifi · disks · unreal guide\nNative NVIDIA setup: sudo boralancesos drivers nvidia install\nUnreal launch: boralancesos unreal run /path/to/Engine/Binaries/Linux/UnrealEditor',layout=page)
        self.row(page, 'Session', 'Close your apps and return to the login screen.', self.power_action('Log out', 'uwsm', 'stop'))
        self.row(page, 'Restart', 'Restart BoralancesOS.', self.power_action('Restart…', 'systemctl', 'reboot'))
        self.row(page, 'Power off', 'Shut down this machine.', self.power_action('Shut down…', 'systemctl', 'poweroff'))
        page.addStretch()

    def widgets_page(self):
        from widget_catalog import WIDGETS
        page=self.page('Widgets & Calendar','A little information, right where you need it.','boralances-glass-connect')
        self.label('Drag any widget by its title to place it anywhere. Drag the date above the clock to move the clock. Positions are saved for your account.',layout=page)
        self.row(page,'Desktop clock','Date and time, behind your windows.',self.switch('widget-clock'))
        self.row(page,'System monitor widget','Memory use and system load. Updates every five seconds.',self.switch('widget-monitor'))
        self.row(page,'Widget position','Place your widgets near the top of the desktop.',self.combo('widget-position',[('Center','center'),('Left','left'),('Right','right')],'center'))
        self.row(page,'Clock size','Choose a subtle or prominent desktop clock.',self.combo('widget-clock-size',[('Small','small'),('Large','large')],'large'))
        self.row(page,'Calendar week numbers','Show ISO week numbers in the calendar.',self.switch('calendar-week-numbers'))
        self.row(page,'Calendar','Click the menu-bar date any time.',self.action('Open calendar','boralances-control','calendar'))
        self.row(page,'Task Manager','Processes, CPU, memory and storage activity.',self.action('Open Task Manager','boralances-task-manager'))
        for key,title,description in WIDGETS:
            self.row(page,title,description,self.switch('widget-'+key))
        self.row(page,'Keyboard shortcuts','Familiar Windows shortcuts and workspace controls.',self.action('Show shortcuts','boralances-shortcuts'))
        page.addStretch()

    def power_action(self, label, *args):
        button = QPushButton(label)
        button.clicked.connect(lambda: self.confirm_power(label, args))
        return button

    def confirm_power(self, label, args):
        answer = QMessageBox.question(self, label, 'Save your work before continuing. Continue?',
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No, QMessageBox.StandardButton.No)
        if answer == QMessageBox.StandardButton.Yes:
            self.dispatch(*args)

    def refresh_stats(self):
        if not self.isVisible():
            return
        try:
            values = {line.split(':')[0]: int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines() if ':' in line}
            used = (values['MemTotal'] - values['MemAvailable']) / 1024
            self.stats.setText(f'{used:,.0f} MiB memory in use · {os.cpu_count()} logical processors')
        except (OSError, ValueError, KeyError):
            self.stats.setText('Memory statistics are available inside BoralancesOS.')
        try:
            usage = shutil.disk_usage(Path.home())
            self.disk.setText(f'{usage.free / 2**30:.1f} GiB available of {usage.total / 2**30:.1f} GiB')
        except OSError:
            self.disk.setText('Storage information is unavailable.')
