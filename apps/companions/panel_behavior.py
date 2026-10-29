"""Dismiss transient panels after a real focus change, preserving child dialogs."""
from PySide6.QtCore import QObject,QEvent,QTimer
from PySide6.QtWidgets import QApplication


class PanelBehavior(QObject):
    def __init__(self,window):
        super().__init__(window)
        self.window=window
        self.activated=False
        window.installEventFilter(self)

    def eventFilter(self,obj,event):
        if event.type()==QEvent.Type.WindowActivate:
            self.activated=True
        elif event.type()==QEvent.Type.WindowDeactivate and self.activated:
            QTimer.singleShot(100,self.dismiss)
        return False

    def dismiss(self):
        active=QApplication.activeWindow()
        if active is self.window or QApplication.activePopupWidget() or QApplication.activeModalWidget():
            return
        # Focus can move into a file chooser belonging to this panel.
        if active and self.window.isAncestorOf(active):
            return
        self.window.close()
