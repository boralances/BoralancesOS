#!/usr/bin/env bash
set -euo pipefail
destination=${1:-"$HOME/boralances-baseline.json"}
# Run after 120 seconds at the desktop, with no user apps open, on installed media.
python3 - "$destination" <<'PY'
import json, pathlib, platform, subprocess, sys
from datetime import datetime, timezone
values = {k: int(v.split()[0]) for k, v in (line.split(':', 1) for line in pathlib.Path('/proc/meminfo').read_text().splitlines())}
used = (values['MemTotal'] - values['MemAvailable']) * 1024
def command(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()
report = {
  'timestamp': datetime.now(timezone.utc).isoformat(),
  'kernel': platform.release(), 'memoryUsedBytes': used,
  'memoryTargetBytes': 800_000_000, 'memoryTargetMet': used < 800_000_000,
  'definition': 'MemTotal minus MemAvailable; decimal MB; includes kernel and desktop, excludes reclaimable cache',
  'boot': command('systemd-analyze'),
  'criticalChain': command('systemd-analyze', 'critical-chain'),
  'services': command('systemctl', 'list-units', '--type=service', '--state=running', '--no-pager'),
  'gpu': command('lspci', '-nn'), 'session': command('hyprctl', 'version')
}
pathlib.Path(sys.argv[1]).write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
PY
