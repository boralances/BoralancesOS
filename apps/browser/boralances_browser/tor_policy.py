"""Fixed, fail-closed Chromium proxy policy for the separate Tor process."""
import shlex

TOR_HOST='127.0.0.1'
TOR_PORT=9050


def chromium_flags(existing=''):
    flags=shlex.split(existing)
    replaced=('--proxy-server','--proxy-pac-url','--proxy-auto-detect','--no-proxy-server',
              '--host-resolver-rules','--proxy-bypass-list','--force-webrtc-ip-handling-policy')
    flags=[flag for flag in flags if not any(flag==key or flag.startswith(key+'=') for key in replaced)]
    flags += [f'--proxy-server=socks5://{TOR_HOST}:{TOR_PORT}',
              '--proxy-bypass-list=<-loopback>',
              f'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE {TOR_HOST}',
              '--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--disable-quic']
    return ' '.join('"'+flag.replace('"','\\"')+'"' if any(c.isspace() for c in flag) else flag for flag in flags)
