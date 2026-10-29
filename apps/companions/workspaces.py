"""A lightweight overview of independent Hyprland desktops."""
import json,re,subprocess
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QGridLayout,QGroupBox,QVBoxLayout,QPushButton,QScrollArea,QWidget
from experience import GlassWindow

class Workspaces(GlassWindow):
    def __init__(self):
        super().__init__('Desktops',1020,600)
        self.outer.itemAt(0).widget().hide()
        self.current=json.loads(subprocess.check_output(['hyprctl','-j','activewindow'],text=True) or '{}')
        self.clients=json.loads(subprocess.check_output(['hyprctl','-j','clients'],text=True))
        spaces=json.loads(subprocess.check_output(['hyprctl','-j','workspaces'],text=True))
        ids=sorted({s['id'] for s in spaces if s['id']>0}|{1,2,3,4})
        self.label('Separate desktops for work, browsing and games. Choose a desktop or an open window.')
        scroll=QScrollArea();scroll.setWidgetResizable(True); content=QWidget();grid=QGridLayout(content);scroll.setWidget(content);self.layout.addWidget(scroll,1)
        for i,number in enumerate(ids):
            group=QGroupBox('Desktop '+str(number));col=QVBoxLayout(group)
            open_button=QPushButton('Go to Desktop '+str(number));open_button.clicked.connect(lambda _=False,n=number:self.desktop(n));col.addWidget(open_button)
            for w in self.clients:
                if not w.get('mapped') or w.get('workspace',{}).get('id')!=number or w.get('class')=='boralances-workspaces':continue
                address=w['address']
                if not re.fullmatch(r'0x[0-9a-fA-F]+',address):continue
                button=QPushButton((w.get('title') or w['class'])[:65]);button.setIcon(QIcon.fromTheme(w['class'],QIcon.fromTheme('application-x-executable')))
                button.clicked.connect(lambda _=False,a=address:self.focus(a));col.addWidget(button)
            if self.current.get('address'):
                move=QPushButton('Move current window here');move.clicked.connect(lambda _=False,n=number:self.move(n));col.addWidget(move)
            col.addStretch();grid.addWidget(group,i//2,i%2)
        add=QPushButton('+ New Desktop');add.clicked.connect(lambda:self.desktop(max(ids)+1));self.layout.addWidget(add)
    def desktop(self,number):
        subprocess.run(['hyprctl','eval',f'hl.dispatch(hl.dsp.focus({{workspace={int(number)}}}))'],check=False);self.close()
    def focus(self,address):
        subprocess.run(['hyprctl','eval',f'hl.dispatch(hl.dsp.focus({{window="address:{address}"}})); hl.dispatch(hl.dsp.window.bring_to_top())'],check=False);self.close()
    def move(self,number):
        address=self.current['address']
        if re.fullmatch(r'0x[0-9a-fA-F]+',address):subprocess.run(['hyprctl','eval',f'hl.dispatch(hl.dsp.window.move({{window="address:{address}",workspace="{int(number)}",follow=true}}))'],check=False)
        self.close()
    def keyPressEvent(self,event):
        from PySide6.QtCore import Qt
        if event.key()==Qt.Key.Key_Escape:self.close()
        else:super().keyPressEvent(event)
