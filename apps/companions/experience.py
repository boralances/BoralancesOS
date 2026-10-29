"""Native first-run, control center and mounted-target installer surfaces."""
import json
import os
import re
from pathlib import Path
import subprocess

from account_setup import validate_account
from disk_setup import list_blank_disks
from PySide6.QtCore import Qt, QProcess, QSize, QTimer, QFileSystemWatcher
from PySide6.QtGui import QIcon, QPixmap
from PySide6.QtWidgets import (QCheckBox, QComboBox, QFrame, QGridLayout, QHBoxLayout,
    QLabel, QLineEdit, QMainWindow, QMessageBox, QProgressBar, QPushButton,
    QSlider, QStackedWidget, QTextEdit, QVBoxLayout, QWidget)

ROOT = Path(__file__).resolve().parents[2]
ASSETS = Path('/etc/boralances') if Path('/etc/boralances').exists() else ROOT / 'assets'
CONFIG = Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config')) / 'boralances'


def icon_path(name):
    path = ASSETS / 'icons' / (name + '.svg')
    return str(path)


def command(*args):
    return subprocess.run(args, capture_output=True, text=True, timeout=8)


class TitleBar(QFrame):
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton and self.window().windowHandle():
            self.window().windowHandle().startSystemMove()


class GlassWindow(QMainWindow):
    def __init__(self, title, width=900, height=620):
        super().__init__()
        self.setWindowTitle(title + ' · BoralancesOS')
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.resize(width, height)
        self.setMinimumSize(650, 480)
        root = QFrame()
        root.setObjectName('surface')
        self.outer = QVBoxLayout(root)
        self.outer.setContentsMargins(0, 0, 0, 0)
        self.outer.setSpacing(0)
        bar = TitleBar()
        bar.setObjectName('titlebar')
        row = QHBoxLayout(bar)
        row.setContentsMargins(18, 12, 18, 12)
        for color, label, callback in [('#ff6a6d', 'Close', self.close), ('#f6c253', 'Minimize', self.showMinimized), ('#64ce88', 'Maximize', lambda: self.showNormal() if self.isMaximized() else self.showMaximized())]:
            button = QPushButton()
            button.setFixedSize(12, 12)
            button.setAccessibleName(label)
            button.setToolTip(label)
            button.setStyleSheet(f'background:{color};border:1px solid #00000018;border-radius:6px;padding:0;')
            button.clicked.connect(callback)
            row.addWidget(button)
        row.addStretch()
        label = QLabel(title)
        label.setObjectName('windowtitle')
        row.addWidget(label)
        row.addStretch()
        row.addSpacing(50)
        self.outer.addWidget(bar)
        self.body = QWidget()
        self.layout = QVBoxLayout(self.body)
        self.layout.setContentsMargins(38, 28, 38, 30)
        self.layout.setSpacing(18)
        self.outer.addWidget(self.body, 1)
        self.setCentralWidget(root)
        style = '''
          QWidget { color:#eaf0ff; font:13px Inter,"Segoe UI"; background:transparent; }
          QFrame#surface { background:rgba(21,29,48,215); border:1px solid #ffffff38; border-radius:22px; }
          QFrame#titlebar { background:rgba(220,235,255,9); border-bottom:1px solid #ffffff16; border-top-left-radius:22px; border-top-right-radius:22px; }
          QLabel#windowtitle { color:#b9c7df; font-size:11px; }
          QLabel#headline { font-size:32px; font-weight:600; }
          QLabel#eyebrow { color:#a8bad8; font-size:10px; letter-spacing:2px; }
          QLabel#muted { color:#b0bfd8; }
          QFrame#card { background:rgba(221,235,255,12); border:1px solid #ffffff20; border-radius:16px; }
          QPushButton { background:rgba(212,229,255,22); border:1px solid #ffffff28; padding:11px 17px; border-radius:11px; }
          QPushButton:hover { background:rgba(212,229,255,40); }
          QPushButton:disabled { color:#7e8ba3; background:#ffffff08; }
          QPushButton#primary { background:#a9ccff; color:#142441; border:1px solid #d9e9ff; font-weight:600; }
          QPushButton:focus,QLineEdit:focus,QComboBox:focus { border:2px solid #b8d9ff; }
          QLineEdit,QComboBox { background:#111c30; border:1px solid #ffffff30; border-radius:10px; padding:10px 13px; }
          QComboBox QAbstractItemView { background:#202c44; color:#eaf0ff; }
          QCheckBox { spacing:10px; padding:8px; }
          QCheckBox::indicator { width:20px; height:20px; border:1px solid #99b8df; border-radius:6px; }
          QCheckBox::indicator:checked { background:#a9ccff; }
          QProgressBar { background:#ffffff13; border:0; border-radius:3px; height:6px; }
          QProgressBar::chunk { background:#b6d6ff; border-radius:3px; }
          QTextEdit { background:#0e182a; border:1px solid #ffffff20; border-radius:12px; padding:12px; font:11px monospace; }
          QSlider::groove:horizontal { background:#ffffff28; height:7px; border-radius:3px; }
          QSlider::sub-page:horizontal { background:#afd2ff; border-radius:3px; }
          QSlider::handle:horizontal { width:24px; margin:-9px 0; background:#f5f9ff; border:1px solid #ffffff; border-radius:12px; }
        '''
        try:
            appearance = json.loads((CONFIG / 'state.json').read_text())
        except (OSError, ValueError):
            appearance = {}
        if appearance.get('profile') == 'performance':
            style = style.replace('rgba(21,29,48,215)', 'rgba(21,29,48,255)')
        elif appearance.get('profile') == 'glass' and appearance.get('theme')!='light':
            style = style.replace('rgba(21,29,48,215)','rgba(21,29,48,195)')
            style = style.replace('background:rgba(220,235,255,9);','background:qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 rgba(180,218,255,32),stop:1 rgba(190,170,255,12));')
        if appearance.get('theme') == 'light':
            for before, after in {
                '#eaf0ff':'#24324a', '#b9c7df':'#596b86', '#b0bfd8':'#5c6e86',
                '#a8bad8':'#526b8a', '#111c30':'#f5f7fc', '#202c44':'#e6edf7',
                '#0e182a':'#f5f7fc', 'rgba(21,29,48,215)':'rgba(239,244,251,250)',
                'rgba(21,29,48,255)':'rgba(239,244,251,255)',
                'rgba(221,235,255,12)':'rgba(80,110,160,12)',
            }.items():
                style = style.replace(before, after)
        # Qt interprets eight-digit hex as ARGB, while our design tokens are RGBA.
        style = re.sub(r'#([0-9a-fA-F]{8})\b', lambda m: 'rgba(' + ','.join(str(int(m[1][i:i+2],16)) for i in (0,2,4,6)) + ')', style)
        self.setStyleSheet(style)
        self._surface_override=''
        self.surface_watcher=QFileSystemWatcher(self)
        if CONFIG.exists():self.surface_watcher.addPath(str(CONFIG))
        self.surface_watcher.directoryChanged.connect(self.refresh_surface)
        self.refresh_surface()

    def refresh_surface(self,*_):
        from appearance import surface
        try:state=json.loads((CONFIG/'state.json').read_text())
        except (OSError,ValueError):state={}
        tokens=surface(state)
        override=f'QFrame#surface{{background:rgba({tokens["rgb"]},{tokens["alpha"]});border-radius:{tokens["radius"]}px;}}'
        current=self.styleSheet().replace(self._surface_override,'') if self._surface_override else self.styleSheet()
        self._surface_override=override;self.setStyleSheet(current+override)

    def label(self, text, kind='muted', layout=None):
        label = QLabel(text)
        label.setWordWrap(True)
        label.setObjectName(kind)
        (layout or self.layout).addWidget(label)
        return label

    def button(self, text, callback, primary=False, layout=None):
        button = QPushButton(text)
        button.clicked.connect(callback)
        if primary:
            button.setObjectName('primary')
        (layout or self.layout).addWidget(button)
        return button

    def mark(self, size=100):
        logo = QLabel()
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pixmap = QPixmap(str(ASSETS / 'brand/mark.svg'))
        logo.setPixmap(pixmap.scaled(size, size, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
        self.layout.addWidget(logo)


class Welcome(GlassWindow):
    def __init__(self):
        super().__init__('Welcome to BoralancesOS', 850, 640)
        self.layout.addStretch()
        self.mark(112)
        title = self.label('A fresh perspective.', 'headline')
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        note = self.label('Welcome to BoralancesOS. Your apps, your ideas,\nand a little room to breathe.')
        note.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.layout.addSpacing(10)
        self.button('Explore your desktop', self.finish, primary=True)
        self.button('Personalize your workspace', lambda: subprocess.Popen(['boralances-control-center']))
        if Path('/etc/boralances/source').exists():
            self.button('Install BoralancesOS', lambda: subprocess.Popen(['boralances-installer']))
        self.button('Open Boralances Launcher', lambda: subprocess.Popen(['boralances-launcher']))
        self.layout.addStretch()
        help_label = self.label('⌘  Super + Space: applications    ·    Super + Tab: workspaces    ·    Super + ,: Control Center')
        help_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

    def finish(self):
        self.close()

    def closeEvent(self, event):
        CONFIG.mkdir(parents=True, exist_ok=True)
        (CONFIG / 'welcome-seen').touch()
        event.accept()


class Shortcuts(GlassWindow):
    def __init__(self):
        super().__init__('Keyboard Shortcuts', 850, 640)
        self.label('FAMILIAR KEYS. A CLEARER WORKSPACE.', 'eyebrow')
        self.label('Make yourself at home.', 'headline')
        grid=QGridLayout(); grid.setVerticalSpacing(10); grid.setHorizontalSpacing(30)
        for index,(keys,description) in enumerate([
            ('Windows key','Search applications'),('Alt + F4','Close current window'),
            ('Alt + Tab / Shift + Alt + Tab','Switch windows'),('Win + E / Win + R','Files / Run command'),
            ('Win + I / Win + A','Settings / Control Center'),('Win + D','Show or restore desktop'),
            ('Win + Left / Right','Snap window to either half'),('Win + Up / Down','Maximize / restore or minimize'),
            ('Win + M / Win + Shift + M','Minimize / restore a window'),('Win + L','Lock your session'),
            ('Ctrl + Shift + Esc','Activity Monitor'),('Win + Ctrl + Left / Right','Switch desktops'),
            ('Win + Shift + S / Print','Capture a screen region'),('Win + Return','Terminal'),
        ]):
            key=QLabel(keys); key.setStyleSheet('font-weight:600;color:#b9d7ff;')
            grid.addWidget(key,index,0); grid.addWidget(QLabel(description),index,1)
        self.layout.addLayout(grid)
        self.label('VirtualBox must have keyboard focus to receive host Windows-key shortcuts. Ctrl+C, Ctrl+V and Ctrl+W stay with the active application.')


class QuickControlCenter(GlassWindow):
    def __init__(self):
        super().__init__('Control Center', 760, 650)
        self.label('YOUR DESKTOP, YOUR WAY', 'eyebrow')
        self.label('A little more you.', 'headline')
        grid = QGridLayout()
        self.layout.addLayout(grid)
        for index, (title, subtitle, callback) in enumerate([
            ('Wi-Fi', 'Network settings', lambda: subprocess.Popen(['nm-connection-editor'])),
            ('Sound', 'Inputs and outputs', lambda: subprocess.Popen(['pavucontrol'])),
            ('Displays', 'Arrange your space', lambda: subprocess.Popen(['nwg-displays'])),
            ('Capture', 'Choose a region', lambda: subprocess.Popen(['boralances-control','screenshot'])),
        ]):
            button = QPushButton(title + '\n' + subtitle)
            button.setMinimumHeight(76)
            button.clicked.connect(callback)
            grid.addWidget(button, index // 2, index % 2)
        try:
            state = json.loads((CONFIG / 'state.json').read_text())
        except (OSError, ValueError):
            state = {}
        for label, key, choices in [('Appearance', 'theme', [('Obsidian', 'dark'), ('Glacier', 'light'), ('Follow system', 'system')]),
                                    ('Desktop effects', 'profile', [('Liquid Glass', 'glass'), ('Balanced', 'balanced'), ('Performance', 'performance'), ('Reduce motion', 'reduced-motion')])]:
            row = QHBoxLayout()
            row.addWidget(QLabel(label))
            row.addStretch()
            combo = QComboBox()
            for title, value in choices:
                combo.addItem(title, value)
            selected = combo.findData(state.get(key, 'dark' if key == 'theme' else 'balanced'))
            combo.setCurrentIndex(max(0, selected))
            combo.currentIndexChanged.connect(lambda _index, c=combo, k=key: self.apply('theme' if k == 'theme' else 'profile', c.currentData()))
            row.addWidget(combo)
            self.layout.addLayout(row)
        row = QHBoxLayout()
        self.volume = QSlider(Qt.Orientation.Horizontal)
        self.volume.setRange(0, 100)
        self.volume.setValue(50)
        try:
            response = command('wpctl', 'get-volume', '@DEFAULT_AUDIO_SINK@')
            self.volume.setValue(round(float(response.stdout.split()[1]) * 100))
        except (OSError, ValueError, IndexError, subprocess.SubprocessError):
            pass
        row.addWidget(QLabel('Volume'))
        row.addWidget(self.volume, 1)
        self.volume_timer = QTimer(self)
        self.volume_timer.setSingleShot(True)
        self.volume_timer.timeout.connect(lambda: self.apply_command('wpctl','set-volume','@DEFAULT_AUDIO_SINK@',f'{self.volume.value()}%'))
        self.volume.valueChanged.connect(lambda _value: self.volume_timer.start(180))
        self.layout.addLayout(row)
        dnd = QCheckBox('Do Not Disturb')
        try:
            dnd.setChecked(command('dunstctl', 'is-paused').stdout.strip() == 'true')
        except (OSError, subprocess.SubprocessError):
            pass
        dnd.toggled.connect(lambda checked: self.apply_command('dunstctl','set-paused','true' if checked else 'false'))
        self.layout.addWidget(dnd)
        self.feedback = self.label('Settings apply to this user. Games can temporarily reduce effects.')
        self.button('Lock screen', lambda: subprocess.Popen(['hyprlock']))

    def apply(self, kind, value):
        self.apply_command('boralances-control', kind, value)

    def apply_command(self, *args):
        try:
            result = command(*args)
            self.feedback.setText('Updated.' if result.returncode == 0 else 'This control is unavailable in the current session.')
        except (OSError, subprocess.SubprocessError):
            self.feedback.setText('Open Control Center inside a BoralancesOS desktop to apply this setting.')


from settings_pages import SettingsPages


class ControlCenter(SettingsPages, GlassWindow):
    def __init__(self):
        super().__init__('System Settings', 980, 620)
        self.build_settings()


class Installer(GlassWindow):
    STAGES = ['Welcome', 'Your account', 'Region & appearance', 'Destination', 'Review', 'Installing', 'Complete']
    def __init__(self):
        super().__init__('Install BoralancesOS', 980, 700)
        self.process = None
        self.page = 0
        self.root_source = self.boot_source = ''
        outer = self.layout
        outer.setContentsMargins(18, 22, 32, 28)
        columns = QHBoxLayout()
        columns.setSpacing(32)
        outer.addLayout(columns, 1)
        sidebar = QFrame()
        sidebar.setObjectName('card')
        sidebar.setFixedWidth(195)
        side = QVBoxLayout(sidebar)
        side.setContentsMargins(21, 25, 21, 22)
        logo = QLabel()
        logo.setPixmap(QPixmap(str(ASSETS / 'brand/mark.svg')).scaled(72, 72, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
        side.addWidget(logo)
        brand = QLabel('BoralancesOS')
        brand.setStyleSheet('font-size:17px;font-weight:600;')
        side.addWidget(brand)
        self.label('A new beginning.', layout=side)
        side.addSpacing(27)
        self.step_items = []
        for index, name in enumerate(self.STAGES):
            item = QLabel(f'{index+1:02d}   {name}')
            item.setStyleSheet('padding:10px 6px;font-size:11px;color:#9dafc9;')
            side.addWidget(item)
            self.step_items.append(item)
        side.addStretch()
        self.label('YOUR NEXT CHAPTER.', 'eyebrow', layout=side)
        columns.addWidget(sidebar)
        main = QWidget()
        self.layout = QVBoxLayout(main)
        self.layout.setContentsMargins(0, 15, 0, 0)
        self.layout.setSpacing(20)
        columns.addWidget(main, 1)
        self.step_label = self.label('01 / WELCOME', 'eyebrow')
        self.title = self.label('Make yourself at home.', 'headline')
        self.stack = QStackedWidget()
        self.layout.addWidget(self.stack, 1)
        self.pages = []
        for _ in self.STAGES:
            page = QWidget()
            layout = QVBoxLayout(page)
            layout.setContentsMargins(0, 0, 0, 0)
            layout.setSpacing(16)
            self.pages.append(layout)
            self.stack.addWidget(page)
        self.label('A considered desktop for work and play. The installer guides you through a reviewed installation onto prepared partitions.', layout=self.pages[0])
        self.label('Included: BoralancesBrowser, Launcher, JARVIS, Glass Connect, Steam, developer tools and application compatibility.', layout=self.pages[0])
        self.label('Choose your own username and password during setup. Your installed system will be ready to sign in.', layout=self.pages[0])
        self.full_name=QLineEdit();self.full_name.setPlaceholderText('Your name')
        self.username=QLineEdit();self.username.setPlaceholderText('alex')
        self.password=QLineEdit();self.password.setEchoMode(QLineEdit.EchoMode.Password);self.password.setPlaceholderText('At least 8 characters')
        self.password_confirm=QLineEdit();self.password_confirm.setEchoMode(QLineEdit.EchoMode.Password);self.password_confirm.setPlaceholderText('Type your password again')
        for title,field in [('Your name',self.full_name),('Username',self.username),('Password',self.password),('Confirm password',self.password_confirm)]:
            self.label(title,layout=self.pages[1]);self.pages[1].addWidget(field);field.textChanged.connect(self.update_account)
        show_password=QCheckBox('Show passwords');show_password.toggled.connect(lambda checked:[field.setEchoMode(QLineEdit.EchoMode.Normal if checked else QLineEdit.EchoMode.Password) for field in (self.password,self.password_confirm)]);self.pages[1].addWidget(show_password)
        self.account_note=self.label('Use a lowercase username and a password of at least 8 characters.',layout=self.pages[1])
        self.zone = QComboBox()
        for zone in ['Europe/Istanbul', 'UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo']:
            self.zone.addItem(zone)
        self.theme = QComboBox()
        self.theme.addItem('Obsidian · Dark', 'dark')
        self.theme.addItem('Glacier · Light', 'light')
        self.effects = QComboBox()
        for name, value in [('Balanced', 'balanced'), ('Liquid Glass', 'glass'), ('Performance', 'performance'), ('Reduce motion', 'reduced-motion')]:
            self.effects.addItem(name, value)
        for title, widget in [('Region / time zone', self.zone), ('Appearance', self.theme), ('Desktop effects', self.effects)]:
            self.label(title, layout=self.pages[2])
            self.pages[2].addWidget(widget)
        self.effects.setCurrentIndex(self.effects.findData('performance'))
        self.configure_graphics=QCheckBox('Configure matched native GPU drivers (AMD / Intel / NVIDIA)')
        self.configure_graphics.setChecked(True)
        self.pages[2].addWidget(self.configure_graphics)
        self.label('Supported native NVIDIA GPUs use the matched driver and detected Intel/Ryzen PRIME routing. AMD Radeon uses Mesa/RADV. Network access may be required. VirtualBox keeps its virtual GPU driver.',layout=self.pages[2])
        self.label('Choose a blank disk (32 GiB minimum). A new EFI partition and ext4 root will be created only after your final review. Disks with existing partitions or filesystem signatures are not erased automatically.',layout=self.pages[3])
        self.blank_disk=QComboBox();self.blank_disk.addItem('Choose a blank disk…',None);self.pages[3].addWidget(self.blank_disk)
        self.blank_disk.currentIndexChanged.connect(self.inspect_destination)
        self.destination = self.label('', layout=self.pages[3])
        self.label('Advanced: you can instead prepare and mount an ext4/Btrfs root at /mnt and a FAT32 EFI partition at /mnt/boot, then refresh.', layout=self.pages[3])
        self.button('Open disk utility', lambda: subprocess.Popen(['sudo','-n','gparted']), layout=self.pages[3])
        self.button('Refresh destination', self.refresh_destinations, layout=self.pages[3])
        self.review = self.label('', layout=self.pages[4])
        self.confirm = QCheckBox('I reviewed these destination partitions and want to install BoralancesOS.')
        self.pages[4].addWidget(self.confirm)
        self.confirm.toggled.connect(lambda _checked: self.next.setEnabled(self.confirm.isChecked()))
        self.progress_text = self.label('Preparing your new workspace…', layout=self.pages[5])
        self.progress = QProgressBar()
        self.progress.setRange(0, 0)
        self.pages[5].addWidget(self.progress)
        self.label('Progress follows the actual installation process. Keep this window open until it completes.', layout=self.pages[5])
        self.log = QTextEdit()
        self.log.setReadOnly(True)
        self.log.setVisible(False)
        self.button('Show installation details', lambda: self.log.setVisible(not self.log.isVisible()), layout=self.pages[5])
        self.pages[5].addWidget(self.log, 1)
        self.label('Your new workspace is ready. Remove the installation media before restarting. Sign in using the username and password you chose here.', layout=self.pages[6])
        self.button('Restart computer', self.reboot, layout=self.pages[6])
        for index, layout in enumerate(self.pages):
            if index != 5:
                layout.addStretch()
        nav = QHBoxLayout()
        self.back = self.button('Back', lambda: self.set_page(self.page - 1), layout=nav)
        nav.addStretch()
        self.next = self.button('Continue', self.advance, primary=True, layout=nav)
        self.layout.addLayout(nav)
        self.set_page(0)

    def set_page(self, page):
        self.page = max(0, min(6, page))
        self.stack.setCurrentIndex(self.page)
        for index, item in enumerate(self.step_items):
            item.setStyleSheet('padding:10px 6px;font-size:11px;border-radius:8px;' + ('background:rgba(192,218,255,30);color:#edf3ff;' if index == self.page else 'color:#9dafc9;'))
        self.step_label.setText(f'{self.page + 1:02d} / {self.STAGES[self.page].upper()}')
        titles = ['Make yourself at home.', 'Make it yours.', 'Settle into your space.', 'A place for your workspace.', 'One last look.', 'Good things are taking shape.', 'Welcome home.']
        self.title.setText(titles[self.page])
        self.back.setVisible(0 < self.page < 5)
        self.next.setVisible(self.page < 5)
        self.next.setText('Install BoralancesOS' if self.page == 4 else 'Continue')
        self.next.setEnabled(self.page != 4 or self.confirm.isChecked())
        if self.page == 1:
            self.update_account()
        elif self.page == 3:
            self.refresh_destinations()
        elif self.page == 4:
            destination=(f'Initialize blank disk: {self.root_source[6:]}\nCreate GPT, 1 GiB EFI and an ext4 root partition.' if self.root_source.startswith('blank:') else f'Root: {self.root_source}\nEFI: {self.boot_source}')
            self.review.setText(f'{destination}\nRegion: {self.zone.currentText()}\nAppearance: {self.theme.currentText()}\nEffects: {self.effects.currentText()}\nAccount: {self.username.text()} ({self.full_name.text()})\n\nOnly the reviewed destination will be used. Existing files in prepared filesystems may be replaced.')

    def account_values(self):
        return {'username':self.username.text().strip(),'fullName':self.full_name.text().strip(),'password':self.password.text(),'configureGraphics':self.configure_graphics.isChecked()}

    def update_account(self,*_):
        if not hasattr(self,'account_note'):return False
        try:
            validate_account(self.account_values())
            if self.password.text()!=self.password_confirm.text():raise ValueError('The two passwords must match.')
            message='Your account is ready. Your password stays private.';valid=True
        except ValueError as error:message=str(error);valid=False
        self.account_note.setText(message)
        if hasattr(self,'next') and self.page==1:self.next.setEnabled(valid)
        return valid

    def refresh_destinations(self):
        previous=self.blank_disk.currentData();self.blank_disk.blockSignals(True);self.blank_disk.clear();self.blank_disk.addItem('Choose a blank disk…',None)
        try:
            for device in list_blank_disks():self.blank_disk.addItem(f'{device["name"]} · {int(device["size"])/2**30:.1f} GiB · {(device.get("model") or "Disk").strip()}',device['name'])
        except (OSError,ValueError,subprocess.SubprocessError):pass
        index=self.blank_disk.findData(previous);self.blank_disk.setCurrentIndex(max(0,index));self.blank_disk.blockSignals(False);self.inspect_destination()

    def inspect_destination(self,*_):
        try:
            self.root_source = command('findmnt','-n','-o','SOURCE','-M','/mnt').stdout.strip()
            self.boot_source = command('findmnt','-n','-o','SOURCE','-M','/mnt/boot').stdout.strip()
            valid = self.root_source.startswith('/dev/') and self.boot_source.startswith('/dev/')
        except (OSError, subprocess.SubprocessError):
            valid = False
        blank=self.blank_disk.currentData()
        if blank and not valid:self.root_source='blank:'+blank;self.boot_source='create-efi';valid=True
        self.destination.setText((f'Blank disk  {blank}\nA GPT partition table, 1 GiB EFI and ext4 root will be created after review.' if self.root_source.startswith('blank:') else f'Prepared root  {self.root_source}\nEFI  {self.boot_source}') if valid else 'Select an empty disk, or prepare and mount the destination partitions, then refresh.')
        self.next.setEnabled(valid)

    def advance(self):
        if self.page==1 and not self.update_account():return
        if self.page == 4:
            self.start_install()
        else:
            self.set_page(self.page + 1)

    def start_install(self):
        if not self.confirm.isChecked() or not self.update_account():
            return
        if not Path('/etc/boralances/source').exists():
            QMessageBox.information(self, 'Live media required', 'Start the installer from BoralancesOS live media to install the system.')
            return
        self.set_page(5)
        self.process = QProcess(self)
        self.process.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        self.process.readyReadStandardOutput.connect(self.read_output)
        self.process.finished.connect(self.finished)
        self.process.errorOccurred.connect(lambda _error: self.fail('The installer process could not start.'))
        args = ['-n','/run/current-system/sw/bin/boralances-install','/mnt','--gui',self.root_source,self.boot_source,
                self.zone.currentText(),self.theme.currentData(),self.effects.currentData()]
        self.process.started.connect(lambda: (self.process.write(b'INSTALL BORALANCESOS\n'+json.dumps(self.account_values()).encode('utf-8')+b'\n'), self.process.closeWriteChannel()))
        self.process.start('sudo', args)

    def read_output(self):
        text = bytes(self.process.readAllStandardOutput()).decode('utf-8', errors='replace')
        self.log.insertPlainText(text)
        stages = {'partition':'Preparing the reviewed blank disk…','prepare':'Preparing configuration…', 'build':'Building and installing your system…', 'complete':'Your new workspace is ready.'}
        for key, label in stages.items():
            if 'BORALANCES_STAGE:' + key in text:
                self.progress_text.setText(label)

    def finished(self, code, _status):
        if code == 0:
            self.password.clear();self.password_confirm.clear()
            self.set_page(6)
        else:
            self.fail('Installation did not complete. Review the details below, correct the issue and return to the destination step.')

    def fail(self, message):
        self.progress.setRange(0, 1)
        self.progress.setValue(0)
        self.progress_text.setText(message)
        self.back.setText('Review destination')
        self.back.setVisible(True)
        try:
            self.back.clicked.disconnect()
        except RuntimeError:
            pass
        self.back.clicked.connect(lambda: self.set_page(3))

    def reboot(self):
        answer = QMessageBox.question(self, 'Restart', 'Restart into BoralancesOS now?')
        if answer == QMessageBox.StandardButton.Yes:
            subprocess.Popen(['systemctl','reboot'])

    def closeEvent(self, event):
        if self.process and self.process.state() != QProcess.ProcessState.NotRunning:
            QMessageBox.information(self, 'Installation in progress', 'Keep this window open while your system is being installed.')
            event.ignore()
        else:
            event.accept()
