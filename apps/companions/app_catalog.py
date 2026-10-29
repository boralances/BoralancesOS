"""Desktop-entry discovery and pin persistence, without parsing shell commands."""
import configparser
import os
from pathlib import Path
import tempfile


def applications(directories=None):
    if directories is None:
        directories=[Path.home()/'.local/share/applications']+[Path(p)/'applications' for p in os.environ.get('XDG_DATA_DIRS','/run/current-system/sw/share:/usr/share').split(':') if p]
    seen=set(); result=[]
    for directory in directories:
        for path in sorted(Path(directory).glob('*.desktop')):
            identifier=path.stem
            if identifier in seen: continue
            seen.add(identifier)
            entry=configparser.ConfigParser(interpolation=None,strict=False)
            try:
                entry.read(path,encoding='utf-8'); item=entry['Desktop Entry']
                if item.get('Type')!='Application' or item.get('NoDisplay','false').lower()=='true' or item.get('Hidden','false').lower()=='true': continue
                if not item.get('Name') or not item.get('Exec'): continue
                result.append({'id':identifier,'name':item['Name'],'icon':item.get('Icon','application-x-executable'),'path':str(path),'comment':item.get('Comment','')})
            except (OSError,UnicodeError,configparser.Error,KeyError): continue
    return sorted(result,key=lambda item:item['name'].casefold())


def pin_file(): return Path(os.environ.get('XDG_CACHE_HOME',Path.home()/'.cache'))/'nwg-dock-pinned'


def switcher_clients(clients):
    panels={'boralances-window-switcher','boralances-workspaces','boralances-quick-settings','boralances-calendar','boralances-center','boralances-start-menu','boralances-system-menu','boralances-file-menu','boralances-go-menu'}
    parked={'special:boralances-minimized','special:boralances-desktop'}
    return sorted((w for w in clients if w.get('mapped') and w.get('class') not in panels and (not w.get('workspace',{}).get('name','').startswith('special:') or w['workspace']['name'] in parked)),key=lambda w:w.get('focusHistoryID',999))


def pinned():
    try: return [line for line in pin_file().read_text().splitlines() if line.strip()]
    except OSError: return []


def set_pin(identifier,enabled,known):
    if identifier not in {item['id'] for item in known}: raise ValueError('Unknown application')
    values=[value for value in pinned() if value!=identifier]
    if enabled: values.append(identifier)
    destination=pin_file(); destination.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=destination.parent,delete=False) as stream:
        stream.write('\n'.join(dict.fromkeys(values))+('\n' if values else '')); temporary=stream.name
    os.replace(temporary,destination)
