"""Small, event-driven desktop controller. No resident process required."""
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import shutil
import html
import time
from datetime import datetime

_companions=Path(__file__).resolve().parents[1]/'apps/companions'
if _companions.exists():sys.path.insert(0,str(_companions))
from appearance import surface,number

CONFIG = Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config'))
STATE = CONFIG / 'boralances/state.json'
SYSTEM_BAR_CONFIG = Path('/etc/xdg/waybar/config.jsonc')
RUNTIME = Path(os.environ.get('XDG_RUNTIME_DIR', '/tmp')) / f'boralances-{os.getuid()}'
PROFILES = {'glass': (True, True, 4, 2), 'balanced': (True, True, 3, 1),
            'fluid': (False, True, 1, 1),
            'performance': (False, False, 1, 1), 'reduced-motion': (True, False, 3, 1)}
PREFERENCES = {
    'dock-autohide': ('false', 'true'), 'dock-position': ('bottom', 'left', 'right'),
    'dock-size': ('32', '40', '48', '56', '64'), 'menu-details': ('false', 'true'),
    'clock-format': ('24h', '12h'), 'layout': ('floating', 'tiling'),
    'natural-scroll': ('true', 'false'), 'tap-to-click': ('true', 'false'),
    'pointer-speed': ('-0.5', '0', '0.3', '0.6'),
    'keyboard-layout': ('us,tr', 'us', 'tr'), 'caps-escape': ('false', 'true'),
    'lock-minutes': ('5', '10', '15', '30', '60'),
    'wallpaper': ('coast', 'dusk', 'graphite', 'aurora'),
    'accent': ('blue', 'purple', 'mint', 'orange'),
    'notifications-paused': ('false', 'true'),
    'widget-clock': ('false','true'), 'widget-monitor': ('false','true'),
    'widget-position': ('center','left','right'), 'widget-clock-size': ('small','large'),
    'calendar-week-numbers': ('false','true'),
    'menu-size': ('compact','normal','large'),
    'desktop-click-minimize': ('true','false'),
    'startup-profile': ('performance','fluid','balanced','glass','reduced-motion','last-used'),
    'glass-opacity': ('45','55','68','75','85','95'),
    'window-opacity': ('85','90','94','97','100'),
    'corner-radius': ('8','12','16','20','24','28'),
    'motion-intensity': ('subtle','normal','expressive'),
    'dock-magnification': ('true','false'),
    'widget-opacity': ('45','60','72','85','95'),
}
ACCENTS = {'blue': 'a9ccff', 'purple': 'c9b1ff', 'mint': '8cdec9', 'orange': 'ffc49a'}
for _widget in ('date','calendar','cpu','memory','disk','network','battery','media','volume','uptime','system','downloads','trash','bookmarks','quicklaunch','notes','todo','timer','stopwatch','focus','load','swap','world-clock','connections','desktops','session'):
    PREFERENCES['widget-'+_widget]=('false','true')


def run(*args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, check=True, **kwargs)


def read_state():
    try:
        state = json.loads(STATE.read_text())
        return state if isinstance(state, dict) else {}
    except (OSError, ValueError):
        try:
            return json.loads(Path('/etc/boralances/default-state.json').read_text())
        except (OSError, ValueError):
            return {}


def save_state(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=STATE.parent, delete=False) as stream:
        json.dump(state, stream)
        name = stream.name
    os.replace(name, STATE)


def write_config(path, content):
    """Replace managed files atomically, including read-only copies from /nix/store."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as stream:
        stream.write(content)
        name = stream.name
    os.replace(name, path)


def lua(value):
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, dict):
        return '{' + ','.join(f'[{json.dumps(k)}]={lua(v)}' for k, v in value.items()) + '}'
    raise TypeError(type(value))


def apply_profile(profile):
    state=read_state()
    if profile=='glass':
        changed=False
        for key in ('widget-app-groups','widget-phone'):
            if key not in state:state[key]='true';changed=True
        if changed:save_state(state)
    tokens=surface(state)
    blur, animation, size, passes = PROFILES[profile]
    settings = {'decoration': {'blur': {'enabled': blur, 'size': size, 'passes': passes},
                               'shadow': {'enabled': profile != 'performance'},
                               'rounding':tokens['radius'],
                               'active_opacity':number(state,'window-opacity',94,85,100)/100 if profile=='glass' else 1.0,
                               'inactive_opacity':max(.8,number(state,'window-opacity',94,85,100)/100-.04) if profile=='glass' else 1.0},
                'animations': {'enabled': animation}}
    run('hyprctl', 'eval', 'hl.config(' + lua(settings) + ')')
    subprocess.run(['gsettings', 'set', 'org.gnome.desktop.interface', 'enable-animations',
                    'true' if animation else 'false'], capture_output=True)
    if animation:
        strength=state.get('motion-intensity','normal')
        amount={'subtle':97,'normal':93,'expressive':88}.get(strength,93) if profile=='glass' else 98
        run('hyprctl','eval','hl.animation('+lua({'leaf':'windows','enabled':True,'speed':3.0,'spring':'glass','style':f'popin {amount}%'})+')')
    apply_theme(state.get('theme','dark'))
    subprocess.run(['systemctl','--user','try-restart','boralances-widgets.service'],capture_output=True)


def apply_theme(theme):
    choice = {'dark': 'prefer-dark', 'light': 'prefer-light', 'system': 'default'}[theme]
    run('gsettings', 'set', 'org.gnome.desktop.interface', 'color-scheme', choice)
    run('gsettings', 'set', 'org.gnome.desktop.interface', 'cursor-theme', 'Adwaita')
    run('gsettings', 'set', 'org.gnome.desktop.interface', 'icon-theme', 'Boralances')
    run('gsettings', 'set', 'org.gnome.desktop.wm.preferences', 'button-layout', 'close,minimize,maximize:')
    run('gsettings', 'set', 'org.gnome.desktop.interface', 'gtk-theme', 'Adwaita' if theme == 'light' else 'Adwaita-dark')
    css = '@import url("/etc/xdg/waybar/style.css");\n'
    if theme == 'light':
        css += 'window#waybar { background: rgba(238,242,252,0.94); color:#18243c; }\n#window,#custom-brand,#workspaces button { color:#344968; }\n'
    tokens=surface(read_state())
    if tokens['glass']:css+=f'window#waybar {{background:rgba({tokens["rgb"]},{tokens["opacity"]});border-bottom:1px solid rgba(230,245,255,0.28);}}\n'
    accent = ACCENTS.get(read_state().get('accent', 'blue'), ACCENTS['blue'])
    css += f'#workspaces button.active {{ color:#{accent}; }}\n'
    folder = CONFIG / 'waybar'
    folder.mkdir(parents=True, exist_ok=True)
    write_config(folder / 'style.css', css)
    dock = CONFIG / 'nwg-dock-hyprland'
    dock.mkdir(parents=True, exist_ok=True)
    dock_css = '@import url("/etc/xdg/nwg-dock-hyprland/style.css");\n'
    if theme == 'light':
        dock_css += 'window { background:rgba(237,243,252,0.97); border-color:rgba(255,255,255,0.8); }\n'
    write_config(dock / 'style.css', dock_css)
    subprocess.run(['systemctl', '--user', 'try-restart', 'boralances-menu-bar.service'], capture_output=True)
    subprocess.run(['systemctl', '--user', 'try-restart', 'boralances-dock.service'], capture_output=True)


def shell_config(state):
    folder = CONFIG / 'waybar'
    folder.mkdir(parents=True, exist_ok=True)
    config = json.loads(SYSTEM_BAR_CONFIG.read_text(encoding='utf-8'))
    config['height'] = {'compact':30,'normal':36,'large':44}.get(state.get('menu-size','normal'),36)
    if state.get('menu-details') == 'true':
        config['modules-right'] = ['cpu', 'memory'] + config['modules-right']
    config['clock']['format'] = '{:%a %d %b  %I:%M %p}' if state.get('clock-format') == '12h' else '{:%a %d %b  %H:%M}'
    write_config(folder / 'config.jsonc', json.dumps(config))
    return folder / 'config.jsonc'


def wallpaper(state):
    run('systemctl', '--user', 'restart', 'boralances-wallpaper.service')
    run('systemctl', '--user', 'try-restart', 'boralances-desktop-icons.service')


def wallpaper_args(state):
    choice = state.get('wallpaper', 'coast')
    if choice not in PREFERENCES['wallpaper']:
        choice = 'coast'
    path = '/etc/boralances/wallpaper.png' if choice == 'aurora' else f'/etc/boralances/wallpapers/{choice}.png'
    return ['swaybg', '-i', path, '-m', 'fill']


def apply_input(state):
    settings = {'input': {
        'kb_layout': state.get('keyboard-layout', 'us,tr'),
        'kb_options': 'grp:alt_shift_toggle' + (',caps:escape' if state.get('caps-escape') == 'true' else ''),
        'sensitivity': float(state.get('pointer-speed', '0')),
        'touchpad': {'natural_scroll': state.get('natural-scroll', 'true') == 'true',
                     'tap_to_click': state.get('tap-to-click', 'true') == 'true'},
    }}
    run('hyprctl', 'eval', 'hl.config(' + lua(settings) + ')')


def apply_lock(state):
    if subprocess.run(['systemd-detect-virt'],capture_output=True,text=True).stdout.strip()=='oracle':
        run('systemctl','--user','stop','boralances-idle.service')
        return
    folder = CONFIG / 'hypr'
    folder.mkdir(parents=True, exist_ok=True)
    minutes = state.get('lock-minutes', '10')
    if minutes not in PREFERENCES['lock-minutes']:
        minutes = '10'
    source = Path('/etc/xdg/hypr/hypridle.conf').read_text()
    source = source.replace('timeout = 600', f'timeout = {int(minutes) * 60}')
    source = source.replace('timeout = 660', f'timeout = {int(minutes) * 60 + 60}')
    write_config(folder / 'hypridle.conf', source)
    run('systemctl', '--user', 'restart', 'boralances-idle.service')


def apply_preference(key, state):
    if key in ('glass-opacity','window-opacity','corner-radius','motion-intensity'):
        apply_profile(state.get('profile','performance'))
    elif key=='desktop-click-minimize':
        run('hyprctl','eval','boralances_desktop_minimize('+lua(state[key]=='true')+')')
    elif key.startswith('widget-'):
        run('systemctl','--user','restart','boralances-widgets.service')
    elif key in ('calendar-week-numbers','startup-profile'):
        pass
    elif key.startswith('dock-'):
        run('systemctl', '--user', 'restart', 'boralances-dock.service')
    elif key in ('menu-details', 'clock-format', 'menu-size'):
        shell_config(state)
        run('systemctl', '--user', 'restart', 'boralances-menu-bar.service')
        if key == 'clock-format': run('systemctl','--user','restart','boralances-widgets.service')
    elif key == 'layout':
        run('hyprctl', 'eval', 'boralances_layout(' + lua(state[key]) + ')')
    elif key == 'wallpaper':
        wallpaper(state)
    elif key == 'accent':
        color = ACCENTS[state[key]]
        run('hyprctl', 'eval', 'hl.config(' + lua({'general': {'col': {'active_border': 'rgba(' + color + 'cc)'}}}) + ')')
        apply_theme(state.get('theme', 'dark'))
    elif key == 'notifications-paused':
        run('dunstctl', 'set-paused', state[key])
    elif key == 'lock-minutes':
        apply_lock(state)
    else:
        apply_input(state)


def desktop_menu():
    choices = {'Applications': ['rofi', '-show', 'drun'],
               'System Settings': ['boralances-control-center'],
               'Workspace Overview': ['boralances-overview-ui'],
               'Files': ['thunar'], 'Activity Monitor': ['boralances-terminal', '-e', 'btop'],
               'Repair Dock and Menu Bar': ['boralances-control', 'shell-restart'],
               'Lock Screen': ['hyprlock']}
    selected = pick('BoralancesOS', choices)
    if selected in choices:
        subprocess.Popen(choices[selected], start_new_session=True)


def dispatch(name, values):
    run('hyprctl', 'eval', f'hl.dispatch(hl.dsp.{name}({lua(values)}))')


def clients():
    return json.loads(run('hyprctl', '-j', 'clients').stdout)


def active_window():
    return json.loads(run('hyprctl', '-j', 'activewindow').stdout)


def selector(window):
    address = window.get('address', '')
    if not re.fullmatch(r'0x[0-9a-fA-F]+', address):
        raise ValueError('Invalid window address')
    return 'address:' + address


def cycle_window(backwards=False):
    active = active_window()
    workspace = json.loads(run('hyprctl', '-j', 'activeworkspace').stdout)['id']
    windows = [w for w in clients() if w.get('mapped') and w['workspace']['id'] == workspace
               and w.get('class') != 'boralances-quick-settings']
    if not windows:
        return
    index = next((i for i,w in enumerate(windows) if w['address'] == active.get('address')), 0)
    dispatch('focus', {'window': selector(windows[(index + (-1 if backwards else 1)) % len(windows)])})
    dispatch('window.bring_to_top', {})


def parked_windows(action, address=None):
    """Hide without closing apps; restore only windows parked by this action."""
    filename = RUNTIME / ('desktop-windows.json' if action == 'show-desktop' else 'minimized-windows.json')
    available = {w['address']:w for w in clients()}
    try: saved = json.loads(filename.read_text())
    except (OSError,ValueError): saved = []
    restore = action in ('restore-window', 'show-desktop') and bool(saved)
    if restore:
        records = saved if action == 'show-desktop' else saved[-1:]
        for record in records:
            if record['address'] in available:
                dispatch('window.move', {'window':selector(record), 'workspace':str(record['workspace']), 'follow':False})
        filename.write_text(json.dumps([] if action == 'show-desktop' else saved[:-1]))
        if records and records[-1]['address'] in available:
            dispatch('focus', {'window':selector(records[-1])})
            dispatch('window.bring_to_top', {})
    elif action != 'restore-window':
        workspace = json.loads(run('hyprctl','-j','activeworkspace').stdout)['id']
        windows = [w for w in available.values() if w.get('mapped') and w['workspace']['id']==workspace]
        if action != 'show-desktop':
            active = available.get(address,{}) if address else active_window()
            windows = [active] if active.get('address') and active.get('workspace',{}).get('id')==workspace else []
        records = [{'address':w['address'],'workspace':w['workspace']['id']} for w in windows]
        filename.write_text(json.dumps(records if action=='show-desktop' else saved+records))
        for window in windows:
            dispatch('window.move', {'window':selector(window), 'workspace':'special:boralances-'+('desktop' if action=='show-desktop' else 'minimized'), 'follow':False})


def snap_window(side):
    if side not in ('left','right'): raise ValueError('Invalid snap direction')
    active = active_window()
    if not active.get('address'): return
    monitor = next(m for m in json.loads(run('hyprctl','-j','monitors').stdout) if m['id']==active['monitor'])
    left,top,right,bottom = monitor['reserved']
    width = round(monitor['width']/monitor['scale']) - left - right
    height = round(monitor['height']/monitor['scale']) - top - bottom
    target = selector(active)
    dispatch('window.fullscreen', {'window':target,'action':'unset'})
    dispatch('window.float', {'window':target,'action':'set'})
    dispatch('window.resize', {'window':target,'x':width//2-16,'y':height-20})
    dispatch('window.move', {'window':target,'x':monitor['x']+left+10+(width//2 if side=='right' else 0),'y':monitor['y']+top+10})


def display_set(output,mode,scale):
    monitors=json.loads(run('hyprctl','-j','monitors').stdout)
    monitor=next((item for item in monitors if item['name']==output),None)
    if monitor is None or not re.fullmatch(r'\d{3,5}x\d{3,5}@\d+(?:\.\d+)?',mode) or scale not in ('1','1.25','1.5','1.75','2'):
        raise ValueError('Invalid display setting')
    allowed={value.removesuffix('Hz') for value in monitor.get('availableModes',[])}
    allowed.add(f"{monitor['width']}x{monitor['height']}@{monitor['refreshRate']:.2f}")
    if mode not in allowed: raise ValueError('This screen does not advertise that mode')
    code='hl.monitor('+lua({'output':output,'mode':mode,'position':'auto','scale':float(scale)})+')'
    run('hyprctl','eval',code)
    local=CONFIG/'hypr/local.lua'
    try: content=local.read_text()
    except OSError: content=''
    block='-- BEGIN BORALANCES DISPLAY\n'+code+'\n-- END BORALANCES DISPLAY'
    content=re.sub(r'-- BEGIN BORALANCES DISPLAY\n.*?-- END BORALANCES DISPLAY\n?', '',content,flags=re.S)
    write_config(local,content.rstrip()+'\n'+block+'\n')
    # A DPI change can leave old floating-window positions outside the new
    # logical work area. Keep their content and bring their controls back onscreen.
    current=next((m for m in json.loads(run('hyprctl','-j','monitors').stdout) if m['name']==output),None)
    if current:
        left,top,right,bottom=current['reserved']
        width=round(current['width']/current['scale'])-left-right
        height=round(current['height']/current['scale'])-top-bottom
        for window in clients():
            if not window.get('floating') or window.get('monitor')!=current['id']:continue
            target=selector(window)
            w,h=window['size'];w=min(w,max(300,width-24));h=min(h,max(240,height-24))
            dispatch('window.resize',{'window':target,'x':w,'y':h})
            x=max(current['x']+left+12,min(window['at'][0],current['x']+left+width-w-12))
            y=max(current['y']+top+12,min(window['at'][1],current['y']+top+height-h-12))
            dispatch('window.move',{'window':target,'x':x,'y':y})
    subprocess.run(['systemctl','--user','try-restart','boralances-wallpaper.service','boralances-widgets.service','boralances-desktop-icons.service'],capture_output=True)


def island_status(state):
    player=subprocess.run(['playerctl','metadata','--format','{{title}}'],capture_output=True,text=True,timeout=2)
    if player.returncode==0 and player.stdout.strip():
        text='♫  '+player.stdout.strip()[:32]; detail='Now playing · Click for media controls'; style='media'
    elif (RUNTIME/'gaming').exists(): text='Game Mode'; detail='Desktop effects reduced for gaming'; style='gaming'
    else:
        text='BoralancesOS'; detail='Your workspace · '+state.get('profile','fluid').title(); style='idle'
    print(json.dumps({'text':html.escape(text),'tooltip':detail,'class':style}))


def quick_settings(kind='quick-settings'):
    unit = 'boralances-'+kind+'.service'
    if subprocess.run(['systemctl','--user','is-active','--quiet',unit]).returncode == 0:
        run('systemctl','--user','stop',unit)
    else:
        run('systemd-run','--user','--unit='+unit,'--collect',shutil.which('boralances-'+kind) or '/run/current-system/sw/bin/boralances-'+kind)


def pick(title, choices):
    result = subprocess.run(['rofi', '-dmenu', '-i', '-p', title], input='\n'.join(choices),
                            capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else 'settings'
    state = read_state()
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    if action == 'restore':
        # A first installation already has an Optimization default. Subsequent
        # sessions preserve the user's choice unless they explicitly pin a mode.
        startup=state.get('startup-profile','last-used')
        if startup in PROFILES:
            state['profile']=startup
            save_state(state)
        run('hyprctl', 'setcursor', 'Adwaita', '24')
        if not STATE.exists() or 'profile' not in state:
            guest = subprocess.run(['systemd-detect-virt'], capture_output=True, text=True).stdout.strip()
            state['profile'] = 'performance' if guest == 'oracle' else state.get('profile', 'balanced')
            save_state(state)
        apply_profile('performance' if (RUNTIME / 'gaming').exists() else state.get('profile', 'balanced'))
        apply_theme(state.get('theme', 'dark'))
        shell_config(state)
        wallpaper(state)
        apply_input(state)
        run('hyprctl', 'eval', 'boralances_layout(' + lua(state.get('layout', 'floating')) + ')')
        run('hyprctl','eval','boralances_desktop_minimize('+lua(state.get('desktop-click-minimize','true')=='true')+')')
        apply_lock(state)
        run('dunstctl', 'set-paused', state.get('notifications-paused', 'false'))
    elif action == 'bar-run':
        config = shell_config(state)
        style = CONFIG / 'waybar/style.css'
        os.execvp('waybar', ['waybar', '--config', str(config), '--style', str(style if style.exists() else '/etc/xdg/waybar/style.css')])
    elif action == 'dock-run':
        size = state.get('dock-size', '48')
        position = state.get('dock-position', 'bottom')
        if size not in PREFERENCES['dock-size'] or position not in PREFERENCES['dock-position']:
            raise ValueError('Invalid dock preference')
        args = ['nwg-dock-hyprland', '-p', position, '-i', size, '-mb', '10', '-ml', '10', '-mr', '10',
                '-c', 'boralances-control start-menu', '-lp', 'start', '-ico', 'boralances-os']
        args += ['-d', '-hd', '0'] if state.get('dock-autohide') == 'true' else ['-x']
        if state.get('dock-autohide')!='true': args[0]='boralances-dock'
        os.execvp(args[0], args)
    elif action == 'wallpaper-run':
        args = wallpaper_args(state)
        os.execvp(args[0], args)
    elif action == 'shell-restart':
        shell_config(state)
        run('systemctl', '--user', 'restart', 'boralances-menu-bar.service', 'boralances-dock.service')
    elif action == 'desktop-menu':
        desktop_menu()
    elif action in ('file-menu', 'go-menu'):
        quick_settings(action)
    elif action == 'quick-settings':
        quick_settings()
    elif action == 'calendar':
        quick_settings('calendar')
    elif action == 'system-menu':
        quick_settings('system-menu')
    elif action in ('start-menu','workspaces'):
        quick_settings(action)
    elif action == 'center':
        section=sys.argv[2] if len(sys.argv)>2 else 'network'
        if section not in ('network','bluetooth','sound','display','power','media'): raise ValueError('Unknown center')
        unit='boralances-center-'+section+'.service'
        if subprocess.run(['systemctl','--user','is-active','--quiet',unit]).returncode==0:
            run('systemctl','--user','stop',unit)
        else:
            run('systemd-run','--user','--unit='+unit,'--collect',shutil.which('boralances-center') or '/run/current-system/sw/bin/boralances-center','--section',section)
    elif action == 'island-status':
        island_status(state)
    elif action == 'display-set':
        display_set(*sys.argv[2:5])
    elif action == 'cycle':
        cycle_window(sys.argv[2] == 'previous')
    elif action == 'window-switcher':
        runtime=Path(os.environ['XDG_RUNTIME_DIR'])
        if len(sys.argv)>2 and sys.argv[2]=='commit':
            (runtime/'boralances-switcher-release').write_text(str(time.monotonic()))
            return
        (runtime/'boralances-switcher-request').write_text(str(time.monotonic()))
        previous=len(sys.argv)>2 and sys.argv[2]=='previous'
        try:
            pid=int((Path(os.environ['XDG_RUNTIME_DIR'])/'boralances-switcher.pid').read_text())
            cmdline=Path(f'/proc/{pid}/cmdline').read_bytes()
            if b'main.py\x00window-switcher' not in cmdline: raise ValueError('stale switcher')
            os.kill(pid,signal.SIGUSR2 if previous else signal.SIGUSR1)
        except (OSError,ValueError):
            subprocess.run(['systemd-run','--user','--unit=boralances-window-switcher','--collect',shutil.which('boralances-window-switcher') or '/run/current-system/sw/bin/boralances-window-switcher',*(['--previous'] if previous else [])],check=False)
    elif action in ('show-desktop','minimize','restore-window'):
        parked_windows(action)
    elif action == 'minimize-window':
        address=sys.argv[2]
        selector({'address':address})
        parked_windows('minimize',address)
    elif action == 'restore-or-minimize':
        if active_window().get('fullscreen',0):
            dispatch('window.fullscreen',{'action':'unset','mode':'maximized'})
        else:
            parked_windows('minimize')
    elif action == 'snap':
        snap_window(sys.argv[2])
    elif action == 'set':
        key, value = sys.argv[2:4]
        if key not in PREFERENCES or value not in PREFERENCES[key]:
            raise ValueError('Unknown preference or value')
        state[key] = value
        previous = read_state()
        # Restarted services read the new state; restore it if applying fails.
        save_state(state)
        try:
            apply_preference(key, state)
        except (OSError, ValueError, subprocess.CalledProcessError):
            save_state(previous)
            raise
    elif action == 'status':
        gaming = (RUNTIME / 'gaming').exists()
        print(json.dumps({'text': 'Game mode' if gaming else state.get('profile', 'balanced').title(),
                          'tooltip': 'Appearance and performance · Super+,', 'class': 'gaming' if gaming else 'normal'}))
    elif action in ('game-on', 'game-off'):
        if action == 'game-on':
            (RUNTIME / 'gaming').touch()
            apply_profile('performance')
        else:
            (RUNTIME / 'gaming').unlink(missing_ok=True)
            apply_profile(state.get('profile', 'balanced'))
    elif action == 'overview':
        subprocess.Popen(['boralances-overview-ui'], start_new_session=True)
    elif action == 'screenshot':
        region = run('slurp').stdout.strip()
        if region:
            image = subprocess.run(['grim', '-g', region, '-'], capture_output=True, check=True).stdout
            subprocess.run(['swappy', '-f', '-'], input=image, check=True)
    elif action == 'screenshot-full':
        folder = Path.home() / 'Pictures/Screenshots'
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / (datetime.now().strftime('Screenshot-%Y%m%d-%H%M%S-%f') + '.png')
        run('grim', str(target))
        run('notify-send', 'Screenshot saved', str(target))
    elif action in ('profile', 'theme'):
        value = sys.argv[2]
        allowed = PROFILES if action == 'profile' else {'dark', 'light', 'system'}
        if value not in allowed:
            raise ValueError('Unknown ' + action)
        state[action] = value
        if action == 'profile':
            state['startup-profile'] = 'last-used'
        save_state(state)
        apply_profile(value) if action == 'profile' else apply_theme(value)
    elif action == 'settings':
        subprocess.Popen(['boralances-control-center'], start_new_session=True)
    elif action == 'menu':
        selected = pick('BoralancesOS', ['Glass', 'Balanced', 'Performance', 'Reduced motion',
            'Dark appearance', 'Light appearance', 'Follow system appearance', 'System monitor', 'Lock screen'])
        profiles = {'Glass': 'glass', 'Balanced': 'balanced', 'Performance': 'performance', 'Reduced motion': 'reduced-motion'}
        themes = {'Dark appearance': 'dark', 'Light appearance': 'light', 'Follow system appearance': 'system'}
        if selected in profiles:
            state['profile'] = profiles[selected]
            state['startup-profile'] = 'last-used'
            save_state(state)
            apply_profile(state['profile'])
        elif selected in themes:
            state['theme'] = themes[selected]
            save_state(state)
            apply_theme(state['theme'])
        elif selected == 'System monitor':
            subprocess.Popen(['boralances-terminal', '-e', 'btop'], start_new_session=True)
        elif selected == 'Lock screen':
            subprocess.Popen(['hyprlock'], start_new_session=True)
    else:
        raise ValueError('Unknown action')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'BoralancesOS: {error}', file=sys.stderr)
        raise SystemExit(1)
