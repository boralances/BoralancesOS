"""Pure helpers shared by the GUI and headless verification."""
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import quote_plus, urlsplit


def navigate(value: str) -> str:
    value = value.strip()
    if not value:
        return ''
    parsed = urlsplit(value)
    if parsed.scheme in {'http', 'https'} and parsed.netloc:
        return value
    # Do not pass javascript:, file:, data:, or OS commands to the location bar.
    if ' ' not in value and '.' in value and ':' not in value and '/' != value[0]:
        return 'https://' + value
    if value.startswith('localhost:') and value.split(':', 1)[1].split('/')[0].isdigit():
        return 'http://' + value
    return 'https://www.google.com/search?q=' + quote_plus(value)


def state_directory() -> Path:
    base = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share'))
    folder = base / 'boralances-browser'
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    return folder


def read_json(path, fallback):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return fallback


def atomic_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.state-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def safe_bookmarks(value):
    if not isinstance(value, list):
        return []
    return [x for x in value if isinstance(x, dict) and isinstance(x.get('title'), str)
            and isinstance(x.get('url'), str) and urlsplit(x['url']).scheme in {'http', 'https'}][:1000]
