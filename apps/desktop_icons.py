"""File-backed desktop icons with native file drops and saved positions."""
import configparser,json,os,shutil,subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import gi
gi.require_version('Gtk','3.0');gi.require_version('GtkLayerShell','0.1')
from gi.repository import Gtk,Gdk,Gio,GLib,GtkLayerShell,Pango

desktop=Path(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) or Path.home()/'Desktop')
desktop.mkdir(parents=True,exist_ok=True)
settings=Path.home()/'.config/boralances/desktop-positions.json'
try:positions=json.loads(settings.read_text())
except (OSError,ValueError):positions={}
pool=ThreadPoolExecutor(max_workers=1);refresh_source=None
window=Gtk.Window();window.set_title('Boralances Desktop');window.set_visual(window.get_screen().get_rgba_visual());window.set_app_paintable(True)
GtkLayerShell.init_for_window(window);GtkLayerShell.set_namespace(window,'boralances-desktop-icons');GtkLayerShell.set_layer(window,GtkLayerShell.Layer.BACKGROUND);GtkLayerShell.set_keyboard_mode(window,GtkLayerShell.KeyboardMode.NONE);GtkLayerShell.set_exclusive_zone(window,-1)
for edge in (GtkLayerShell.Edge.TOP,GtkLayerShell.Edge.BOTTOM,GtkLayerShell.Edge.LEFT,GtkLayerShell.Edge.RIGHT):GtkLayerShell.set_anchor(window,edge,True)
GtkLayerShell.set_margin(window,GtkLayerShell.Edge.TOP,54);GtkLayerShell.set_margin(window,GtkLayerShell.Edge.BOTTOM,100)
GtkLayerShell.set_margin(window,GtkLayerShell.Edge.LEFT,18);GtkLayerShell.set_margin(window,GtkLayerShell.Edge.RIGHT,18)
fixed=Gtk.Fixed();events=Gtk.EventBox();events.set_visible_window(False);events.add(fixed);window.add(events)
css=Gtk.CssProvider();css.load_from_data(b'window{background:transparent;} button.desktop-icon{background:transparent;border:1px solid transparent;border-radius:12px;padding:5px;box-shadow:none;} button.desktop-icon:hover,button.desktop-icon:focus{background:rgba(129,172,230,.24);border-color:rgba(230,240,255,.32);} .desktop-icon label{color:white;text-shadow:0 1px 3px #101827;font-family:Inter;}')
Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),css,Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

def spawn(*args):
    subprocess.Popen(['systemd-run','--user','--collect','--property=ExitType=cgroup',*args],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def error(message):
    dialog=Gtk.MessageDialog(transient_for=window,modal=True,message_type=Gtk.MessageType.ERROR,buttons=Gtk.ButtonsType.CLOSE,text=message)
    dialog.run();dialog.destroy()

def save_positions():
    settings.parent.mkdir(parents=True,exist_ok=True);temporary=settings.with_suffix('.tmp');temporary.write_text(json.dumps(positions,indent=2));temporary.replace(settings)

def open_item(path):
    if path.suffix=='.desktop':spawn('gio','launch',str(path))
    elif path.suffix.lower()=='.exe':spawn('boralances-exe',str(path))
    elif path.suffix.lower()=='.appimage':spawn('appimage-run',str(path))
    else:spawn('gio','open',path.as_uri())

def details(path):
    title=path.name;icon='folder' if path.is_dir() else 'text-x-generic'
    if path.suffix=='.desktop':
        entry=configparser.ConfigParser(interpolation=None,strict=False)
        try:entry.read(path,encoding='utf-8');title=entry['Desktop Entry'].get('Name',title);icon=entry['Desktop Entry'].get('Icon','application-x-executable')
        except (OSError,ValueError,KeyError):pass
    else:
        try:icon=Gio.File.new_for_path(str(path)).query_info('standard::icon',Gio.FileQueryInfoFlags.NONE,None).get_icon()
        except GLib.Error:pass
    return title,icon

def clamp(x,y):return max(0,min(int(x),max(0,fixed.get_allocated_width()-106))),max(0,min(int(y),max(0,fixed.get_allocated_height()-104)))

targets=[Gtk.TargetEntry.new('application/x-boralances-desktop-icon',Gtk.TargetFlags.SAME_APP,1),Gtk.TargetEntry.new('text/uri-list',0,0)]
def refresh():
    global refresh_source
    refresh_source=None
    for child in fixed.get_children():child.destroy()
    rows=max(1,(fixed.get_allocated_height() or 640)//108)
    for index,path in enumerate(sorted(desktop.iterdir(),key=lambda p:(not p.is_dir(),p.name.casefold()))):
        if path.name.startswith('.'):continue
        button=Gtk.Button();button.get_style_context().add_class('desktop-icon');button.set_size_request(104,100);button.set_tooltip_text(path.name)
        content=Gtk.Box(orientation=Gtk.Orientation.VERTICAL,spacing=5);title,icon=details(path)
        image=Gtk.Image.new_from_gicon(icon,Gtk.IconSize.DIALOG) if isinstance(icon,Gio.Icon) else Gtk.Image.new_from_file(icon) if os.path.isabs(icon) else Gtk.Image.new_from_icon_name(icon,Gtk.IconSize.DIALOG)
        image.set_pixel_size(48);content.pack_start(image,False,False,0);label=Gtk.Label(label=title);label.set_line_wrap(True);label.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);label.set_max_width_chars(11);label.set_ellipsize(Pango.EllipsizeMode.END);label.set_lines(2);content.pack_start(label,False,False,0);button.add(content)
        dragging={}
        def press(_button,event,p=path,drag=dragging):
            if event.button==1 and event.type==Gdk.EventType.DOUBLE_BUTTON_PRESS:open_item(p);return True
            if event.button==3:context_menu(event,p);return True
            if event.button==1:drag.update(root=(event.x_root,event.y_root),origin=(fixed.child_get_property(_button,'x'),fixed.child_get_property(_button,'y')),moved=False)
            return False
        button.connect('button-press-event',press)
        button.add_events(Gdk.EventMask.BUTTON_MOTION_MASK|Gdk.EventMask.BUTTON_RELEASE_MASK)
        def motion(widget,event,drag=dragging):
            if not drag or not event.state & Gdk.ModifierType.BUTTON1_MASK:return False
            dx,dy=event.x_root-drag['root'][0],event.y_root-drag['root'][1]
            if abs(dx)+abs(dy)>8:drag['moved']=True
            if drag['moved']:fixed.move(widget,*clamp(drag['origin'][0]+dx,drag['origin'][1]+dy))
            return bool(drag['moved'])
        def release(widget,event,p=path,drag=dragging):
            if event.button==1 and drag.get('moved'):
                positions[p.name]=[fixed.child_get_property(widget,'x'),fixed.child_get_property(widget,'y')];save_positions();drag.clear();return True
            drag.clear();return False
        button.connect('motion-notify-event',motion);button.connect('button-release-event',release)
        value=positions.get(path.name,[index//rows*112,index%rows*108])
        try:x,y=clamp(*value)
        except (TypeError,ValueError):x,y=clamp(0,index*108)
        fixed.put(button,x,y)
    fixed.show_all();return False

def schedule_refresh(*_):
    global refresh_source
    if refresh_source is None:refresh_source=GLib.timeout_add(200,refresh)

def unique(path):
    destination=desktop/path.name;number=2
    while destination.exists() or destination.is_symlink():destination=desktop/(path.stem+' ('+str(number)+')'+path.suffix);number+=1
    return destination

def copy_files(paths):
    try:
        for path in paths:
            if path.parent==desktop:continue
            if path.is_dir() and desktop.resolve().is_relative_to(path.resolve()):raise OSError('A folder cannot be copied into itself.')
            target=unique(path)
            if path.is_dir():shutil.copytree(path,target,symlinks=True)
            else:shutil.copy2(path,target)
    except OSError as exception:GLib.idle_add(error,str(exception))
    GLib.idle_add(schedule_refresh)

def dropped(_widget,context,x,y,selection,info,timestamp):
    if info==1:
        name=selection.get_text()
        if name and Path(name).name==name and (desktop/name).exists():positions[name]=list(clamp(x-50,y-35));save_positions();schedule_refresh()
    else:
        paths=[Path(p) for uri in (selection.get_uris() or []) if (p:=Gio.File.new_for_uri(uri).get_path())]
        pool.submit(copy_files,paths)
    Gtk.drag_finish(context,True,False,timestamp)
window.drag_dest_set(Gtk.DestDefaults.ALL,targets,Gdk.DragAction.COPY|Gdk.DragAction.MOVE);window.connect('drag-data-received',dropped)

def new_folder(*_):
    dialog=Gtk.Dialog(title='New folder',transient_for=window,modal=True);dialog.add_buttons('Cancel',Gtk.ResponseType.CANCEL,'Create',Gtk.ResponseType.OK)
    entry=Gtk.Entry();entry.set_text('New Folder');entry.set_activates_default(True);dialog.set_default_response(Gtk.ResponseType.OK);dialog.get_content_area().add(entry);dialog.show_all()
    response=dialog.run();name=entry.get_text().strip();dialog.destroy()
    if response==Gtk.ResponseType.OK and name and Path(name).name==name:
        try:(desktop/name).mkdir()
        except OSError as exception:error(str(exception))

def import_files(folder=False):
    dialog=Gtk.FileChooserDialog(title='Add folder to Desktop' if folder else 'Add files to Desktop',transient_for=window,action=Gtk.FileChooserAction.SELECT_FOLDER if folder else Gtk.FileChooserAction.OPEN)
    dialog.add_buttons('Cancel',Gtk.ResponseType.CANCEL,'Add to Desktop',Gtk.ResponseType.OK);dialog.set_select_multiple(True)
    response=dialog.run();paths=[Path(name) for name in dialog.get_filenames()] if response==Gtk.ResponseType.OK else [];dialog.destroy()
    if paths:pool.submit(copy_files,paths)


def context_menu(event,path=None):
    menu=Gtk.Menu();window.desktop_menu=menu
    choices=[('Open',lambda *_:open_item(path))] if path else []
    choices += [('New folder',new_folder),('Add files…',lambda *_:import_files()),('Add folder…',lambda *_:import_files(True)),('Open Desktop in Files',lambda *_:spawn('thunar',str(desktop))),('Add app shortcut',lambda *_:spawn('boralances-start-menu')),('Arrange icons',lambda *_:(positions.clear(),save_positions(),schedule_refresh()))]
    if path:choices.append(('Move to Trash',lambda *_:spawn('gio','trash',str(path))))
    for title,callback in choices:item=Gtk.MenuItem(label=title);item.connect('activate',callback);menu.append(item)
    menu.show_all();menu.popup_at_pointer(event)
def background_press(_widget,event):
    if event.button==3:context_menu(event);return True
    return False
events.connect('button-press-event',background_press)
monitor=Gio.File.new_for_path(str(desktop)).monitor_directory(Gio.FileMonitorFlags.NONE,None);monitor.connect('changed',schedule_refresh)
window.show_all();GLib.idle_add(refresh);Gtk.main();pool.shutdown(wait=False,cancel_futures=True)
