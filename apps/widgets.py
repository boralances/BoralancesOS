"""Opt-in layer-shell cards. One shared timer; expensive reads run off the GTK thread."""
from datetime import datetime
import calendar
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import time
from zoneinfo import ZoneInfo,ZoneInfoNotFoundError
import gi
gi.require_version('Gtk','3.0'); gi.require_version('GtkLayerShell','0.1')
from gi.repository import Gtk,Gdk,GLib,GtkLayerShell
from widget_catalog import WIDGETS

CONFIG=Path(os.environ.get('XDG_CONFIG_HOME',Path.home()/'.config'))/'boralances/state.json'
DATA=Path(os.environ.get('XDG_DATA_HOME',Path.home()/'.local/share'))/'boralances-widgets'
try: state=json.loads(CONFIG.read_text())
except (OSError,ValueError): state={}
enabled={name for name,_,_ in WIDGETS if state.get('widget-'+name)=='true'}
if not enabled and state.get('widget-clock')!='true' and state.get('widget-monitor')!='true': raise SystemExit(0)

windows=[];placement_file=CONFIG.parent/'widget-positions.json'
try:placements=json.loads(placement_file.read_text())
except (OSError,ValueError):placements={}
monitor=Gdk.Display.get_default().get_primary_monitor() or Gdk.Display.get_default().get_monitor(0)
geometry=monitor.get_geometry();screen_width,screen_height=geometry.width,geometry.height
clock=Gtk.Label();clock.set_name('clock');date=Gtk.Label();date.set_name('date')

def floating_widget(content,name,handle,index=0):
    win=Gtk.Window();win.set_title('Boralances '+name);win.set_app_paintable(True);win.set_visual(win.get_screen().get_rgba_visual())
    GtkLayerShell.init_for_window(win);GtkLayerShell.set_namespace(win,'boralances-widgets');GtkLayerShell.set_layer(win,GtkLayerShell.Layer.BOTTOM)
    GtkLayerShell.set_keyboard_mode(win,GtkLayerShell.KeyboardMode.ON_DEMAND if name in ('notes','todo') else GtkLayerShell.KeyboardMode.NONE)
    GtkLayerShell.set_anchor(win,GtkLayerShell.Edge.TOP,True);GtkLayerShell.set_anchor(win,GtkLayerShell.Edge.LEFT,True);GtkLayerShell.set_exclusive_zone(win,-1)
    position=state.get('widget-position','center');count=len(enabled)+(state.get('widget-monitor')=='true');columns=min(3,max(1,count))
    default_x=(screen_width-(300 if name=='clock' else columns*230))//2
    if position=='left':default_x=28
    elif position=='right':default_x=screen_width-(320 if name=='clock' else columns*230)-28
    default=[default_x if name=='clock' else default_x+(index%columns)*230,90 if name=='clock' else 250+(index//columns)*180]
    current=list(placements.get(name,default));drag={}
    def apply_position(x,y):
        current[:]=[max(0,min(int(x),max(0,screen_width-max(210,win.get_allocated_width())))),max(38,min(int(y),max(38,screen_height-max(100,win.get_allocated_height())-90)))]
        GtkLayerShell.set_margin(win,GtkLayerShell.Edge.LEFT,current[0]);GtkLayerShell.set_margin(win,GtkLayerShell.Edge.TOP,current[1])
    apply_position(*current)
    def press(_widget,event):
        if event.button==1:drag.update(root=(event.x_root,event.y_root),origin=tuple(current));return True
        return False
    def motion(_widget,event):
        if drag and event.state & Gdk.ModifierType.BUTTON1_MASK:apply_position(drag['origin'][0]+event.x_root-drag['root'][0],drag['origin'][1]+event.y_root-drag['root'][1]);return True
        return False
    def release(_widget,event):
        if event.button==1 and drag:
            placements[name]=current[:];placement_file.parent.mkdir(parents=True,exist_ok=True);temporary=placement_file.with_suffix('.tmp');temporary.write_text(json.dumps(placements,indent=2));temporary.replace(placement_file);drag.clear();return True
        return False
    handle.set_tooltip_text('Drag to place this widget anywhere')
    handle.add_events(Gdk.EventMask.BUTTON_PRESS_MASK|Gdk.EventMask.BUTTON_RELEASE_MASK|Gdk.EventMask.BUTTON_MOTION_MASK)
    handle.connect('button-press-event',press);handle.connect('motion-notify-event',motion);handle.connect('button-release-event',release)
    win.add(content);windows.append(win)

if state.get('widget-clock')=='true':
    clock_box=Gtk.Box(orientation=Gtk.Orientation.VERTICAL,spacing=12);clock_handle=Gtk.EventBox();clock_handle.set_visible_window(False);clock_handle.add(date)
    clock_box.pack_start(clock_handle,False,False,0);clock_box.pack_start(clock,False,False,0);floating_widget(clock_box,'clock',clock_handle)
labels={}; pool=ThreadPoolExecutor(max_workers=1); pending=None; values={}; tick_count=0; previous_cpu=None; previous_net=None
started=None; elapsed=0; deadline=None

def launch(args):
    subprocess.Popen(['systemd-run','--user','--collect','--property=ExitType=cgroup',*args],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def action(box,title,args):
    button=Gtk.Button(label=title); button.connect('clicked',lambda _b:launch(args)); box.pack_start(button,False,False,0)

def save_note(entry,name):
    DATA.mkdir(parents=True,exist_ok=True,mode=0o700)
    path=DATA/(name+'.txt'); path.write_text(entry.get_text()); path.chmod(0o600)

def timer_action(_button):
    global deadline
    deadline=None if deadline else time.monotonic()+25*60

def stopwatch_action(_button):
    global started,elapsed
    if started: elapsed+=time.monotonic()-started; started=None
    else: started=time.monotonic()

def reset_stopwatch(_button):
    global started,elapsed
    started=None; elapsed=0

def card(name,title):
    box=Gtk.Box(orientation=Gtk.Orientation.VERTICAL,spacing=7); box.set_name('card'); box.set_size_request(190,95)
    heading=Gtk.Label(label=title); heading.set_xalign(0); heading.set_name('heading'); handle=Gtk.EventBox();handle.set_visible_window(False);handle.add(heading);box.pack_start(handle,False,False,0)
    label=Gtk.Label(); label.set_xalign(0); label.set_line_wrap(True); label.set_max_width_chars(25); box.pack_start(label,False,False,0); labels[name]=label
    if name in ('notes','todo'):
        entry=Gtk.Entry(); entry.set_placeholder_text('Write a note' if name=='notes' else 'Next task')
        try: entry.set_text((DATA/(name+'.txt')).read_text()[:1000])
        except OSError: pass
        entry.connect('activate',lambda e,n=name:save_note(e,n)); entry.connect('focus-out-event',lambda e,_event,n=name:save_note(e,n))
        box.pack_start(entry,False,False,0)
        if name=='todo':
            done=Gtk.CheckButton(label='Completed'); box.pack_start(done,False,False,0)
    if name=='calendar':
        cal=Gtk.Calendar(); box.pack_start(cal,False,False,0)
    if name=='timer':
        button=Gtk.Button(label='Start / Cancel 25 min'); button.connect('clicked',timer_action); box.pack_start(button,False,False,0)
    if name=='stopwatch':
        button=Gtk.Button(label='Start / Pause'); button.connect('clicked',stopwatch_action); box.pack_start(button,False,False,0)
        button=Gtk.Button(label='Reset'); button.connect('clicked',reset_stopwatch); box.pack_start(button,False,False,0)
    if name=='desktops':
        for n in (1,2,3,4): action(box,'Desktop '+str(n),['hyprctl','eval',f'hl.dispatch(hl.dsp.focus({{workspace={n}}}))'])
    if name=='session':
        action(box,'Lock',['hyprlock']);action(box,'Settings',['boralances-control-center'])
    if name=='connections': action(box,'Network settings',['boralances-control','center','network'])
    if name=='focus': action(box,'Toggle Focus',['dunstctl','set-paused','toggle'])
    if name=='media': action(box,'Play / Pause',['playerctl','play-pause'])
    if name=='volume': action(box,'Mute / Unmute',['wpctl','set-mute','@DEFAULT_AUDIO_SINK@','toggle'])
    if name in ('downloads','trash'): action(box,'Open',['thunar',str(Path.home()/'Downloads') if name=='downloads' else 'trash:///'])
    if name=='bookmarks':
        for title,path in [('Home',Path.home()),('Documents',Path.home()/'Documents'),('Downloads',Path.home()/'Downloads')]: action(box,title,['thunar',str(path)])
    if name=='quicklaunch':
        for title,binary in [('Browser','boralances-browser'),('Files','thunar'),('Terminal','boralances-terminal')]: action(box,title,[binary])
    floating_widget(box,name,handle,len(windows)-(state.get('widget-clock')=='true'))
for name,title,_ in WIDGETS:
    if name in enabled: card(name,title)
if state.get('widget-monitor')=='true': card('monitor','System monitor')

css=Gtk.CssProvider(); clock_size=74 if state.get('widget-clock-size','large')=='large' else 48
css.load_from_data(('window{background:transparent;} label{font-family:Inter;color:#edf3ff;} #clock{font-size:'+str(clock_size)+'px;font-weight:500;} #date{font-size:20px;} #card{background:rgba(20,28,44,0.72);border:1px solid rgba(255,255,255,0.18);border-radius:18px;padding:15px;} #heading{font-weight:600;color:#b9d6ff;} button,entry{font-family:Inter;font-size:12px;} flowboxchild{padding:0;}').encode())
Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),css,Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

def output(args):
    try: return subprocess.run(args,capture_output=True,text=True,timeout=2).stdout.strip()
    except (OSError,subprocess.TimeoutExpired): return ''

def slow_reads():
    result={}
    if 'connections' in enabled: result['connections']=output(['nmcli','-t','-f','NAME,TYPE','connection','show','--active']) or 'Offline'
    if 'media' in enabled: result['media']=output(['playerctl','metadata','--format','{{title}}\n{{artist}}']) or 'Not playing'
    if 'volume' in enabled: result['volume']=output(['wpctl','get-volume','@DEFAULT_AUDIO_SINK@']) or 'No output device'
    if 'focus' in enabled: result['focus']='Notifications paused' if output(['dunstctl','is-paused'])=='true' else 'Notifications enabled'
    return result

def refresh():
    global tick_count,pending,values,previous_cpu,previous_net,deadline
    tick_count+=1; now=datetime.now(); date.set_text(now.strftime('%A, %d %B')); clock.set_text(now.strftime('%I:%M %p' if state.get('clock-format')=='12h' else '%H:%M'))
    if pending and pending.done():
        try: values.update(pending.result())
        except Exception: pass
        pending=None
    if tick_count%10==1 and pending is None and enabled.intersection(('media','volume','focus','connections')): pending=pool.submit(slow_reads)
    try:
        mem={line.split(':')[0]:int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
        up=float(Path('/proc/uptime').read_text().split()[0]); disk=shutil.disk_usage(Path.home())
        cpu=list(map(int,Path('/proc/stat').read_text().splitlines()[0].split()[1:9])); total=sum(cpu); idle=cpu[3]+cpu[4]
        usage=0 if previous_cpu is None else 100*(1-(idle-previous_cpu[1])/max(1,total-previous_cpu[0])); previous_cpu=(total,idle)
        net=[0,0]
        for line in Path('/proc/net/dev').read_text().splitlines()[2:]:
            interface,data=line.split(':',1)
            if interface.strip()=='lo': continue
            fields=data.split(); net[0]+=int(fields[0]); net[1]+=int(fields[8])
        moment=time.monotonic(); rates=[0,0] if previous_net is None else [(net[i]-previous_net[i])/max(.1,moment-previous_net[2])/1024 for i in (0,1)]; previous_net=(*net,moment)
        batteries=[p for p in Path('/sys/class/power_supply').glob('*') if (p/'capacity').exists()]
        downloads=Path.home()/'Downloads'; recent=sorted((p for p in downloads.iterdir() if p.is_file()),key=lambda p:p.stat().st_mtime,reverse=True)[:2] if downloads.exists() else []
        trash=Path.home()/'.local/share/Trash/files'; count=sum(1 for _ in trash.iterdir()) if trash.exists() else 0
        values.update({'date':now.strftime('%A\n%d %B %Y'),'cpu':f'{usage:.0f}% active','memory':f"{(mem['MemTotal']-mem['MemAvailable'])/1024:.0f} MiB used\n{mem['MemTotal']/1024:.0f} MiB total",'disk':f'{disk.free/2**30:.1f} GiB free\n{disk.total/2**30:.1f} GiB total',
        'network':f'Down {rates[0]:.1f} KiB/s\nUp {rates[1]:.1f} KiB/s','battery':(batteries[0]/'capacity').read_text().strip()+'%' if batteries else 'AC power',
        'uptime':f'{int(up//3600)}h {int(up%3600//60)}m','system':platform.node()+'\nLinux '+platform.release(),'downloads':'\n'.join(p.name[:25] for p in recent) or 'No downloads yet',
        'trash':f'{count} items','load':Path('/proc/loadavg').read_text().split(' ',3)[0]+' / '+' / '.join(Path('/proc/loadavg').read_text().split()[1:3]),'swap':f"{(mem['SwapTotal']-mem['SwapFree'])/1024:.0f} MiB used",
        'monitor':f"CPU {usage:.0f}% · RAM {(mem['MemTotal']-mem['MemAvailable'])/1024:.0f} MiB",'notes':'Saved on Enter or leaving the field','todo':'One thing at a time.'})
    except (OSError,ValueError,KeyError): pass
    if 'world-clock' in enabled:
        try: values['world-clock']='\n'.join(city+'  '+datetime.now(ZoneInfo(zone)).strftime('%H:%M') for city,zone in [('UTC','UTC'),('London','Europe/London'),('New York','America/New_York'),('Tokyo','Asia/Tokyo')])
        except ZoneInfoNotFoundError: values['world-clock']=datetime.now().strftime('%H:%M')
    duration=elapsed+(time.monotonic()-started if started else 0)
    values['stopwatch']=f'{int(duration)//60:02}:{int(duration)%60:02}'
    remaining=max(0,int(deadline-time.monotonic())) if deadline else 1500
    values['timer']=f'{remaining//60:02}:{remaining%60:02}'
    if deadline and remaining==0:
        deadline=None; launch(['notify-send','Focus timer','Your 25-minute focus session has finished.'])
    for name,label in labels.items(): label.set_text(values.get(name,''))
    return True
refresh(); GLib.timeout_add_seconds(1 if enabled.intersection(('stopwatch','timer')) else 5 if enabled else 15,refresh)
for item in windows:item.show_all()
Gtk.main();pool.shutdown(wait=False,cancel_futures=True)
