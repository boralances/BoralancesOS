"""Layer-shell dock: grouped windows, hover chooser and direct single-window focus."""
import json,os,re,subprocess,socket,time
from threading import Event,Thread
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import gi
gi.require_version('Gtk','3.0');gi.require_version('GtkLayerShell','0.1')
from gi.repository import Gtk,Gdk,GLib,GtkLayerShell
from app_catalog import applications,pinned,set_pin

try: state=json.loads((Path.home()/'.config/boralances/state.json').read_text())
except (OSError,ValueError): state={}
catalog=applications(); by_id={a['id']:a for a in catalog}; windows=[]; pending=None; signature=None
pool=ThreadPoolExecutor(max_workers=1)
popup_flag=Path(os.environ['XDG_RUNTIME_DIR'])/'boralances-dock-popup'
popup_flag.unlink(missing_ok=True)
window=Gtk.Window();window.set_title('Boralances Dock');window.set_visual(window.get_screen().get_rgba_visual());window.set_app_paintable(True)
GtkLayerShell.init_for_window(window);GtkLayerShell.set_namespace(window,'nwg-dock');GtkLayerShell.set_layer(window,GtkLayerShell.Layer.TOP);GtkLayerShell.set_keyboard_mode(window,GtkLayerShell.KeyboardMode.NONE)
position=state.get('dock-position','bottom'); edge={'left':GtkLayerShell.Edge.LEFT,'right':GtkLayerShell.Edge.RIGHT}.get(position,GtkLayerShell.Edge.BOTTOM)
GtkLayerShell.set_anchor(window,edge,True);GtkLayerShell.set_margin(window,edge,10);GtkLayerShell.set_exclusive_zone(window,82)
box=Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL if position=='bottom' else Gtk.Orientation.VERTICAL,spacing=5);box.set_name('dock');window.add(box)
size=int(state.get('dock-size','48'))
css=Gtk.CssProvider();css.load_from_data(b'#dock{background:linear-gradient(rgba(46,60,83,.94),rgba(24,33,49,.94));border:1px solid rgba(230,240,255,.28);border-radius:23px;padding:9px;} button{background:transparent;border:0;border-radius:13px;padding:4px;box-shadow:none;transition:background 140ms ease;} button:hover{background:rgba(191,218,255,.22);} label{font-family:Inter;color:#eef4ff;} popover{background:#1b283e;border:1px solid #536880;border-radius:16px;} #running{color:#a8d7ff;font-size:9px;}')
if state.get('profile')=='glass':
    css.load_from_data(b'#dock{background:linear-gradient(rgba(70,100,145,.70),rgba(24,33,49,.78));border:1px solid rgba(235,247,255,.45);border-radius:23px;padding:9px;} button{background:transparent;border:0;border-radius:13px;padding:4px;transition:background 140ms ease;} button:hover{background:rgba(191,218,255,.25);} label{font-family:Inter;color:#eef4ff;} popover{background:#1b283e;border:1px solid #536880;border-radius:16px;} #running{color:#a8d7ff;font-size:9px;}')
Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),css,Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

def command(args):subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def launch(app):command(['systemd-run','--user','--collect','--property=ExitType=cgroup','gio','launch',app['path']])
def focus(w):
    address=w['address']
    if not re.fullmatch(r'0x[0-9a-fA-F]+',address):return
    if w.get('workspace',{}).get('name','').startswith('special:boralances-'):
        subprocess.run(['hyprctl','eval',f'hl.dispatch(hl.dsp.window.move({{window="address:{address}",workspace="+0",follow=false}}))'],capture_output=True,timeout=2)
    command(['hyprctl','eval',f'hl.dispatch(hl.dsp.focus({{window="address:{address}"}})); hl.dispatch(hl.dsp.window.bring_to_top())'])
def key(w):
    name=w.get('class','').lower()
    aliases={'foot':'boralances-terminal','boralances-control-center':'boralances-settings','thunar':'boralances-files','org.gnome.systemmonitor':'boralances-task-manager','boralancesbrowser':'boralances-browser','boralanceslauncher':'boralances-launcher'}
    name=aliases.get(name,name)
    for app in catalog:
        if app['id'].lower()==name:return app['id']
    return name

chooser=Gtk.Window();chooser.set_visual(chooser.get_screen().get_rgba_visual());chooser.set_app_paintable(True)
GtkLayerShell.init_for_window(chooser);GtkLayerShell.set_namespace(chooser,'boralances-dock-chooser');GtkLayerShell.set_layer(chooser,GtkLayerShell.Layer.OVERLAY);GtkLayerShell.set_keyboard_mode(chooser,GtkLayerShell.KeyboardMode.NONE)
GtkLayerShell.set_anchor(chooser,edge,True);GtkLayerShell.set_margin(chooser,edge,100);GtkLayerShell.set_exclusive_zone(chooser,-1)
chooser_box=Gtk.Box(orientation=Gtk.Orientation.VERTICAL,spacing=5);chooser_box.set_name('dock');chooser_box.set_border_width(10);chooser.add(chooser_box)
closing=[None]
def hold(*_):
    if closing[0]:GLib.source_remove(closing[0]);closing[0]=None

def hide_chooser(*_):
    hold();chooser.hide();popup_flag.unlink(missing_ok=True)

def delay_hide(*_):
    hold()
    def close():
        closing[0]=None;hide_chooser();return False
    closing[0]=GLib.timeout_add(350,close)

chooser.connect('enter-notify-event',hold);chooser.connect('leave-notify-event',delay_hide)
def show_chooser(app,group):
    hold()
    for child in chooser_box.get_children():child.destroy()
    label=Gtk.Label(label=app['name']+' \u00b7 '+str(len(group))+' open');chooser_box.pack_start(label,False,False,3)
    for w in group:
        item=Gtk.Button(label=(w.get('title') or app['name'])[:65]);item.set_size_request(280,36)
        item.connect('clicked',lambda _b,win=w:(focus(win),hide_chooser()));chooser_box.pack_start(item,False,False,0)
    popup_flag.write_text(str(os.getpid())+':chooser');chooser.show_all()

def button(app,group):
    outer=Gtk.Box(orientation=Gtk.Orientation.VERTICAL,spacing=0);b=Gtk.Button();b.set_tooltip_text(app['name']);b.add(Gtk.Image.new_from_icon_name(app['icon'],Gtk.IconSize.DIALOG));b.get_child().set_pixel_size(size);outer.pack_start(b,False,False,0)
    dot=Gtk.Label(label='\u25cf' if group else ' ');dot.set_name('running');outer.pack_start(dot,False,False,0)
    if group:b.set_has_tooltip(False)
    b.connect('enter-notify-event',lambda *_:show_chooser(app,group) if group else hide_chooser())
    b.connect('leave-notify-event',delay_hide)
    b.connect('clicked',lambda _b:(focus(group[0]),hide_chooser()) if len(group)==1 else show_chooser(app,group) if group else launch(app))
    def menu(_b,event):
        if event.button!=3:return False
        hold()
        for child in chooser_box.get_children():child.destroy()
        chooser_box.pack_start(Gtk.Label(label=app['name']),False,False,3)
        pin=Gtk.Button(label='Unpin from Dock' if app['id'] in pinned() else 'Pin to Dock');pin.set_size_request(280,36)
        def toggle(_item):
            if app['id'] in by_id:set_pin(app['id'],app['id'] not in pinned(),catalog);render(True)
        pin.connect('clicked',toggle);pin.set_sensitive(app['id'] in by_id);chooser_box.pack_start(pin,False,False,0)
        new=Gtk.Button(label='New window');new.connect('clicked',lambda _:(launch(app),hide_chooser()));new.set_sensitive(bool(app.get('path')));chooser_box.pack_start(new,False,False,0)
        popup_flag.write_text(str(os.getpid())+':actions');chooser.show_all();return True
    b.connect('button-press-event',menu);return outer

def render(force=False):
    global signature
    groups={}
    for w in windows:
        if not w.get('mapped') or w.get('class','').startswith(('boralances-center','boralances-window-switcher','boralances-workspaces','boralances-quick-settings','boralances-calendar','boralances-system-menu','boralances-file-menu','boralances-go-menu')):continue
        groups.setdefault(key(w),[]).append(w)
    ids=list(dict.fromkeys(pinned()+list(groups)))
    current=json.dumps([ids,[(w['address'],w.get('title'),w.get('workspace')) for w in windows]],sort_keys=True)
    if not force and current==signature:return
    signature=current
    hide_chooser()
    for child in box.get_children():child.destroy()
    start=Gtk.Button();image=Gtk.Image.new_from_icon_name('boralances-os',Gtk.IconSize.DIALOG);image.set_pixel_size(size);start.add(image);start.set_tooltip_text('Applications · Edit Dock');start.connect('clicked',lambda _:command(['boralances-control','start-menu']));box.pack_start(start,False,False,0)
    for identifier in ids:
        group=groups.get(identifier,[]);app=by_id.get(identifier,{'id':identifier,'name':group[0].get('class',identifier) if group else identifier,'icon':identifier,'path':''})
        box.pack_start(button(app,group),False,False,0)
    window.show_all()

def read_windows():
    try:return json.loads(subprocess.check_output(['hyprctl','-j','clients'],text=True,timeout=2))
    except (OSError,ValueError,subprocess.SubprocessError):return []
dirty=Event();dirty.set();last_read=0
def watch_windows():
    path=Path(os.environ['XDG_RUNTIME_DIR'])/'hypr'/os.environ['HYPRLAND_INSTANCE_SIGNATURE']/'.socket2.sock'
    while True:
        try:
            with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as stream:
                stream.connect(str(path));buffer=b''
                while True:
                    data=stream.recv(8192)
                    if not data:break
                    buffer+=data
                    while b'\n' in buffer:
                        line,buffer=buffer.split(b'\n',1)
                        if line.split(b'>>',1)[0] in (b'openwindow',b'closewindow',b'movewindow',b'movewindowv2',b'windowtitle',b'windowtitlev2',b'changefloatingmode'):
                            dirty.set()
        except OSError:pass
        time.sleep(2)

def poll():
    global pending,windows,last_read
    if pending is None and (dirty.is_set() or time.monotonic()-last_read>10):
        dirty.clear();last_read=time.monotonic();pending=pool.submit(read_windows)
    elif pending is not None and pending.done():windows=pending.result();pending=None;render()
    return True
Thread(target=watch_windows,daemon=True).start()
render();poll();GLib.timeout_add(200,poll);window.connect('destroy',Gtk.main_quit);Gtk.main();pool.shutdown(wait=False,cancel_futures=True)
