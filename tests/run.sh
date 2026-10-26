#!/usr/bin/env bash
# รันเทสต์ถดถอย: bash tests/run.sh            → ทุกตัว
#                 bash tests/run.sh t3 ui41    → เฉพาะที่ระบุ
#                 bash tests/run.sh server     → เฉพาะฝั่งเซิร์ฟเวอร์ (ไม่เปิดเบราว์เซอร์)
# ต้องมีข้อมูลทดสอบใน tests/fixtures/ (ไม่อยู่ใน git — ดู tests/README.md)
# ภาพหน้าจอ/ไฟล์ผลลัพธ์ของเทสต์ถูกเขียนลง tests/out/
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER="gas1 chars1 t3 t4 t5 t6 t7 t8 t9 t11 t13 t14 sar1 clt1 n3 tidy4 merge2 pct2 sub1 v3 v4 v5 carry1 link1"
UI="ui18 ui20 ui23 ui24 ui25 ui26 ui27 ui28 ui31 ui32 ui33 ui34 ui35 ui35b ui36 ui37 ui38 ui39 ui40 ui41 ui42 ui43 ui44 ui45 ui46 ui47 ui48 ui49 ui50 ui51 ui52 ui53"
TOUR="ui40" # เทสต์ที่ต้องเห็นป๊อปอัประบบสอน (ตัวอื่นปิดไว้ผ่าน TOUR_HIDE_V1)

if [[ ! -f "$DIR/fixtures/db.json" ]]; then
  echo "ไม่พบ tests/fixtures/ — ดู tests/README.md" >&2; exit 2
fi
# acorn (devDependency) ใช้ใน gas1 — ติดตั้งให้ถ้ายังไม่มี
(cd "$DIR/.." && node -e "require('acorn')" 2>/dev/null) || (cd "$DIR/.." && npm install --no-audit --no-fund --no-package-lock --silent)

if [[ $# -eq 0 ]]; then LIST="$SERVER $UI"
elif [[ "$1" == server ]]; then LIST="$SERVER"
elif [[ "$1" == ui ]]; then LIST="$UI"
else LIST="$*"; fi

mkdir -p "$DIR/out"; cd "$DIR/out"
pass=0; fail=0; failed=""
for t in $LIST; do
  env=""; [[ " $TOUR " == *" $t "* ]] && env="TOURTEST=1"
  if out=$(env $env timeout 300 node "$DIR/$t.js" 2>&1) && ! grep -qE "AssertionError|Error:" <<<"$out"; then
    pass=$((pass+1)); echo "ok   $t"
  else
    fail=$((fail+1)); failed="$failed $t"; echo "FAIL $t"; grep -E "Error|assert|rror:|Timeout" <<<"$out" | head -6 | sed 's/^/     /'
  fi
done
echo "ผ่าน $pass · ไม่ผ่าน $fail${failed:+ →$failed}"
[[ $fail -eq 0 ]]
