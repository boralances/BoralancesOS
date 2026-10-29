"""Read the current Tor process, rather than trusting historical journal lines."""
import json
import os
from pathlib import Path
import re
import socket

from .tor_policy import TOR_HOST, TOR_PORT


def control_reply(directory):
    cookie = (directory / 'control.authcookie').read_bytes()
    if len(cookie) != 32:
        raise ValueError('Invalid control cookie')
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as control:
        control.settimeout(1.5)
        control.connect(str(directory / 'control'))
        stream = control.makefile('rwb', buffering=0)
        stream.write(b'AUTHENTICATE ' + cookie.hex().encode('ascii') + b'\r\n')
        if stream.readline(4096).strip() != b'250 OK':
            raise ValueError('Control authentication failed')
        stream.write(b'GETINFO status/bootstrap-phase\r\n')
        lines = []
        for _ in range(16):
            line = stream.readline(4096)
            if not line:
                break
            lines.append(line.decode('utf-8', errors='replace'))
            if line.startswith(b'250 ') or line.startswith(b'5'):
                break
        return ''.join(lines)


def socks_available():
    with socket.create_connection((TOR_HOST, TOR_PORT), timeout=1.5) as proxy:
        proxy.sendall(b'\x05\x01\x00')
        greeting = b''
        while len(greeting) < 2:
            data = proxy.recv(2 - len(greeting))
            if not data:
                return False
            greeting += data
        return greeting == b'\x05\x00'


def status(directory=None):
    directory = directory or Path(os.environ.get('XDG_STATE_HOME', Path.home() / '.local/state')) / 'boralances-tor'
    try:
        reply = control_reply(directory)
        match = re.search(r'\bPROGRESS=(\d+)\b', reply)
        progress = min(100, int(match.group(1))) if match else 0
        ready = progress == 100 and socks_available()
        return {'ready': ready, 'progress': progress, 'message': 'Connected' if ready else f'Connecting {progress}%'}
    except (OSError, ValueError):
        return {'ready': False, 'progress': 0, 'message': 'Not connected · use Reconnect Tor'}


def main():
    print(json.dumps(status()))


if __name__ == '__main__':
    main()
