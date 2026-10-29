"""A small, native calendar opened from the menu-bar clock."""
import json
import os
from pathlib import Path
from PySide6.QtCore import Qt, QDate
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QFrame, QLabel, QPushButton, QCalendarWidget


class CalendarPanel(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('Calendar')
        self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedSize(390,420)
        root=QVBoxLayout(self); root.setContentsMargins(0,0,0,0)
        frame=QFrame(); frame.setObjectName('calendarSurface'); root.addWidget(frame)
        body=QVBoxLayout(frame); body.setContentsMargins(18,16,18,15); body.setSpacing(12)
        row=QHBoxLayout(); title=QLabel('Calendar'); title.setStyleSheet('font-size:16px;font-weight:600;')
        row.addWidget(title); row.addStretch(); close=QPushButton('×'); close.setAccessibleName('Close calendar')
        close.setFixedSize(26,26); close.clicked.connect(self.close); row.addWidget(close); body.addLayout(row)
        self.calendar=QCalendarWidget(); self.calendar.setGridVisible(False); self.calendar.setFirstDayOfWeek(Qt.DayOfWeek.Monday)
        try: state=json.loads((Path(os.environ.get('XDG_CONFIG_HOME',Path.home()/'.config'))/'boralances/state.json').read_text())
        except (OSError,ValueError): state={}
        self.calendar.setVerticalHeaderFormat(QCalendarWidget.VerticalHeaderFormat.ISOWeekNumbers if state.get('calendar-week-numbers')=='true' else QCalendarWidget.VerticalHeaderFormat.NoVerticalHeader)
        body.addWidget(self.calendar,1)
        today=QPushButton('Today · '+QDate.currentDate().toString('ddd, MMM d')); today.clicked.connect(self.today); body.addWidget(today)
        self.setStyleSheet('''
          QWidget{font:13px Inter;color:#eef3ff;background:transparent;}
          QFrame#calendarSurface{background:rgba(27,34,48,248);border:1px solid rgba(235,244,255,45);border-radius:20px;}
          QCalendarWidget QWidget#qt_calendar_navigationbar{background:transparent;}
          QCalendarWidget QAbstractItemView{background:transparent;selection-background-color:#377ee2;selection-color:white;outline:0;border:0;alternate-background-color:transparent;}
          QCalendarWidget QToolButton{color:#f3f6ff;background:transparent;border:0;font-size:14px;font-weight:600;padding:8px;}
          QCalendarWidget QSpinBox{background:#26344b;color:#eef3ff;border:0;}
          QCalendarWidget QMenu{background:#26344b;color:#eef3ff;}
          QPushButton{background:rgba(220,235,255,14);border:1px solid rgba(255,255,255,24);border-radius:10px;padding:9px;}
          QPushButton:hover{background:rgba(160,199,255,35);}
        ''')

    def today(self): self.calendar.setSelectedDate(QDate.currentDate()); self.calendar.showToday()

    def keyPressEvent(self,event):
        if event.key()==Qt.Key.Key_Escape: self.close()
        else: super().keyPressEvent(event)
