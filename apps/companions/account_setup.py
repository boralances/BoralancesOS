"""Validate installer identity; keep passwords and hashes out of the Nix store."""
import json,os,re,subprocess,sys,tempfile
from pathlib import Path

def validate_account(value,require_password=True):
    username=value.get('username','');full_name=value.get('fullName','').strip();password=value.get('password','')
    if not re.fullmatch(r'[a-z_][a-z0-9_-]{0,30}',username) or username in {'root','nixos','greeter','nobody','daemon','bin','systemd-network','systemd-resolve'}:
        raise ValueError('Use a lowercase username beginning with a letter, with at most 31 letters, numbers, underscores or hyphens.')
    if not full_name or len(full_name)>80 or any(ord(c)<32 for c in full_name):raise ValueError('Enter your name using 1 to 80 printable characters.')
    if require_password and (len(password)<8 or any(c in password for c in '\r\n\0')):raise ValueError('Use a password of at least 8 characters, without line breaks.')
    return username,full_name,password

def prepare(value,destination,metadata_only=False):
    username,full_name,password=validate_account(value,not metadata_only)
    destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
    (destination/'account.json').write_text(json.dumps({'username':username,'fullName':full_name},ensure_ascii=False,indent=2)+'\n')
    if metadata_only:return ''
    hashed=subprocess.run(['mkpasswd','--method=yescrypt','--stdin'],input=password+'\n',text=True,capture_output=True,check=True).stdout.strip()
    if not hashed.startswith('$y$'):raise ValueError('Password hashing did not complete.')
    descriptor,name=tempfile.mkstemp(prefix='boralances-account-',dir='/run')
    with os.fdopen(descriptor,'w') as stream:stream.write(username+':'+hashed+'\n')
    os.chmod(name,0o600)
    return name

if __name__=='__main__':
    try:print(prepare(json.load(sys.stdin),sys.argv[1],'--metadata-only' in sys.argv))
    except (ValueError,KeyError,subprocess.SubprocessError) as error:
        print('Account setup could not be prepared. Check your account fields and password hashing support.',file=sys.stderr);raise SystemExit(2)
