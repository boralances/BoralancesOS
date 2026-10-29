"""On-demand glass quick settings; device reads never block the UI thread."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

from PySide6.QtCore import Qt, QProcess, QTimer, QByteArray, QSize
from PySide6.QtGui import QIcon, QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import (QApplication, QFrame, QGridLayout, QHBoxLayout,
    QLabel, QPushButton, QSlider, QVBoxLayout, QWidget)

CONFIG = Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config')) / 'boralances'
PATHS = {
    'wifi': '<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>',
    'wired': '<rect x="5" y="3" width="14" height="12" rx="2"/><path d="M12 15v5M7 21h10M8 7h8"/>',
    'bluetooth': '<path d="m8 7 9 10-5 5V2l5 5-9 10"/>',
    'focus': '<path d="M19 15A9 9 0 0 1 9 3a9 9 0 1 0 10 12Z"/>',
    'bell': '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4"/>',
    'display': '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/>',
    'sound': '<path d="m4 9 4 0 5-5v16l-5-5H4ZM17 8a7 7 0 0 1 0 8M20 5a11 11 0 0 1 0 14"/>',
    'play': '<path d="m9 5 11 7-11 7Z"/>',
    'previous': '<path d="M5 5v14M19 5 7 12l12 7Z"/>',
    'next': '<path d="M19 5v14M5 5l12 7L5 19Z"/>',
    'battery': '<rect x="2" y="6" width="18" height="12" rx="3"/><path d="M23 10v4M6 10v4M10 10v4M14 10v4"/>',
}


def icon(name, color='#edf3ff'):
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{PATHS[name]}</svg>'
    pixmap=QPixmap(28,28); pixmap.fill(Qt.GlobalColor.transparent)
    painter=QPainter(pixmap); QSvgRenderer(QByteArray(svg.encode())).render(painter); painter.end()
    return QIcon(pixmap)


class QuickSettings(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('Control Center')
        self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedSize(420, 594)
        self.pending=[]; self.current=None
        self.worker=QProcess(self)
        self.worker.finished.connect(self.finished)
        self.worker.errorOccurred.connect(self.failed)
        self.timeout=QTimer(self); self.timeout.setSingleShot(True)
        self.timeout.timeout.connect(self.worker.kill)
        try: self.state=json.loads((CONFIG/'state.json').read_text())
        except (OSError,ValueError): self.state={}
        outer=QVBoxLayout(self); outer.setContentsMargins(0,0,0,0)
        surface=QFrame(); surface.setObjectName('quickSurface'); outer.addWidget(surface)
        body=QVBoxLayout(surface); body.setContentsMargins(16,15,16,14); body.setSpacing(11)
        heading=QHBoxLayout(); title=QLabel('Control Center'); title.setObjectName('heading')
        heading.addWidget(title); heading.addStretch()
        close=QPushButton('×'); close.setAccessibleName('Close Control Center'); close.setObjectName('close')
        close.setFixedSize(25,25); close.clicked.connect(self.close); heading.addWidget(close); body.addLayout(heading)
        upper=QHBoxLayout(); upper.setSpacing(10)
        connections=QVBoxLayout(); connections.setSpacing(10)
        self.network=self.tile('wifi','Network','Checking connection…',lambda:self.open_center('network'))
        self.bluetooth=self.tile('bluetooth','Bluetooth','Checking adapter…',lambda:self.open_center('bluetooth'))
        connections.addWidget(self.network); connections.addWidget(self.bluetooth); upper.addLayout(connections,1)
        media=QFrame(); media.setObjectName('card'); ml=QVBoxLayout(media); ml.setContentsMargins(14,14,14,12)
        self.media_title=QLabel('Not Playing'); self.media_title.setWordWrap(True); self.media_title.setObjectName('mediaTitle')
        self.media_artist=QLabel('Your music, right here'); self.media_artist.setWordWrap(True); self.media_artist.setObjectName('detail')
        ml.addWidget(self.media_title); ml.addWidget(self.media_artist); ml.addStretch()
        transport=QHBoxLayout(); self.transport=[]
        for name,action in [('previous','previous'),('play','play-pause'),('next','next')]:
            button=QPushButton(); button.setIcon(icon(name)); button.setIconSize(QSize(20,20)); button.setFixedSize(35,35)
            button.setAccessibleName(action.replace('-',' ')); button.setObjectName('round')
            button.clicked.connect(lambda _=False,a=action:self.command('playerctl',a))
            transport.addWidget(button); self.transport.append(button)
        ml.addLayout(transport); upper.addWidget(media,1); body.addLayout(upper)
        modes=QHBoxLayout(); modes.setSpacing(8)
        self.focus=self.small('focus','Focus',self.focus_action)
        self.alerts=self.small('bell','Alerts',lambda:self.open_app('dunstctl','history-pop'))
        display=self.small('display','Display',lambda:self.open_center('display'))
        battery=self.small('battery','Power',lambda:self.open_center('power'))
        for item in (battery,self.focus,self.alerts,display): modes.addWidget(item)
        body.addLayout(modes)
        sound, self.volume, self.volume_detail=self.slider_card('sound','Sound')
        self.volume.setEnabled(False); self.volume.setValue(0)
        self.volume.sliderReleased.connect(lambda:self.command('wpctl','set-volume','@DEFAULT_AUDIO_SINK@',f'{self.volume.value()}%'))
        self.volume.valueChanged.connect(lambda value:self.volume_detail.setText(f'{value}%'))
        body.addWidget(sound)
        brightness,self.brightness,self.brightness_detail=self.slider_card('display','Display')
        self.brightness.setEnabled(False); self.brightness_detail.setText('Managed by VirtualBox' if self.is_vm() else 'No brightness device')
        self.brightness.sliderReleased.connect(lambda:self.command('brightnessctl','set',f'{max(1,self.brightness.value())}%'))
        body.addWidget(brightness)
        bottom=QHBoxLayout(); self.feedback=QLabel('BoralancesOS'); self.feedback.setObjectName('detail')
        bottom.addWidget(self.feedback,1); settings=QPushButton('System Settings  ›'); settings.setObjectName('footer')
        settings.clicked.connect(lambda:self.open_settings('desktop')); bottom.addWidget(settings); body.addLayout(bottom)
        self.setStyleSheet('''
          QWidget{background:transparent;color:#f1f4fa;font:13px Inter;}
          QFrame#quickSurface{background:qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 rgba(39,43,53,248),stop:1 rgba(19,23,32,248));border:1px solid rgba(255,255,255,48);border-radius:22px;}
          QLabel#heading{font-size:15px;font-weight:600;} QLabel#detail{color:#afb7c7;font-size:11px;}
          QFrame#card,QPushButton#tile{background:rgba(220,231,250,13);border:1px solid rgba(255,255,255,27);border-radius:17px;}
          QPushButton#tile{padding:13px 10px;text-align:left;min-height:50px;font-weight:500;}
          QPushButton#tile:hover{background:rgba(160,190,235,38);border-color:rgba(205,224,255,70);}
          QLabel#mediaTitle{font-size:14px;font-weight:600;} QPushButton{border:0;padding:4px;}
          QPushButton#round{background:rgba(235,242,255,22);border:1px solid rgba(255,255,255,23);border-radius:17px;}
          QPushButton#round:checked{background:#3678d5;} QPushButton#round:hover{background:rgba(184,211,255,55);}
          QPushButton#small{font-size:11px;min-width:70px;padding:5px 0;}
          QPushButton#small:checked{background:rgba(74,132,220,50);border-radius:14px;}
          QPushButton:disabled{color:#798291;} QPushButton:focus{outline:0;border:1px solid #a8ceff;}
          QPushButton#close{color:#c1c8d5;font-size:20px;border-radius:12px;} QPushButton#close:hover{background:#ffffff18;}
          QPushButton#footer{font-size:11px;color:#c3d8fa;padding:5px 0;}
          QSlider::groove:horizontal{height:8px;background:rgba(255,255,255,40);border-radius:4px;}
          QSlider::sub-page:horizontal{background:#eef4ff;border-radius:4px;}
          QSlider::handle:horizontal{width:19px;margin:-6px 0;border-radius:9px;background:#ffffff;border:1px solid #c7cfdb;}
          QSlider::sub-page:horizontal:disabled{background:#66707e;} QSlider::handle:horizontal:disabled{background:#838c99;}
        ''')
        if self.state.get('theme')=='light':
            self.setStyleSheet(self.styleSheet()+'''QWidget{color:#1d293d;} QFrame#quickSurface{background:rgba(237,243,252,250);border-color:#ffffff;}
              QFrame#card,QPushButton#tile{background:rgba(255,255,255,160);border-color:rgba(40,65,100,25);}
              QLabel#detail{color:#58667b;} QPushButton#footer{color:#305d9e;}''')
        self.refresh_timer=QTimer(self); self.refresh_timer.timeout.connect(self.refresh); self.refresh_timer.start(5000)
        self.refresh()

    @staticmethod
    def is_vm():
        try: return Path('/sys/class/dmi/id/product_name').read_text().strip()=='VirtualBox'
        except OSError: return False

    def tile(self,name,title,detail,callback):
        button=QPushButton(title+'\n'+detail); button.setObjectName('tile'); button.setIcon(icon(name))
        button.setIconSize(QSize(28,28)); button.clicked.connect(callback); return button

    def small(self,name,title,callback):
        button=QPushButton(title); button.setObjectName('small'); button.setIcon(icon(name)); button.setIconSize(QSize(24,24))
        button.setCheckable(name=='focus'); button.clicked.connect(callback); button.setMinimumHeight(55); return button

    def slider_card(self,name,title):
        card=QFrame(); card.setObjectName('card'); column=QVBoxLayout(card); column.setContentsMargins(16,14,16,16); column.setSpacing(15)
        row=QHBoxLayout(); image=QLabel(); image.setPixmap(icon(name).pixmap(21,21)); row.addWidget(image)
        row.addWidget(QLabel(title),1); detail=QLabel(''); detail.setObjectName('detail'); row.addWidget(detail); column.addLayout(row)
        slider=QSlider(Qt.Orientation.Horizontal); slider.setRange(0,100); slider.setAccessibleName(title+' level'); column.addWidget(slider)
        return card,slider,detail

    def command(self,*args,callback=None):
        self.pending.append((args,callback))
        if self.current is None: self.next_command()

    def next_command(self):
        if not self.pending: return
        self.current=self.pending.pop(0); args,_=self.current
        self.worker.start(args[0],list(args[1:])); self.timeout.start(5000)

    def failed(self,_error):
        if self.worker.state()==QProcess.ProcessState.NotRunning and self.current:
            self.finished(127,QProcess.ExitStatus.CrashExit)

    def finished(self,code,_status):
        if self.current is None: return
        self.timeout.stop(); args,callback=self.current; self.current=None
        text=bytes(self.worker.readAllStandardOutput()).decode(errors='replace').strip()
        self.worker.readAllStandardError()
        if callback: callback(code,text)
        elif code: self.feedback.setText('This control is unavailable right now.')
        else: self.feedback.setText('Updated'); QTimer.singleShot(400,getattr(self,'refresh_center',self.refresh))
        self.next_command()

    def refresh(self):
        if self.pending or self.current: return
        self.command('nmcli','-t','-f','TYPE,STATE,CONNECTION','device',callback=self.network_result)
        self.command('bluetoothctl','show',callback=self.bluetooth_result)
        self.command('wpctl','get-volume','@DEFAULT_AUDIO_SINK@',callback=self.volume_result)
        self.command('dunstctl','is-paused',callback=lambda code,text:self.focus.setChecked(code==0 and text=='true'))
        self.command('playerctl','metadata','--format','{{title}}\n{{artist}}',callback=self.media_result)
        if any(Path('/sys/class/backlight').glob('*')):
            self.command('brightnessctl','-m',callback=self.brightness_result)

    def network_result(self,code,text):
        connected=[line for line in text.splitlines() if ':connected:' in line]
        if connected:
            kind,_,name=connected[0].split(':',2)
            self.network.setText(('Wi-Fi' if kind=='wifi' else 'Wired')+'\n'+name[:20])
            self.network.setIcon(icon('wifi' if kind=='wifi' else 'wired'))
        else: self.network.setText('Network\n'+('Offline' if code==0 else 'Unavailable'))

    def bluetooth_result(self,code,text):
        self.bluetooth_available=code==0 and 'Controller ' in text
        self.bluetooth_on='Powered: yes' in text
        self.bluetooth.setText('Bluetooth\n'+('On' if self.bluetooth_on else 'Off') if self.bluetooth_available else 'Bluetooth\nNo adapter')
        self.bluetooth.setEnabled(self.bluetooth_available)

    def bluetooth_action(self):
        self.command('bluetoothctl','power','off' if getattr(self,'bluetooth_on',False) else 'on')

    def volume_result(self,code,text):
        match=re.search(r'Volume:\s*([0-9.]+)',text)
        self.volume.setEnabled(code==0 and bool(match))
        if match and not self.volume.isSliderDown():
            self.volume.setValue(round(float(match[1])*100)); self.volume_detail.setText('Muted' if '[MUTED]' in text else f'{self.volume.value()}%')
        elif code: self.volume_detail.setText('No audio output')

    def brightness_result(self,code,text):
        match=re.search(r',([0-9]+)%,',text)
        self.brightness.setEnabled(code==0 and bool(match))
        if match and not self.brightness.isSliderDown():
            self.brightness.setValue(int(match[1])); self.brightness_detail.setText(match[1]+'%')

    def media_result(self,code,text):
        values=text.splitlines()
        self.media_title.setText(values[0][:55] if code==0 and values else 'Not Playing')
        self.media_artist.setText(values[1][:45] if code==0 and len(values)>1 else 'Your music, right here')
        for button in self.transport: button.setEnabled(code==0)

    def focus_action(self):
        self.command('boralances-control','set','notifications-paused','true' if self.focus.isChecked() else 'false')

    def open_app(self,*args):
        binary=shutil.which(args[0])
        if binary:
            subprocess.Popen(['systemd-run','--user','--collect','--property=ExitType=cgroup',binary,*args[1:]],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            self.close()
        else: self.feedback.setText('This application is unavailable.')

    def open_settings(self,page): self.open_app('boralances-control-center','--page',page)

    def open_center(self,section): self.open_app('boralances-control','center',section)

    def keyPressEvent(self,event):
        if event.key()==Qt.Key.Key_Escape: self.close()
        else: super().keyPressEvent(event)

    def closeEvent(self,event):
        self.pending.clear(); self.refresh_timer.stop(); self.timeout.stop()
        if self.worker.state()!=QProcess.ProcessState.NotRunning:
            self.worker.kill(); self.worker.waitForFinished(200)
        event.accept()
