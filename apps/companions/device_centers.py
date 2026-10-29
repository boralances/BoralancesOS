"""Focused, on-demand device panels for individual menu-bar buttons."""
import json
from pathlib import Path
from PySide6.QtCore import Qt,QSize
from PySide6.QtWidgets import QFrame,QLabel,QPushButton,QVBoxLayout,QHBoxLayout,QListWidget,QComboBox,QProgressBar
from quick_settings import QuickSettings,icon


def clear_layout(layout):
    while layout.count():
        item=layout.takeAt(0)
        if item.widget(): item.widget().hide()
        elif item.layout(): clear_layout(item.layout())


class DeviceCenter(QuickSettings):
    def __init__(self,section='network'):
        super().__init__()
        self.section=section if section in ('network','bluetooth','sound','display','power','media') else 'network'
        self.refresh_timer.stop(); self.refresh_timer.timeout.disconnect()
        body=self.findChild(QFrame,'quickSurface').layout(); clear_layout(body)
        self.setFixedSize(420,470 if self.section in ('network','bluetooth','display') else 360)
        title={'network':'Network','bluetooth':'Bluetooth','sound':'Sound','display':'Display','power':'Power','media':'Now Playing'}[self.section]
        self.setWindowTitle(title+' Center')
        header=QHBoxLayout(); heading=QLabel(title); heading.setObjectName('heading'); header.addWidget(heading,1)
        close=QPushButton('×'); close.setObjectName('close'); close.setFixedSize(25,25); close.clicked.connect(self.close); header.addWidget(close); body.addLayout(header)
        self.center_status=QLabel('Reading device status…'); self.center_status.setWordWrap(True); self.center_status.setObjectName('detail'); body.addWidget(self.center_status)
        if self.section in ('network','bluetooth'):
            self.device_list=QListWidget(); self.device_list.setStyleSheet('background:rgba(230,240,255,10);border:1px solid rgba(255,255,255,22);border-radius:12px;padding:8px;'); body.addWidget(self.device_list,1)
            self.radio=QPushButton('Wi-Fi' if self.section=='network' else 'Bluetooth'); self.radio.setCheckable(True)
            self.radio.clicked.connect(self.radio_action); body.addWidget(self.radio)
            button=QPushButton('Connection Settings…' if self.section=='network' else 'Pair a Device…')
            button.clicked.connect(lambda:self.open_app('nm-connection-editor' if self.section=='network' else 'blueman-manager')); body.addWidget(button)
        elif self.section=='sound':
            card,self.volume,self.volume_detail=self.slider_card('sound','Output volume'); body.addWidget(card)
            self.volume.sliderReleased.connect(lambda:self.command('wpctl','set-volume','@DEFAULT_AUDIO_SINK@',str(self.volume.value())+'%'))
            mute=QPushButton('Mute / Unmute'); mute.clicked.connect(lambda:self.command('wpctl','set-mute','@DEFAULT_AUDIO_SINK@','toggle')); body.addWidget(mute)
            button=QPushButton('Output & Input Devices…'); button.clicked.connect(lambda:self.open_app('pavucontrol')); body.addWidget(button)
        elif self.section=='display':
            self.resolution=QComboBox(); self.scale=QComboBox(); self.output=QComboBox()
            for value in ('1','1.25','1.5','1.75','2'): self.scale.addItem(value+'×',value)
            for title,widget in [('Screen',self.output),('Resolution',self.resolution),('Scale',self.scale)]:
                body.addWidget(QLabel(title)); body.addWidget(widget)
            self.output.currentIndexChanged.connect(self.display_selected)
            apply=QPushButton('Apply Display Settings'); apply.clicked.connect(self.apply_display); body.addWidget(apply)
            self.command('hyprctl','-j','monitors',callback=self.displays_result)
        elif self.section=='power':
            self.battery_level=QProgressBar(); self.battery_level.setRange(0,100); body.addWidget(self.battery_level)
            body.addWidget(QLabel('Desktop effects'))
            self.profile=QComboBox()
            for label,value in [('Fluid','fluid'),('Performance','performance'),('Reduced motion','reduced-motion')]: self.profile.addItem(label,value)
            self.profile.setCurrentIndex(max(0,self.profile.findData(self.state.get('profile','fluid'))))
            self.profile.currentIndexChanged.connect(lambda _i:self.command('boralances-control','profile',self.profile.currentData())); body.addWidget(self.profile)
            button=QPushButton('Power & Session Settings…'); button.clicked.connect(lambda:self.open_settings('about')); body.addWidget(button)
        else:
            self.media_title=QLabel('Not Playing'); self.media_title.setWordWrap(True); self.media_title.setObjectName('mediaTitle'); body.addWidget(self.media_title)
            self.media_artist=QLabel('Open a media player to begin.'); self.media_artist.setWordWrap(True); body.addWidget(self.media_artist)
            row=QHBoxLayout(); self.transport=[]
            for name,action in [('previous','previous'),('play','play-pause'),('next','next')]:
                button=QPushButton(); button.setIcon(icon(name)); button.setIconSize(QSize(27,27)); button.setMinimumHeight(55)
                button.clicked.connect(lambda _=False,a=action:self.command('playerctl',a)); row.addWidget(button); self.transport.append(button)
            body.addLayout(row)
        body.addStretch()
        self.feedback=QLabel(''); self.feedback.setObjectName('detail'); body.addWidget(self.feedback)
        self.refresh_timer.timeout.connect(self.refresh_center); self.refresh_timer.start(5000); self.refresh_center()

    def refresh_center(self):
        if self.pending or self.current: return
        if self.section=='network':
            self.command('nmcli','-t','-f','TYPE,STATE,CONNECTION','device',callback=self.network_devices)
        elif self.section=='bluetooth':
            self.command('bluetoothctl','show',callback=self.bluetooth_devices)
            self.command('bluetoothctl','devices','Paired',callback=self.paired_devices)
        elif self.section=='sound':
            self.command('wpctl','get-volume','@DEFAULT_AUDIO_SINK@',callback=self.volume_result)
            self.command('wpctl','inspect','@DEFAULT_AUDIO_SINK@',callback=self.sound_name)
        elif self.section=='power':
            batteries=[p for p in Path('/sys/class/power_supply').glob('*') if (p/'capacity').exists()]
            if batteries:
                try:
                    capacity=int((batteries[0]/'capacity').read_text()); status=(batteries[0]/'status').read_text().strip()
                    self.center_status.setText(f'{capacity}% · {status}'); self.battery_level.setValue(capacity)
                except (OSError,ValueError): self.center_status.setText('Power status unavailable')
            else: self.center_status.setText('Connected to power'); self.battery_level.setValue(100)
        elif self.section=='media':
            self.command('playerctl','metadata','--format','{{title}}\n{{artist}}',callback=self.media_result)
            self.center_status.setText('Playback controls for your active media player.')

    def network_devices(self,code,text):
        self.device_list.clear(); self.has_radio=False; connected=False
        for line in text.splitlines():
            fields=line.split(':',2)
            if len(fields)!=3: continue
            kind,state,name=fields
            if kind=='wifi': self.has_radio=True
            if kind in ('ethernet','wifi'):
                self.device_list.addItem(('Wi-Fi' if kind=='wifi' else 'Wired')+' · '+(name or state))
                connected |= state=='connected'
        self.center_status.setText('Connected' if connected else 'No active connection')
        self.radio.setEnabled(self.has_radio); self.radio.setText('Toggle Wi-Fi' if self.has_radio else 'No Wi-Fi adapter in this VM')
        if self.has_radio: self.command('nmcli','radio','wifi',callback=lambda c,t:self.radio.setChecked(c==0 and t=='enabled'))

    def bluetooth_devices(self,code,text):
        available=code==0 and 'Controller ' in text; self.radio.setEnabled(available)
        self.radio.setChecked('Powered: yes' in text); self.center_status.setText('Bluetooth on' if self.radio.isChecked() else 'Bluetooth off' if available else 'No Bluetooth adapter connected')

    def paired_devices(self,code,text):
        self.device_list.clear()
        if code==0:
            for line in text.splitlines(): self.device_list.addItem(line.split(' ',2)[-1])
        if not self.device_list.count(): self.device_list.addItem('No paired devices')

    def radio_action(self):
        if self.section=='network': self.command('nmcli','radio','wifi','on' if self.radio.isChecked() else 'off')
        else: self.command('bluetoothctl','power','on' if self.radio.isChecked() else 'off')

    def sound_name(self,code,text):
        names=[line.split('=',1)[1].strip().strip('"') for line in text.splitlines() if 'node.description =' in line]
        self.center_status.setText(names[0] if names else 'Default audio output')

    def displays_result(self,code,text):
        if code: self.center_status.setText('Display information unavailable'); return
        try: self.monitors=json.loads(text)
        except ValueError: return
        self.output.blockSignals(True); self.output.clear()
        for monitor in self.monitors: self.output.addItem(monitor['name'])
        self.output.blockSignals(False); self.display_selected()

    def display_selected(self):
        if not getattr(self,'monitors',None): return
        monitor=self.monitors[self.output.currentIndex()]; self.resolution.clear()
        current=f"{monitor['width']}x{monitor['height']}@{monitor['refreshRate']:.2f}"
        self.resolution.addItem(current,current)
        for mode in monitor.get('availableModes',[]):
            value=mode.removesuffix('Hz')
            if value!=current: self.resolution.addItem(value,value)
        self.scale.setCurrentIndex(max(0,self.scale.findData(str(monitor['scale']).removesuffix('.0'))))
        self.center_status.setText('Changes are saved for this screen.')

    def apply_display(self):
        self.command('boralances-control','display-set',self.output.currentText(),self.resolution.currentData(),self.scale.currentData())
