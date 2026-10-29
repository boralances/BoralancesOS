import os
from pathlib import Path
import sys
import re
import shutil
import ipaddress
from .tor_policy import chromium_flags, TOR_HOST, TOR_PORT

TOR_MODE = '--tor' in sys.argv

# VirtualBox's VMSVGA renderer can reject QtWebEngine surfaces. Keep the
# compositor accelerated, but use Mesa software rendering for this browser.
# Explicit environment choices still take precedence; Chromium stays sandboxed.
try:
    in_virtualbox = Path('/sys/class/dmi/id/product_name').read_text().strip() == 'VirtualBox'
except OSError:
    in_virtualbox = False
if in_virtualbox:
    os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE', '1')
    os.environ.setdefault('QT_QUICK_BACKEND', 'software')
    os.environ.setdefault('QTWEBENGINE_CHROMIUM_FLAGS', '--disable-gpu')
    os.environ.setdefault('LP_NUM_THREADS', '2')

if TOR_MODE:
    os.environ['QTWEBENGINE_CHROMIUM_FLAGS'] = chromium_flags(os.environ.get('QTWEBENGINE_CHROMIUM_FLAGS',''))

from PySide6.QtCore import Qt, QTimer, QUrl, QProcess
from PySide6.QtNetwork import QNetworkProxy
from PySide6.QtGui import QAction, QDesktopServices, QKeySequence, QIcon
from PySide6.QtWidgets import (QApplication, QFileDialog, QInputDialog, QLineEdit,
    QMainWindow, QMenu, QMessageBox, QTabWidget, QToolBar, QToolButton, QLabel)
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings, QWebEngineUrlRequestInterceptor
from PySide6.QtWebEngineWidgets import QWebEngineView

from .model import atomic_json, navigate, read_json, safe_bookmarks, state_directory

WEB = Path(__file__).parent / 'web'
WINDOWS = []


class TorRequestPolicy(QWebEngineUrlRequestInterceptor):
    def interceptRequest(self, info):
        url=info.requestUrl()
        if url.scheme() in ('http','https'):
            host=url.host().lower()
            try: local=not ipaddress.ip_address(host).is_global
            except ValueError: local=host=='localhost' or host.endswith(('.localhost','.local'))
            if local: info.block(True)


class Page(QWebEnginePage):
    def acceptNavigationRequest(self, url, _kind, is_main_frame):
        trusted = url.isLocalFile() and Path(url.toLocalFile()).resolve().is_relative_to(WEB.resolve())
        if url.scheme() not in ('http', 'https', 'about') and not trusted:
            return False
        # Hand home-page links and GET searches to native navigation. Chromium
        # otherwise treats them as remote access from a restricted file origin.
        # Keep local pages unable to fetch remote subresources or arbitrary files.
        current = self.url()
        local_home = current.isLocalFile() and Path(current.toLocalFile()).resolve().is_relative_to(WEB.resolve())
        native_home = is_main_frame and getattr(self, '_native_home_target', None) == url.toString()
        if native_home:
            self._native_home_target = None
        if is_main_frame and local_home and url.scheme() in ('http', 'https') and not native_home:
            target = QUrl(url)
            def navigate_home():
                self._native_home_target = target.toString()
                self.setUrl(target)
            QTimer.singleShot(0, navigate_home)
            return False
        if is_main_frame:
            self.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, trusted)
        return True


class View(QWebEngineView):
    def __init__(self, browser):
        super().__init__()
        self.browser = browser
        page = Page(browser.profile, self)
        self.setPage(page)
        page.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
        page.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, False)
        page.permissionRequested.connect(self.permission)
        page.fullScreenRequested.connect(self.fullscreen)

    def createWindow(self, _kind):
        return self.browser.new_tab(focus=True)

    def permission(self, permission):
        if TOR_MODE:
            permission.deny()
            return
        origin = permission.origin().toString()
        answer = QMessageBox.question(self.browser, 'Website permission',
            f'{origin}\n\nAllow {permission.permissionType().name}?',
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No)
        permission.grant() if answer == QMessageBox.StandardButton.Yes else permission.deny()

    def fullscreen(self, request):
        request.accept()
        if request.toggleOn():
            self.browser.showFullScreen()
        else:
            self.browser.showNormal()


class Browser(QMainWindow):
    def __init__(self, initial=None, private=False):
        super().__init__()
        WINDOWS.append(self)
        private = private or TOR_MODE
        self.private = private
        self.tor_ready = False
        self.tor_pending = initial
        self.folder = state_directory()
        self.downloads = []
        self.bookmarks = [] if private else safe_bookmarks(read_json(self.folder / 'bookmarks.json', []))
        self.profile = QWebEngineProfile(self) if private else QWebEngineProfile('BoralancesLinux', self)
        if TOR_MODE:
            self.tor_policy=TorRequestPolicy(self.profile)
            self.profile.setUrlRequestInterceptor(self.tor_policy)
        if not private:
            self.profile.setPersistentStoragePath(str(self.folder / 'profile'))
            self.profile.setCachePath(str(self.folder / 'cache'))
        self.profile.setHttpCacheMaximumSize(128 * 1024 * 1024)
        self.profile.downloadRequested.connect(self.download)
        self.setWindowTitle('BoralancesBrowser' + (' · Tor' if TOR_MODE else ' · Private' if private else ''))
        self.resize(1280, 850)
        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)
        self.tabs.setMovable(True)
        self.tabs.setTabsClosable(True)
        self.tabs.tabCloseRequested.connect(self.close_tab)
        self.tabs.currentChanged.connect(self.current_changed)
        self.setCentralWidget(self.tabs)
        self.toolbar = QToolBar()
        self.toolbar.setMovable(False)
        self.addToolBar(self.toolbar)
        for label, callback, shortcut in [
            ('←', lambda: self.view().back(), 'Alt+Left'),
            ('→', lambda: self.view().forward(), 'Alt+Right'),
            ('↻', lambda: self.view().reload(), 'Ctrl+R'),
        ]:
            self.action(label, callback, shortcut, self.toolbar)
        self.address = QLineEdit()
        self.address.setPlaceholderText('Search or enter a website')
        self.address.returnPressed.connect(self.go)
        self.toolbar.addWidget(self.address)
        self.action('☆', self.bookmark, 'Ctrl+D', self.toolbar)
        self.action('+', lambda: self.new_tab(), 'Ctrl+T', self.toolbar)
        menu_button = QToolButton()
        menu_button.setText('☰')
        menu_button.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        menu = QMenu(menu_button)
        for title, callback in [
            ('New Tor window', self.new_tor),
            ('New private window', self.new_private), ('Bookmarks', self.show_bookmarks),
            ('Downloads', self.show_downloads), ('Find in page', self.find),
            ('Save workspace', self.save_workspace), ('Restore workspace', self.restore_workspace),
            ('Appearance', self.appearance), ('About this Linux port', self.about),
        ]:
            menu.addAction(title, callback)
        menu_button.setMenu(menu)
        self.toolbar.addWidget(menu_button)
        for label, callback, shortcut in [
            ('Focus address', self.focus_address, 'Ctrl+L'),
            ('Close tab', lambda: self.close_tab(self.tabs.currentIndex()), 'Ctrl+W'),
            ('Private window', self.new_private, 'Ctrl+Shift+N'),
            ('Downloads', self.show_downloads, 'Ctrl+J'), ('Find', self.find, 'Ctrl+F'),
            ('Zoom in', lambda: self.zoom(0.1), 'Ctrl+='),
            ('Zoom out', lambda: self.zoom(-0.1), 'Ctrl+-'),
            ('Reset zoom', lambda: self.view().setZoomFactor(1), 'Ctrl+0'),
            ('Leave fullscreen', self.showNormal, 'Escape'),
        ]:
            self.action(label, callback, shortcut)
        self.mode = read_json(self.folder / 'appearance.json', {}).get('mode', 'dark')
        self.apply_style()
        self.new_tab(initial)
        if TOR_MODE:
            self.tor_badge=QLabel('Tor · Connecting…')
            self.tor_badge.setStyleSheet('color:#d2b9ff;padding:3px 10px;')
            self.statusBar().addPermanentWidget(self.tor_badge)
            self.address.setEnabled(False)
            self.tor_process=QProcess(self)
            self.tor_process.finished.connect(self.tor_service_started)
            self.tor_process.errorOccurred.connect(lambda _error:self.tor_badge.setText('Tor unavailable · network blocked'))
            self.tor_poll=QProcess(self); self.tor_poll.finished.connect(self.tor_progress)
            self.tor_timer=QTimer(self); self.tor_timer.timeout.connect(self.poll_tor)
            self.tor_process.start('systemctl',['--user','start','boralances-tor.service'])

    def action(self, title, callback, shortcut=None, toolbar=None):
        action = QAction(title, self)
        if shortcut:
            action.setShortcut(QKeySequence(shortcut))
        action.triggered.connect(callback)
        self.addAction(action)
        if toolbar:
            toolbar.addAction(action)
        return action

    def view(self):
        return self.tabs.currentWidget()

    def new_tab(self, url=None, focus=True):
        # QAction's triggered(bool) must never be treated as a URL.
        if isinstance(url, bool):
            url = None
        view = View(self)
        index = self.tabs.addTab(view, 'New tab')
        view.titleChanged.connect(lambda title, v=view: self.tab_title(v, title))
        view.urlChanged.connect(lambda _url, v=view: self.sync_address(v))
        view.loadProgress.connect(lambda progress: self.statusBar().showMessage(f'Loading {progress}%' if progress < 100 else ''))
        home = 'private.html' if self.private else 'index.html'
        if in_virtualbox and not self.private:
            home = 'desktop-home.html'
        if TOR_MODE:
            home='tor.html'
        view.setUrl(QUrl(navigate(url)) if url and (not TOR_MODE or self.tor_ready) else QUrl.fromLocalFile(str(WEB / home)))
        if focus:
            self.tabs.setCurrentIndex(index)
        return view

    def tab_title(self, view, title):
        index = self.tabs.indexOf(view)
        if index >= 0:
            self.tabs.setTabText(index, (title or 'New tab')[:32])
            self.tabs.setTabToolTip(index, title)

    def close_tab(self, index):
        if self.tabs.count() == 1:
            self.close()
            return
        view = self.tabs.widget(index)
        self.tabs.removeTab(index)
        view.deleteLater()

    def current_changed(self, _index):
        if self.view():
            self.sync_address(self.view())

    def sync_address(self, view):
        if view is self.view() and not self.address.hasFocus():
            url = view.url()
            self.address.setText('' if url.isLocalFile() else url.toString())

    def focus_address(self):
        self.address.setFocus()
        self.address.selectAll()

    def go(self):
        url = navigate(self.address.text())
        if url:
            self.view().setUrl(QUrl(url))
            self.view().setFocus()

    def zoom(self, delta):
        self.view().setZoomFactor(max(0.25, min(3, self.view().zoomFactor() + delta)))

    def new_private(self):
        Browser(private=True).show()

    def new_tor(self):
        QProcess.startDetached(shutil.which('boralances-browser') or sys.argv[0],['--tor'])

    def tor_service_started(self,code,_status):
        if code:
            self.tor_badge.setText('Tor unavailable · network blocked')
            return
        self.tor_timer.start(1800); self.poll_tor()

    def poll_tor(self):
        if self.tor_poll.state()!=QProcess.ProcessState.NotRunning: return
        self.tor_poll.start('journalctl',['--user','-b','-u','boralances-tor.service','-n','80','-o','cat','--no-pager'])

    def tor_progress(self,code,_status):
        text=bytes(self.tor_poll.readAllStandardOutput()).decode(errors='replace')
        progress=re.findall(r'Bootstrapped (\d+)%',text)
        percent=int(progress[-1]) if progress else 0
        self.tor_badge.setText(f'Tor · Connecting {percent}%' if percent<100 else 'Tor · Connected')
        if code==0 and percent==100:
            self.tor_ready=True; self.tor_timer.stop(); self.address.setEnabled(True)
            self.view().setUrl(QUrl(navigate(self.tor_pending or 'https://check.torproject.org/')))

    def bookmark(self):
        if self.private:
            QMessageBox.information(self, 'Private browsing', 'Bookmarks are not saved from private windows.')
            return
        url = self.view().url().toString()
        if QUrl(url).scheme() not in ('http', 'https'):
            return
        self.bookmarks = [x for x in self.bookmarks if x['url'] != url]
        self.bookmarks.append({'title': self.view().title(), 'url': url})
        atomic_json(self.folder / 'bookmarks.json', self.bookmarks)
        self.statusBar().showMessage('Bookmark saved', 2500)

    def show_bookmarks(self):
        if not self.bookmarks:
            QMessageBox.information(self, 'Bookmarks', 'Use Ctrl+D to save a website.')
            return
        choices = [f'{i+1}. {x["title"]}' for i, x in enumerate(self.bookmarks)]
        selected, ok = QInputDialog.getItem(self, 'Bookmarks', 'Open website', choices, editable=False)
        if ok:
            self.new_tab(self.bookmarks[choices.index(selected)]['url'])

    def download(self, request):
        suggested = Path.home() / 'Downloads' / Path(request.downloadFileName()).name
        filename, _ = QFileDialog.getSaveFileName(self, 'Save download', str(suggested))
        if not filename:
            request.cancel()
            return
        path = Path(filename)
        request.setDownloadDirectory(str(path.parent))
        request.setDownloadFileName(path.name)
        self.downloads.append(request)
        request.receivedBytesChanged.connect(lambda: self.statusBar().showMessage(
            f'{path.name}: {request.receivedBytes() / 1048576:.1f} MiB'))
        request.isFinishedChanged.connect(lambda: self.statusBar().showMessage(f'Download: {request.state().name}', 6000))
        request.accept()

    def show_downloads(self):
        lines = [f'{r.downloadFileName()} — {r.state().name} ({r.receivedBytes()/1048576:.1f} MiB)' for r in self.downloads]
        QMessageBox.information(self, 'Downloads', '\n'.join(lines) or 'No downloads in this window.')

    def find(self):
        query, ok = QInputDialog.getText(self, 'Find in page', 'Text')
        if ok:
            self.view().findText(query)

    def save_workspace(self):
        if self.private:
            return
        urls = [self.tabs.widget(i).url().toString() for i in range(self.tabs.count())]
        atomic_json(self.folder / 'workspace.json', [u for u in urls if QUrl(u).scheme() in ('http', 'https')])
        self.statusBar().showMessage('Workspace saved', 2500)

    def restore_workspace(self):
        if self.private:
            return
        urls = read_json(self.folder / 'workspace.json', [])
        if isinstance(urls, list):
            for url in urls[:30]:
                if isinstance(url, str) and QUrl(url).scheme() in ('http', 'https'):
                    self.new_tab(url)

    def appearance(self):
        mode, ok = QInputDialog.getItem(self, 'Appearance', 'Color scheme', ['dark', 'light', 'system'], editable=False)
        if ok:
            self.mode = mode
            self.apply_style()
            if not self.private:
                atomic_json(self.folder / 'appearance.json', {'mode': mode})

    def apply_style(self):
        dark = self.mode == 'dark' or (self.mode == 'system' and self.palette().window().color().lightness() < 128)
        bg, fg, field = ('#101625', '#eef2ff', '#202b41') if dark else ('#edf1f8', '#182137', '#ffffff')
        self.setStyleSheet(f'''
            QMainWindow,QToolBar,QTabWidget::pane {{background:{bg};color:{fg};border:0;}}
            QLineEdit {{background:{field};color:{fg};padding:10px 16px;border:1px solid #526583;border-radius:16px;min-width:250px;}}
            QToolBar {{spacing:8px;padding:10px;}}
            QToolButton,QTabBar::tab {{background:transparent;color:{fg};padding:9px;border-radius:8px;}}
            QToolButton:hover,QTabBar::tab:selected {{background:{field};}}
            QMenu {{background:{bg};color:{fg};padding:8px;}}
            QMenu::item:selected {{background:{field};}}
        ''')

    def about(self):
        QMessageBox.information(self, 'BoralancesBrowser for Linux',
            'Native QtWebEngine port with glass optics from your Browser project.\n\n'
            'Tor mode uses a separate in-memory profile and a local Tor SOCKS proxy. '
            'Windows WebView2 profiles, Gemini credentials and extension support are not imported. '
            'Private windows use an in-memory profile; downloaded files remain on disk.')

    def closeEvent(self, event):
        if TOR_MODE:
            self.tor_timer.stop()
            for process in (self.tor_process,self.tor_poll):
                if process.state()!=QProcess.ProcessState.NotRunning:
                    process.kill(); process.waitForFinished(200)
        # Delete pages before their owning profile to avoid profile-release races.
        for i in range(self.tabs.count()):
            view = self.tabs.widget(i)
            view.setPage(QWebEnginePage(view))
        if self in WINDOWS:
            WINDOWS.remove(self)
        event.accept()
        self.deleteLater()


def main():
    os.environ.setdefault('QTWEBENGINE_CHROMIUM_FLAGS', '--ozone-platform-hint=auto')
    app = QApplication(sys.argv)
    QIcon.setThemeName('Boralances')
    app.setWindowIcon(QIcon('/etc/boralances/icons/boralances-'+('tor' if TOR_MODE else 'browser')+'.svg'))
    if TOR_MODE:
        proxy=QNetworkProxy(QNetworkProxy.ProxyType.Socks5Proxy,TOR_HOST,TOR_PORT)
        QNetworkProxy.setApplicationProxy(proxy)
    app.setApplicationName('BoralancesBrowser')
    app.setDesktopFileName('boralances-browser')
    urls = [x for x in sys.argv[1:] if not x.startswith('--')]
    window = Browser(urls[0] if urls else None, private='--private' in sys.argv)
    for url in urls[1:]:
        window.new_tab(url)
    window.show()
    return app.exec()


if __name__ == '__main__':
    raise SystemExit(main())
