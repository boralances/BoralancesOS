"""A keyboard-friendly app launcher with real desktop entries and dock pinning."""
import shutil
import subprocess
from pathlib import Path
from PySide6.QtCore import Qt,QSize,QStandardPaths
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QLineEdit,QListWidget,QListWidgetItem,QHBoxLayout,QPushButton,QMenu,QFileDialog
from experience import GlassWindow
from app_catalog import applications,pinned,set_pin


class AppList(QListWidget):
    def mouseReleaseEvent(self,event):
        super().mouseReleaseEvent(event)
        if event.button()==Qt.MouseButton.LeftButton:
            item=self.itemAt(event.position().toPoint())
            if item: self.itemActivated.emit(item)


class LauncherMenu(GlassWindow):
    def __init__(self):
        super().__init__('Applications',880,650)
        self.layout.setContentsMargins(26,20,26,20); self.opening=False; self.editing=False
        self.search=QLineEdit(); self.search.setPlaceholderText('Search your apps…'); self.search.setAccessibleName('Search applications')
        self.layout.addWidget(self.search)
        tabs=QHBoxLayout(); self.all_button=QPushButton('All apps'); self.pinned_button=QPushButton('Pinned to Dock'); self.only_pinned=False
        self.all_button.clicked.connect(lambda:self.filter(False)); self.pinned_button.clicked.connect(lambda:self.filter(True))
        self.edit_button=QPushButton('Edit Dock'); self.edit_button.setCheckable(True)
        self.edit_button.toggled.connect(self.edit_dock)
        tabs.addWidget(self.all_button); tabs.addWidget(self.pinned_button); tabs.addStretch(); tabs.addWidget(self.edit_button); self.layout.addLayout(tabs)
        self.items=AppList(); self.items.setViewMode(QListWidget.ViewMode.IconMode); self.items.setResizeMode(QListWidget.ResizeMode.Adjust)
        self.items.setMovement(QListWidget.Movement.Static); self.items.setIconSize(QSize(46,46)); self.items.setGridSize(QSize(130,105)); self.items.setWordWrap(True)
        self.items.setSpacing(4); self.items.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.items.customContextMenuRequested.connect(self.context_menu); self.items.itemActivated.connect(self.open_item)
        self.layout.addWidget(self.items,1); self.catalog=applications()
        self.feedback=self.label('Right-click any app to pin or unpin it from the Dock.')
        footer=QHBoxLayout(); open_file=QPushButton('Open EXE or AppImage…'); open_file.clicked.connect(self.open_file)
        settings=QPushButton('System Settings'); settings.clicked.connect(lambda:self.launch(['boralances-control-center']))
        footer.addWidget(open_file); footer.addStretch(); footer.addWidget(settings); self.layout.addLayout(footer)
        self.setStyleSheet(self.styleSheet()+'''QListWidget{background:transparent;border:0;outline:0;} QListWidget::item{border-radius:12px;padding:8px;color:#dce8fb;} QListWidget::item:hover{background:rgba(190,219,255,18);} QListWidget::item:selected{background:rgba(153,199,255,32);border:1px solid #b2d1ff;} QMenu{background:#202c40;color:#eef3ff;border:1px solid #52647f;padding:5px;} QMenu::item{padding:8px 18px;} QMenu::item:selected{background:#3b5e8c;}''')
        self.search.textChanged.connect(lambda _text:self.filter(self.only_pinned)); self.search.returnPressed.connect(self.open_first)
        self.filter(False); self.search.setFocus()

    def filter(self,only_pinned=False):
        self.only_pinned=only_pinned; self.items.clear(); text=self.search.text().casefold(); pins=set(pinned())
        for app in self.catalog:
            if only_pinned and app['id'] not in pins: continue
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
        else: self.launch(['gio','launch',app['path']])

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
