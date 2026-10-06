#!/bin/zsh
cd "${0:A:h}" || exit 1
URL='http://127.0.0.1:8765/?v=air-style1'
if /usr/sbin/lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi
LOG="${TMPDIR:-/tmp/}pixel-fighter-8765.log"
if ! command -v python3 >/dev/null 2>&1; then
  echo '未找到 Python 3，无法启动游戏服务。'
  read '?按回车关闭窗口。'
  exit 1
fi
echo '正在启动像素格斗……'
# 脱离启动终端，关闭窗口后本地服务仍继续运行。
python3 - "$PWD" "$LOG" <<'PY'
import subprocess, sys
with open(sys.argv[2], 'a') as log:
    subprocess.Popen(
        [sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'],
        cwd=sys.argv[1], stdin=subprocess.DEVNULL, stdout=log, stderr=log,
        start_new_session=True, close_fds=True,
    )
PY
for attempt in {1..30}; do
  if /usr/bin/curl --silent --fail "$URL" >/dev/null 2>&1; then
    open "$URL"
    echo '游戏已启动，可以关闭此窗口。'
    exit 0
  fi
  sleep 0.2
done
echo "启动失败，请查看日志：$LOG"
read '?按回车关闭窗口。'
exit 1
