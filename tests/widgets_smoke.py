"""Render native UI surfaces with isolated state; never start installation."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
os.environ['QT_QPA_PLATFORM'] = 'offscreen'
os.environ['XDG_CONFIG_HOME'] = str(ROOT / 'test-output/widget-config')
sys.path[:0] = [str(ROOT / '.cache/gui'), str(ROOT / 'apps/companions')]
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import QTimer
from PySide6.QtGui import QFontDatabase, QFont
from experience import Welcome, Installer, ControlCenter

app = QApplication([])
if sys.platform == 'win32':
    QFontDatabase.addApplicationFont('C:/Windows/Fonts/segoeui.ttf')
    QFontDatabase.addApplicationFont('C:/Windows/Fonts/segoeuib.ttf')
    app.setFont(QFont('Segoe UI', 10))
windows = [Welcome(), Installer(), ControlCenter()]
for window in windows:
    window.show()


def check():
    try:
        for window, name in zip(windows, ['welcome', 'installer', 'control-center']):
            assert window.width() >= 650 and window.height() >= 480
            assert window.grab().save(str(ROOT / f'design/native-{name}.png'))
        installer = windows[1]
        installer.set_page(3)
        assert not installer.next.isEnabled()
        installer.confirm.setChecked(True)
        assert installer.next.isEnabled()
        assert installer.process is None
        for index in range(6):
            installer.set_page(index)
        assert installer.process is None
        result = {'hostPlatform': sys.platform, 'nativeSurfacesRendered': 3,
                  'installerConsentRequired': True, 'installerPages': 6,
                  'installationStarted': False, 'linuxRuntimeValidated': False}
        (ROOT / 'test-output/widgets-smoke.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
    except Exception as error:
        print(error, file=sys.stderr)
        app.exit(1)
        return
    for window in windows:
        window.close()
    app.quit()


QTimer.singleShot(300, check)
raise SystemExit(app.exec())
