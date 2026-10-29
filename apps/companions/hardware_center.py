"""On-demand GPU and device controls; no background polling or automatic recording."""
import json
import shutil
import subprocess
from PySide6.QtCore import QProcess,QTimer
from PySide6.QtWidgets import (QCheckBox,QComboBox,QHBoxLayout,QLabel,QPlainTextEdit,
    QPushButton,QTabWidget,QVBoxLayout,QWidget)
from experience import GlassWindow
from hardware_tools import graphics_devices,virtual_machine
from device_data import audio_devices


class HardwareCenter(GlassWindow):
    def __init__(self,section='gpu'):
        super().__init__('NVIDIA Center' if section=='nvidia' else 'GPU & Device Center',970,730)
        self.virtual=virtual_machine();self.nvidia=any(item['vendor']=='0x10de' for item in graphics_devices())
        self.jobs=[];self.current=None;self.runner=QProcess(self)
        self.runner.finished.connect(self.completed)
        self.runner.errorOccurred.connect(lambda error:self.completed(127) if error==QProcess.ProcessError.FailedToStart else None)
        self.deadline=QTimer(self);self.deadline.setSingleShot(True);self.deadline.timeout.connect(self.runner.kill)
        self.label('YOUR HARDWARE. CLEAR CONTROLS.','eyebrow')
        self.label('A closer look at your system.','headline')
        self.label('VirtualBox exposes virtual hardware. Pass a physical USB adapter through in VirtualBox to use it here.' if self.virtual else 'Detected Linux drivers, graphics tools, removable devices and audio routing.')
        self.tabs=QTabWidget();self.layout.addWidget(self.tabs,1)
        self.setStyleSheet(self.styleSheet()+ 'QTabWidget::pane{border:0;} QTabBar::tab{background:#1d2a40;color:#bdcde3;padding:12px 17px;border-radius:7px;margin:2px;} QTabBar::tab:selected{background:#365b80;color:white;}')
        self.make_gpu();self.make_usb();self.make_audio();self.make_network()
        self.feedback=self.label('Ready. Device queries run only while this window is open.')
        self.button('Refresh devices',self.refresh)
        self.tabs.currentChanged.connect(self.refresh)
        self.tabs.setCurrentIndex({'devices':1,'audio':2,'network':3}.get(section,0))
        self.refresh()

    def tab(self,title):
        widget=QWidget();layout=QVBoxLayout(widget);layout.setContentsMargins(18,20,18,12);layout.setSpacing(14);self.tabs.addTab(widget,title);return layout

    def report(self,layout):
        value=QPlainTextEdit();value.setReadOnly(True);value.setStyleSheet('font-family:monospace;font-size:12px;background:rgba(10,18,32,110);border:1px solid rgba(200,220,255,24);border-radius:12px;padding:12px;');layout.addWidget(value,1);return value

    def actions(self,layout,items):
        row=QHBoxLayout()
        for title,args in items:
            button=QPushButton(title);button.clicked.connect(lambda _checked=False,args=args:self.launch(args));row.addWidget(button)
        layout.addLayout(row)

    def make_gpu(self):
        page=self.tab('Graphics & NVIDIA');self.gpu_report=self.report(page)
        self.metrics=QLabel('NVIDIA metrics appear when a supported physical GPU and driver are available.');self.metrics.setWordWrap(True);page.addWidget(self.metrics)
        self.nvidia_settings=QPushButton('Open NVIDIA Settings');self.nvidia_settings.setEnabled(False)
        self.nvidia_settings.setToolTip('Requires a native NVIDIA GPU, the matching driver and NVIDIA Settings. Some controls require X11.')
        self.nvidia_settings.clicked.connect(lambda:self.launch(['nvidia-settings']));page.addWidget(self.nvidia_settings)
        self.actions(page,[('Vulkan diagnostics',['boralances-terminal','-e','boralancesos','gpu','test']),('GPU monitor (nvtop)',['boralances-gpu-monitor']),('Activity Monitor',['boralances-task-manager']),('Displays',['nwg-displays'])])
        self.actions(page,[('Driver setup plan',['boralances-terminal','-e','boralancesos','drivers','auto','install','--dry-run']),('Unreal setup',['boralances-terminal','-e','boralancesos','unreal','guide'])])
        note=QLabel('NVIDIA’s Windows App is not a Linux application. This center integrates Linux tools. AMD/Ryzen Radeon uses amdgpu + Mesa/RADV. Use Displays for Wayland monitor layout.');note.setWordWrap(True);page.addWidget(note)

    def make_usb(self):
        page=self.tab('USB & Storage');self.usb_report=self.report(page)
        self.actions(page,[('Disks',['boralances-disks']),('Open Files',['thunar']),('Device details',['boralances-terminal','-e','boralancesos','devices'])])
        note=QLabel('Supported USB storage appears in Files and Disks. Mount or eject it there. USB microphones, headsets and Wi-Fi adapters use their Linux drivers. In VirtualBox, select the specific device in Devices → USB; devices are not captured automatically.');note.setWordWrap(True);page.addWidget(note)

    def make_audio(self):
        page=self.tab('Microphone & Sound')
        self.label('Choose where sound goes, and which microphone applications use.',layout=page)
        self.label('Audio output',layout=page);self.outputs=QComboBox();page.addWidget(self.outputs)
        self.outputs.activated.connect(lambda index:self.set_audio('sink',self.outputs.itemData(index)))
        self.label('Microphone input',layout=page);self.inputs=QComboBox();page.addWidget(self.inputs)
        self.inputs.activated.connect(lambda index:self.set_audio('source',self.inputs.itemData(index)))
        self.mic_mute=QPushButton('Toggle microphone mute');self.mic_mute.clicked.connect(lambda:self.request(['wpctl','set-mute','@DEFAULT_AUDIO_SOURCE@','toggle'],lambda _text:self.refresh()));page.addWidget(self.mic_mute)
        self.mic_mute.setEnabled(False)
        self.actions(page,[('Output volume & input levels',['pavucontrol']),('Audio routing details',['boralances-terminal','-e','boralancesos','audio'])])
        self.audio_status=self.report(page)
        note=QLabel('This center does not record audio. If a VM has no input device, enable Audio Input in its VirtualBox settings. Applications still need their normal microphone permission.');note.setWordWrap(True);page.addWidget(note)

    def make_network(self):
        page=self.tab('Wi-Fi & Network');self.network_report=self.report(page)
        self.actions(page,[('Wi-Fi networks',['boralances-center','--section','network']),('Saved connections',['nm-connection-editor']),('Network menu',['boralances-terminal','-e','nmtui'])])
        note=QLabel('Wi-Fi controls require a wireless adapter visible to Linux. A VM’s NAT connection normally appears as Ethernet. Adapter support depends on the chipset, kernel driver and firmware.');note.setWordWrap(True);page.addWidget(note)

    def launch(self,args):
        subprocess.Popen(['systemd-run','--user','--collect','--property=ExitType=cgroup',*args],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

    def request(self,args,callback=None):
        self.jobs.append((args,callback));self.start_next()

    def start_next(self):
        if self.current or not self.jobs:return
        self.current=self.jobs.pop(0);args=self.current[0];self.runner.start(args[0],args[1:]);self.deadline.start(12000)

    def completed(self,code,_status=None):
        if not self.current:return
        self.deadline.stop();args,callback=self.current;self.current=None
        output=bytes(self.runner.readAllStandardOutput()).decode('utf-8',errors='replace')
        error=bytes(self.runner.readAllStandardError()).decode('utf-8',errors='replace')
        if code==0:
            if callback:
                try:callback(output)
                except (ValueError,KeyError,TypeError):self.feedback.setText('The device report could not be read. Try refreshing.')
        else:self.feedback.setText((error.strip() or 'This tool or device is unavailable in the current session.')[:220])
        self.start_next()
        if code==0 and not self.jobs and not self.current:self.feedback.setText('Device information updated.')

    def fill_audio(self,combo,text):
        combo.clear()
        for name,description in audio_devices(text):combo.addItem(description,name)
        combo.setEnabled(combo.count()>0)
        if combo is self.inputs:self.mic_mute.setEnabled(combo.count()>0)
        if combo.count()==0:combo.addItem('No device available',None)

    def select_default(self,combo,text):
        index=combo.findData(text.strip())
        if index>=0:combo.setCurrentIndex(index)

    def set_audio(self,kind,name):
        if name:self.request(['pactl','set-default-'+kind,name],lambda _text:self.refresh())

    def nvidia_metrics(self,text):
        self.metrics.setText('NVIDIA: '+text.strip());self.nvidia_settings.setEnabled(bool(shutil.which('nvidia-settings')))

    def refresh(self,*_):
        if self.current or self.jobs:return
        index=self.tabs.currentIndex();self.feedback.setText('Reading device information…')
        if index==0:
            self.request(['boralancesos','gpu'],self.gpu_report.setPlainText)
            if self.nvidia and not self.virtual and shutil.which('nvidia-smi'):
                self.request(['nvidia-smi','--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,driver_version','--format=csv,noheader'],self.nvidia_metrics)
        elif index==1:self.request(['lsusb','-t'],self.usb_report.setPlainText);self.request(['lsblk','-o','NAME,TRAN,SIZE,MODEL,MOUNTPOINTS'],lambda text:self.usb_report.appendPlainText('\n'+text))
        elif index==2:
            self.request(['pactl','--format=json','list','sinks'],lambda text:self.fill_audio(self.outputs,text))
            self.request(['pactl','--format=json','list','sources'],lambda text:self.fill_audio(self.inputs,text))
            self.request(['pactl','get-default-sink'],lambda text:self.select_default(self.outputs,text))
            self.request(['pactl','get-default-source'],lambda text:self.select_default(self.inputs,text))
            self.request(['wpctl','status'],self.audio_status.setPlainText)
        else:self.request(['nmcli','device','status'],self.network_report.setPlainText)
