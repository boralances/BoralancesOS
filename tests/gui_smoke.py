"""Optional host-side GUI smoke test, with isolated data and no remote requests."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-output'
OUT.mkdir(exist_ok=True)
os.environ['XDG_DATA_HOME'] = str(OUT / 'isolated-data')
os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
os.environ.setdefault('QTWEBENGINE_CHROMIUM_FLAGS', '--disable-gpu')
sys.path.insert(0, str(ROOT / 'apps/browser'))
sys.path.insert(0, str(ROOT / '.cache/gui'))

from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QApplication
from boralances_browser.main import Browser

app = QApplication([])
browser = Browser()
browser.show()
private = Browser(private=True)
assert not browser.profile.isOffTheRecord()
assert private.profile.isOffTheRecord()
assert private.bookmarks == []
failures = []


def inspect(value):
    try:
        assert value, 'Missing page inspection result'
        state = json.loads(value)
        assert state['title'] == 'Boralances · New tab', state
        assert state['optics'] and state['filters'] > 0, state
        assert state['inputs'] == 1, state
        browser.grab().save(str(OUT / 'browser-linux-port-host-smoke.png'))
        browser.new_tab()
        assert browser.tabs.count() == 2
        browser.close_tab(1)
        assert browser.tabs.count() == 1
        report = {'hostPlatform': sys.platform, 'qtPlatform': os.environ['QT_QPA_PLATFORM'],
                  'regularPersistent': not browser.profile.isOffTheRecord(),
                  'privateOffTheRecord': private.profile.isOffTheRecord(),
                  'localHomePage': state, 'tabCreateClose': True,
                  'linuxRuntimeValidated': False}
        (OUT / 'gui-smoke.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
    except Exception as error:
        failures.append(str(error))
        print('GUI smoke failed:', error, file=sys.stderr)
    finally:
        private.close()
        browser.close()
        QTimer.singleShot(200, app.quit)


def check():
    browser.view().page().runJavaScript('JSON.stringify({title:document.title,optics:!!window.ReferenceGlass,filters:document.querySelectorAll("filter").length,inputs:document.querySelectorAll("input").length})', inspect)


QTimer.singleShot(3500, check)
def timeout():
    failures.append('GUI timeout: host WebEngine did not return page inspection')
    print(failures[-1], file=sys.stderr, flush=True)
    app.quit()

QTimer.singleShot(12000, timeout)
app.exec()
raise SystemExit(1 if failures else 0)
