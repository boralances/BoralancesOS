"""A keyboard-friendly app launcher with real desktop entries and dock pinning."""
import shutil
import json
import getpass
import subprocess
from pathlib import Path
from PySide6.QtCore import Qt,QSize,QStandardPaths
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QLineEdit,QListWidget,QListWidgetItem,QHBoxLayout,QVBoxLayout,QPushButton,QMenu,QFileDialog,QFrame,QLabel,QComboBox
from experience import GlassWindow,CONFIG
from app_catalog import applications,pinned,set_pin,recent,record_launch
from app_collections import GROUPS,in_collection


class AppList(QListWidget):
    def mouseReleaseEvent(self,event):
        super().mouseReleaseEvent(event)
        if event.button()==Qt.MouseButton.LeftButton:
            item=self.itemAt(event.position().toPoint())
            if item: self.itemActivated.emit(item)


class LauncherMenu(GlassWindow):
    def __init__(self):
        super().__init__('Applications',880,650)
        try:state=json.loads((CONFIG/'state.json').read_text())
        except (OSError,ValueError):state={}
        self.glass=state.get('profile')=='glass';self.category='all'
        if self.glass:
            self.resize(1060,650)
            outer=self.layout;outer.setContentsMargins(18,16,18,18);columns=QHBoxLayout();columns.setSpacing(18);outer.addLayout(columns)
            primary=QFrame();primary.setObjectName('glassLauncher');self.layout=QVBoxLayout(primary);columns.addWidget(primary,1)
            side=QFrame();side.setObjectName('glassDevice');side.setFixedWidth(232);column=QVBoxLayout(side);column.setContentsMargins(21,26,21,22);column.setSpacing(17)
            mark=QLabel();mark.setPixmap(QIcon.fromTheme('boralances-glass-connect').pixmap(60,60));column.addWidget(mark)
            title=QLabel('Your connected space');title.setWordWrap(True);title.setStyleSheet('font-size:21px;font-weight:600;');column.addWidget(title)
            note=QLabel('Connect an Android device through Glass Connect. Pairing and device permission are required.');note.setWordWrap(True);column.addWidget(note)
            for label,args in [('Open Glass Connect',['boralances-glass-connect']),('Phone files',['thunar','mtp:///']),('USB & devices',['boralances-devices']),('Microphone & sound',['boralances-audio-center'])]:
                button=QPushButton(label);button.clicked.connect(lambda _checked=False,args=args:self.launch(args));column.addWidget(button)
            column.addStretch();account=QLabel('BoralancesOS\n'+getpass.getuser());column.addWidget(account)
            settings=QPushButton('Personalize your space');settings.clicked.connect(lambda:self.launch(['boralances-control-center','--page','appearance']));column.addWidget(settings);columns.addWidget(side)
        self.layout.setContentsMargins(26,20,26,20); self.opening=False; self.editing=False
        self.search=QLineEdit(); self.search.setPlaceholderText('Search your apps…'); self.search.setAccessibleName('Search applications')
        self.layout.addWidget(self.search)
        tabs=QHBoxLayout(); self.all_button=QPushButton('All apps'); self.pinned_button=QPushButton('Pinned to Dock'); self.only_pinned=False
        self.all_button.clicked.connect(lambda:self.select_collection('all')); self.pinned_button.clicked.connect(lambda:self.filter(True))
        self.edit_button=QPushButton('Edit Dock'); self.edit_button.setCheckable(True)
        self.edit_button.toggled.connect(self.edit_dock)
        tabs.addWidget(self.all_button); tabs.addWidget(self.pinned_button); tabs.addStretch(); tabs.addWidget(self.edit_button); self.layout.addLayout(tabs)
        if self.glass:
            self.collection=QComboBox();self.collection.addItem('All collections','all')
            for key,title,_categories in GROUPS:self.collection.addItem(title,key)
            self.collection.activated.connect(lambda index:self.select_collection(self.collection.itemData(index)));tabs.insertWidget(2,self.collection)
        self.items=AppList(); self.items.setViewMode(QListWidget.ViewMode.IconMode); self.items.setResizeMode(QListWidget.ResizeMode.Adjust)
        self.items.setMovement(QListWidget.Movement.Static); self.items.setIconSize(QSize(46,46)); self.items.setGridSize(QSize(130,105)); self.items.setWordWrap(True)
        self.items.setSpacing(4); self.items.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.items.customContextMenuRequested.connect(self.context_menu); self.items.itemActivated.connect(self.open_item)
        self.layout.addWidget(self.items,1); self.catalog=applications()
        self.feedback=self.label('Right-click any app to pin or unpin it from the Dock.')
        if self.glass:
            self.label('RECENT APPS','eyebrow');row=QHBoxLayout();known={app['id']:app for app in self.catalog}
            for identifier in recent()[:3]:
                if identifier not in known:continue
                app=known[identifier];button=QPushButton(QIcon.fromTheme(app['icon']),app['name'][:17]);button.setToolTip(app['name']);button.clicked.connect(lambda _checked=False,app=app:self.open_recent(app));row.addWidget(button)
            if row.count()==0:row.addWidget(QLabel('Apps you open here appear in your recent list.'))
            self.layout.addLayout(row)
        footer=QHBoxLayout(); open_file=QPushButton('Open EXE or AppImage…'); open_file.clicked.connect(self.open_file)
        settings=QPushButton('System Settings'); settings.clicked.connect(lambda:self.launch(['boralances-control-center']))
        footer.addWidget(open_file); footer.addStretch(); footer.addWidget(settings); self.layout.addLayout(footer)
        self.setStyleSheet(self.styleSheet()+'''QListWidget{background:transparent;border:0;outline:0;} QListWidget::item{border-radius:12px;padding:8px;color:#dce8fb;} QListWidget::item:hover{background:rgba(190,219,255,18);} QListWidget::item:selected{background:rgba(153,199,255,32);border:1px solid #b2d1ff;} QMenu{background:#202c40;color:#eef3ff;border:1px solid #52647f;padding:5px;} QMenu::item{padding:8px 18px;} QMenu::item:selected{background:#3b5e8c;}''')
        self.search.textChanged.connect(lambda _text:self.filter(self.only_pinned)); self.search.returnPressed.connect(self.open_first)
        if self.glass:self.setStyleSheet(self.styleSheet()+'''QFrame#glassLauncher,QFrame#glassDevice{background:rgba(220,238,255,8);border:1px solid rgba(240,249,255,48);border-radius:25px;} QLineEdit{background:rgba(8,15,25,105);border:1px solid rgba(230,246,255,65);border-radius:20px;} QListWidget{background:rgba(8,15,25,24);border:1px solid rgba(235,245,255,24);border-radius:22px;} QListWidget::item:hover{background:rgba(195,226,255,30);border:1px solid rgba(231,248,255,80);}''')
        self.filter(self.glass and bool(pinned())); self.search.setFocus()

    def select_collection(self,name):
        self.category=name if name=='all' or any(key==name for key,_title,_values in GROUPS) else 'all'
        self.search.clear();self.filter(False)

    def open_recent(self,app):
        record_launch(app['id']);self.launch(['gio','launch',app['path']])

    def filter(self,only_pinned=False):
        self.only_pinned=only_pinned; self.items.clear(); text=self.search.text().casefold(); pins=set(pinned())
        for app in self.catalog:
            if only_pinned and not text and app['id'] not in pins: continue
            if not text and not only_pinned and not in_collection(app,self.category):continue
            if text and text not in (app['name']+' '+app['comment']).casefold(): continue
            item=QListWidgetItem(QIcon.fromTheme(app['icon']),('✓ ' if self.editing and app['id'] in pins else '')+app['name']); item.setData(Qt.ItemDataRole.UserRole,app)
            item.setToolTip(app['name']+('\nPinned to Dock' if app['id'] in pins else '')+'\n'+app['comment']); self.items.addItem(item)
        self.feedback.setText('Click an app to pin or unpin it. Click Done when finished.' if self.editing else f'{self.items.count()} apps · Edit Dock to change your pinned apps.')

    def edit_dock(self,enabled):
        self.editing=enabled; self.edit_button.setText('Done' if enabled else 'Edit Dock')
        self.filter(self.only_pinned)

    def toggle_pin(self,app):
        set_pin(app['id'],app['id'] not in pinned(),self.catalog)
        subprocess.Popen(['systemctl','--user','restart','boralances-dock.service'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        self.filter(self.only_pinned)

    def context_menu(self,position):
        item=self.items.itemAt(position)
        if not item: return
        app=item.data(Qt.ItemDataRole.UserRole); enabled=app['id'] not in pinned()
        menu=QMenu(self); open_action=menu.addAction('Open'); pin_action=menu.addAction('Pin to Dock' if enabled else 'Unpin from Dock');desktop_action=menu.addAction('Add to Desktop')
        selected=menu.exec(self.items.mapToGlobal(position))
        if selected==open_action: self.open_item(item)
        elif selected==pin_action:
            set_pin(app['id'],enabled,self.catalog)
            subprocess.Popen(['systemctl','--user','restart','boralances-dock.service'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            self.filter(self.only_pinned)
        elif selected==desktop_action:
            folder=Path(QStandardPaths.writableLocation(QStandardPaths.StandardLocation.DesktopLocation) or Path.home()/'Desktop');folder.mkdir(parents=True,exist_ok=True)
            destination=folder/(app['id']+'.desktop')
            if not destination.exists():shutil.copyfile(app['path'],destination);destination.chmod(0o700)
            self.feedback.setText(app['name']+' shortcut added to Desktop.')

    def open_first(self):
        if self.items.count(): self.open_item(self.items.item(0))

    def open_item(self,item):
        app=item.data(Qt.ItemDataRole.UserRole)
        if self.editing: self.toggle_pin(app)
        else:
            try:record_launch(app['id'])
            except OSError:pass
            self.launch(['gio','launch',app['path']])

    def launch(self,args):
        if self.opening: return
        binary=shutil.which(args[0])
        if not binary: self.feedback.setText('This application is unavailable.'); return
        self.opening=True
        subprocess.Popen(['systemd-run','--user','--collect','--property=ExitType=cgroup',binary,*args[1:]],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        self.close()

    def open_file(self):
        filename,_=QFileDialog.getOpenFileName(self,'Open an application',str(Path.home()/'Downloads'),'Applications (*.exe *.EXE *.AppImage *.appimage)')
        if filename: self.launch(['boralances-exe' if Path(filename).suffix.lower()=='.exe' else 'appimage-run',filename])

    def keyPressEvent(self,event):
        if event.key()==Qt.Key.Key_Escape: self.close()
        else: super().keyPressEvent(event)
