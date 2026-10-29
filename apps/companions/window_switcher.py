"""On-demand visual switcher, with repeated Alt+Tab delivered to one window."""
import json,os,re,signal,subprocess,time
from pathlib import Path
from PySide6.QtCore import Qt,QTimer,QSize
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QListWidget,QListWidgetItem
from experience import GlassWindow
from app_catalog import switcher_clients

class WindowSwitcher(GlassWindow):
    def __init__(self,backward=False):
        super().__init__('Switch windows',760,480)
        self.outer.itemAt(0).widget().hide()  # Compositor supplies the shared window controls.
        self.windows=QListWidget(); self.windows.setIconSize(QSize(42,42))
        self.windows.setStyleSheet('QListWidget{background:transparent;border:0;} QListWidget::item{padding:14px;border-radius:12px;} QListWidget::item:selected{background:#37577e;}')
        self.layout.addWidget(self.windows)
        self.label('Release Alt to switch · Shift+Alt+Tab: previous · Escape: cancel')
        active=json.loads(subprocess.check_output(['hyprctl','-j','activewindow'],text=True) or '{}')
        workspace=json.loads(subprocess.check_output(['hyprctl','-j','activeworkspace'],text=True))['id']
        clients=json.loads(subprocess.check_output(['hyprctl','-j','clients'],text=True))
        clients=switcher_clients(clients)
        self.clients={w['address']:w for w in clients}; self.workspace=workspace
        clients.sort(key=lambda w:w.get('focusHistoryID',999))
        icons={'boralances-terminal':'boralances-terminal','boralances-browser':'boralances-browser','thunar':'boralances-files','boralances-settings':'boralances-settings'}
        for window in clients:
            item=QListWidgetItem(QIcon.fromTheme(icons.get(window['class'],window['class']),QIcon.fromTheme('application-x-executable')),window.get('title') or window['class'])
            item.setData(Qt.ItemDataRole.UserRole,window['address']); self.windows.addItem(item)
        current=next((i for i,w in enumerate(clients) if w['address']==active.get('address')),0)
        if clients: self.windows.setCurrentRow((current+(-1 if backward else 1))%len(clients))
        else: self.label('No other windows on this desktop.')
        self.windows.itemClicked.connect(lambda _item:self.accept())
        self.windows.itemActivated.connect(lambda _item:self.accept())
        self.pid=Path(os.environ['XDG_RUNTIME_DIR'])/'boralances-switcher.pid'; self.pid.write_text(str(os.getpid()))
        signal.signal(signal.SIGUSR1,lambda *_:self.step(1)); signal.signal(signal.SIGUSR2,lambda *_:self.step(-1))
        self.signal_timer=QTimer(self); self.signal_timer.timeout.connect(self.check_release); self.signal_timer.start(50)
        self.windows.setFocus()

    def step(self,delta):
        if self.windows.count(): self.windows.setCurrentRow((self.windows.currentRow()+delta)%self.windows.count())

    def check_release(self):
        runtime=Path(os.environ['XDG_RUNTIME_DIR'])
        try:
            requested=float((runtime/'boralances-switcher-request').read_text())
            released=float((runtime/'boralances-switcher-release').read_text())
            if released>=requested: self.accept()
        except (OSError,ValueError): pass

    def keyReleaseEvent(self,event):
        if event.key() in (Qt.Key.Key_Alt,Qt.Key.Key_AltGr): self.accept()
        else: super().keyReleaseEvent(event)

    def accept(self):
        item=self.windows.currentItem()
        if item:
            address=item.data(Qt.ItemDataRole.UserRole)
            if re.fullmatch(r'0x[0-9a-fA-F]+',address):
                if self.clients[address].get('workspace',{}).get('name','').startswith('special:boralances-'):
                    subprocess.run(['hyprctl','eval',f'hl.dispatch(hl.dsp.window.move({{window="address:{address}",workspace="{self.workspace}",follow=false}}))'],check=False)
                subprocess.run(['hyprctl','eval',f'hl.dispatch(hl.dsp.focus({{window="address:{address}"}})); hl.dispatch(hl.dsp.window.bring_to_top())'],check=False)
        self.close()

    def keyPressEvent(self,event):
        if event.key() in (Qt.Key.Key_Tab,Qt.Key.Key_Backtab): self.step(-1 if event.modifiers() & Qt.KeyboardModifier.ShiftModifier or event.key()==Qt.Key.Key_Backtab else 1)
        elif event.key() in (Qt.Key.Key_Return,Qt.Key.Key_Enter): self.accept()
        elif event.key()==Qt.Key.Key_Escape: self.close()
        else: super().keyPressEvent(event)

    def closeEvent(self,event):
        if self.pid.exists() and self.pid.read_text()==str(os.getpid()): self.pid.unlink()
        super().closeEvent(event)
