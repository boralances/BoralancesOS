"""Native desktop menu, anchored to the Boralances menu-bar mark."""
from pathlib import Path
import shutil
import subprocess
from PySide6.QtCore import Qt,QSize
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QWidget,QFrame,QVBoxLayout,QHBoxLayout,QLabel,QPushButton,QMessageBox


class SystemMenu(QWidget):
    def __init__(self):
        super().__init__(); self.setWindowTitle('BoralancesOS Menu')
        self.setWindowFlags(Qt.WindowType.Window|Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground); self.setFixedSize(310,566)
        root=QVBoxLayout(self); root.setContentsMargins(0,0,0,0)
        frame=QFrame(); frame.setObjectName('menuSurface'); root.addWidget(frame)
        body=QVBoxLayout(frame); body.setContentsMargins(12,15,12,12); body.setSpacing(2)
        title=QHBoxLayout(); brand=QLabel('B  BoralancesOS'); brand.setStyleSheet('font-weight:700;font-size:15px;padding:3px 6px 12px;')
        title.addWidget(brand,1); version=QLabel('0.3'); version.setStyleSheet('color:#aab5c7;padding-right:8px;'); title.addWidget(version); body.addLayout(title)
        def item(text,callback):
            button=QPushButton(text)
            icon_name='boralances-'+('files' if 'Folder' in text or 'Explorer' in text else 'settings' if 'Settings' in text or 'Options' in text else 'widgets' if 'Widgets' in text else 'task-manager' if 'Task Manager' in text else 'shortcuts' if 'Shortcuts' in text else 'os')
            button.setIcon(QIcon.fromTheme(icon_name)); button.setIconSize(QSize(19,19))
            button.clicked.connect(callback); body.addWidget(button)
        def divider():
            line=QFrame(); line.setObjectName('divider'); line.setFixedHeight(1); body.addWidget(line); body.addSpacing(5)
        item('File Explorer',lambda:self.open_app('thunar'))
        item('Home Folder',lambda:self.open_app('thunar',str(Path.home())))
        divider()
        item('Lock Screen                         Win+L',lambda:self.open_app('hyprlock'))
        item('Sign-in Options…',lambda:self.settings('desktop'))
        item('System Settings…',lambda:self.settings('desktop'))
        item('Task Manager',lambda:self.open_app('boralances-task-manager'))
        divider()
        item('Widgets & Calendar…',lambda:self.settings('widgets'))
        item('Dock & Menu Bar…',lambda:self.settings('dock'))
        item('Keyboard Shortcuts…',lambda:self.open_app('boralances-shortcuts'))
        divider()
        item('Sleep…',lambda:self.power('Sleep','systemctl','suspend'))
        item('Restart…',lambda:self.power('Restart','systemctl','reboot'))
        item('Shut Down…',lambda:self.power('Shut down','systemctl','poweroff'))
        divider(); item('About BoralancesOS',lambda:self.settings('about'))
        self.setStyleSheet('''QWidget{font:13px Inter;color:#f1f4fb;background:transparent;}
          QFrame#menuSurface{background:rgba(25,30,41,248);border:1px solid rgba(235,244,255,44);border-radius:16px;}
          QPushButton{text-align:left;border:0;border-radius:8px;padding:9px 12px;}
          QPushButton:hover,QPushButton:focus{background:rgba(128,172,238,50);}
          QFrame#divider{background:rgba(255,255,255,30);margin:3px 6px;}
          QMessageBox{background:#1b263a;}''')

    def settings(self,page): self.open_app('boralances-control-center','--page',page)

    def open_app(self,*args):
        binary=shutil.which(args[0])
        if binary:
            subprocess.Popen(['systemd-run','--user','--collect','--property=ExitType=cgroup',binary,*args[1:]],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            self.close()

    def power(self,title,*args):
        answer=QMessageBox.question(self,title,title+' BoralancesOS? Save your work before continuing.',QMessageBox.StandardButton.Yes|QMessageBox.StandardButton.No,QMessageBox.StandardButton.No)
        if answer==QMessageBox.StandardButton.Yes: self.open_app(*args)

    def keyPressEvent(self,event):
        if event.key()==Qt.Key.Key_Escape: self.close()
        else: super().keyPressEvent(event)


class NavigationMenu(SystemMenu):
    def __init__(self,kind='file-menu'):
        super().__init__()
        body=self.findChild(QFrame,'menuSurface').layout()
        while body.count():
            item=body.takeAt(0)
            if item.widget(): item.widget().deleteLater()
            elif item.layout():
                layout=item.layout()
                while layout.count():
                    child=layout.takeAt(0)
                    if child.widget(): child.widget().deleteLater()
        self.setWindowTitle('File' if kind=='file-menu' else 'Go'); self.setFixedSize(280,326)
        heading=QLabel('File' if kind=='file-menu' else 'Go to Folder'); heading.setStyleSheet('font-weight:600;padding:5px 12px;'); body.addWidget(heading)
        locations=[('New Files Window','boralances-files',str(Path.home())),('Home','user-home',str(Path.home())),('Documents','folder-documents',str(Path.home()/'Documents')),('Downloads','folder-download',str(Path.home()/'Downloads')),('Pictures','folder-pictures',str(Path.home()/'Pictures')),('Trash','boralances-trash','trash:///')]
        for title,icon_name,path in locations:
            button=QPushButton(title); button.setIcon(QIcon.fromTheme(icon_name)); button.setIconSize(QSize(22,22))
            button.clicked.connect(lambda _checked=False,p=path:self.open_app('thunar',p)); body.addWidget(button)
        body.addStretch()
