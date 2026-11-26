#!/usr/bin/env bash
# تست دودی کامل APIهای بانک — استپ ۱۹
# سناریو: ۲ عضو، ۵ واریزی، وام ۳ قسطی با پرداخت، تسویه + مسیرهای خطا
# اجرا: سرور باید روی 3100 بالا باشد → bash /home/z/my-project/scripts/bank-smoke-test.sh
BASE="http://localhost:3100"
# ورود ادمین — کوکی نشست در /tmp/jar-reg.txt (فراخوانی‌های api و backup به آن نیاز دارند)
curl -s -c /tmp/jar-reg.txt -H "Content-Type: application/json" -d '{"username":"admin","password":"Admin@12345"}' "$BASE/api/auth/login" > /dev/null
PASS=0
FAIL=0

ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL: $1  →  $2"; }

api() { # api METHOD PATH [DATA] → خروجی: body\nSTATUS
  local m=$1 p=$2 d=$3
  if [ -n "$d" ]; then
    curl -s -b /tmp/jar-reg.txt -w $'\n%{http_code}' -X "$m" "$BASE$p" -H "Content-Type: application/json" -d "$d"
  else
    curl -s -b /tmp/jar-reg.txt -w $'\n%{http_code}' -X "$m" "$BASE$p"
  fi
}
body_of() { sed '$d' <<< "$1"; }
code_of() { tail -n1 <<< "$1"; }
jf() { body_of "$1" | python3 -c "import json,sys; d=json.load(sys.stdin); print($2)" 2>/dev/null; }

echo "===== تنظیمات ====="
R=$(api GET /api/bank/settings)
[ "$(code_of "$R")" = "200" ] && ok "settings GET 200" || bad "settings GET" "$(code_of "$R")"
R=$(api PUT /api/bank/settings '{"amountPerShare":300000,"depositTitles":["سهم ماهانه","سود وام","واریزی متفرقه"],"duplicateWarning":true}')
[ "$(code_of "$R")" = "200" ] && ok "settings PUT 200" || bad "settings PUT" "$(code_of "$R")"
[ "$(jf "$R" "d['amountPerShare']")" = "300000" ] && ok "amountPerShare=300000" || bad "amountPerShare" "$(jf "$R" "d['amountPerShare']")"

echo "===== اعضا ====="
RA=$(api POST /api/bank/members '{"name":"مصطفی كريمی","shares":2,"phone":"09121112222","gender":"male"}')
AID=$(jf "$RA" "d['id']")
[ "$(code_of "$RA")" = "201" ] && ok "member A ثبت 201" || bad "member A ثبت" "$(code_of "$RA")"
RB=$(api POST /api/bank/members '{"name":"مریم احمدی","shares":1,"phone":"09354445566","gender":"female"}')
BID=$(jf "$RB" "d['id']")
[ "$(code_of "$RB")" = "201" ] && ok "member B ثبت 201" || bad "member B ثبت" "$(code_of "$RB")"
R=$(api GET /api/bank/members)
[ "$(jf "$R" "len(d)")" = "2" ] && ok "members GET تعداد=2" || bad "members GET" "$(jf "$R" "len(d)")"
R=$(api PATCH /api/bank/members/$AID '{"phone":"09121112333","note":"ویرایش تست"}')
[ "$(code_of "$R")" = "200" ] && ok "member PATCH 200" || bad "member PATCH" "$(code_of "$R")"
[ "$(jf "$R" "d['phone']")" = "09121112333" ] && ok "member PATCH تلفن به‌روز" || bad "member PATCH تلفن" "$(jf "$R" "d['phone']")"
R=$(api POST /api/bank/members '{"name":"","shares":1}')
[ "$(code_of "$R")" = "400" ] && ok "member بدون نام → 400" || bad "member بدون نام" "$(code_of "$R")"
R=$(api PATCH /api/bank/members/ghost '{"phone":"1"}')
[ "$(code_of "$R")" = "404" ] && ok "member PATCH ناموجود → 404" || bad "member PATCH ناموجود" "$(code_of "$R")"

echo "===== واریزی‌ها ====="
D1=$(api POST /api/bank/deposits "{\"memberId\":\"$AID\",\"type\":\"share\",\"title\":\"سهم ماهانه\",\"amount\":600000,\"periodKey\":\"1405/09\"}")
D1ID=$(jf "$D1" "d['id']")
[ "$(code_of "$D1")" = "201" ] && ok "واریزی A1 سهام 201" || bad "واریزی A1" "$(code_of "$D1")"
D2=$(api POST /api/bank/deposits "{\"memberId\":\"$AID\",\"type\":\"share\",\"title\":\"سهم ماهانه\",\"amount\":600000,\"periodKey\":\"1405/09\"}")
D2ID=$(jf "$D2" "d['id']")
[ "$(code_of "$D2")" = "201" ] && ok "واریزی A2 سهام 201" || bad "واریزی A2" "$(code_of "$D2")"
D3=$(api POST /api/bank/deposits "{\"memberId\":\"$BID\",\"type\":\"share\",\"title\":\"سهم ماهانه\",\"amount\":300000,\"periodKey\":\"1405/09\"}")
D3ID=$(jf "$D3" "d['id']")
[ "$(code_of "$D3")" = "201" ] && ok "واریزی B سهام 201" || bad "واریزی B" "$(code_of "$D3")"
D4=$(api POST /api/bank/deposits '{"memberId":null,"type":"loan_interest","title":"سود وام","amount":50000,"periodKey":"1405/09"}')
[ "$(code_of "$D4")" = "201" ] && ok "واریزی سود بدون عضو 201" || bad "واریزی سود" "$(code_of "$D4")"
D5=$(api POST /api/bank/deposits '{"memberId":null,"type":"misc","title":"متفرقه","amount":200000,"periodKey":"1405/09"}')
D5ID=$(jf "$D5" "d['id']")
[ "$(code_of "$D5")" = "201" ] && ok "واریزی متفرقه 201" || bad "واریزی متفرقه" "$(code_of "$D5")"
R=$(api PATCH /api/bank/deposits/$D5ID '{"amount":250000}')
[ "$(code_of "$R")" = "200" ] && [ "$(jf "$R" "d['amount']")" = "250000" ] && ok "deposit PATCH مبلغ 250000" || bad "deposit PATCH" "$(code_of "$R")"
DT=$(api POST /api/bank/deposits '{"memberId":null,"type":"misc","title":"موقت","amount":1000,"periodKey":"1405/09"}')
DTID=$(jf "$DT" "d['id']")
R=$(api DELETE /api/bank/deposits/$DTID)
[ "$(code_of "$R")" = "200" ] && ok "deposit DELETE 200" || bad "deposit DELETE" "$(code_of "$R")"
R=$(api GET /api/bank/deposits)
[ "$(jf "$R" "len(d)")" = "5" ] && ok "deposits GET تعداد=5" || bad "deposits GET" "$(jf "$R" "len(d)")"
[ "$(jf "$R" "sum(x['amount'] for x in d)")" = "1800000" ] && ok "جمع واریزی‌ها=1800000" || bad "جمع واریزی‌ها" "$(jf "$R" "sum(x['amount'] for x in d)")"
R=$(api POST /api/bank/deposits '{"memberId":"ghost","type":"share","title":"بدون عضو واقعی","amount":100,"periodKey":"1405/09"}')
[ "$(code_of "$R")" = "400" ] && ok "واریزی عضو ناشناس → 400" || bad "واریزی عضو ناشناس" "$(code_of "$R")"

echo "===== وام‌ها ====="
RL=$(api POST /api/bank/loans "{\"memberId\":\"$AID\",\"principal\":600000,\"interestAmount\":60000,\"interestMode\":\"beginning\",\"installmentCount\":3,\"firstDue\":\"1405/10/01\",\"scheduleMode\":\"monthly\",\"note\":\"وام تست ۳ قسطی\"}")
LID=$(jf "$RL" "d['id']")
[ "$(code_of "$RL")" = "201" ] && ok "loan ثبت 201" || bad "loan ثبت" "$(code_of "$RL")"
[ "$(jf "$RL" "d['totalAmount']")" = "600000" ] && ok "جمع وام=600000 (کسر سود از ابتدا → جمع=اصل)" || bad "جمع وام" "$(jf "$RL" "d['totalAmount']")"
[ "$(jf "$RL" "d['disbursedAmount']")" = "540000" ] && ok "پرداختی وام=540000 (اصل − سود)" || bad "پرداختی وام" "$(jf "$RL" "d['disbursedAmount']")"
[ "$(jf "$RL" "len(d['schedule'])")" = "3" ] && ok "جدول اقساط ۳ قسط" || bad "جدول اقساط" "$(jf "$RL" "len(d['schedule'])")"
[ "$(jf "$RL" "d['schedule'][0]['amount']")" = "200000" ] && ok "هر قسط=200000 (اصل ÷ ۳)" || bad "هر قسط" "$(jf "$RL" "d['schedule'][0]['amount']")"
P1=$(api POST /api/bank/loans/$LID/payments '{"amount":200000,"paidAt":"2026-11-24T10:00:00.000Z","note":"قسط اول کامل"}')
P1ID=$(jf "$P1" "d['payment']['id']")
[ "$(code_of "$P1")" = "200" ] && ok "پرداخت قسط اول 200" || bad "پرداخت قسط اول" "$(code_of "$P1")"
P2=$(api POST /api/bank/loans/$LID/payments '{"amount":100000,"paidAt":"2026-11-24T11:00:00.000Z"}')
P2ID=$(jf "$P2" "d['payment']['id']")
[ "$(code_of "$P2")" = "200" ] && ok "پرداخت دوم 200" || bad "پرداخت دوم" "$(code_of "$P2")"
R=$(api DELETE "/api/bank/loans/$LID/payments?paymentId=$P2ID")
[ "$(code_of "$R")" = "200" ] && ok "پرداخت DELETE 200" || bad "پرداخت DELETE" "$(code_of "$R")"
R=$(api GET /api/bank/loans)
[ "$(jf "$R" "sum(p['amount'] for p in d[0]['payments'])")" = "200000" ] && ok "جمع پرداخت‌ها=200000" || bad "جمع پرداخت‌ها" "$(jf "$R" "sum(p['amount'] for p in d[0]['payments'])")"
R=$(api PATCH /api/bank/loans/$LID '{"note":"وام تست ویرایش شد"}')
[ "$(code_of "$R")" = "200" ] && ok "loan PATCH 200" || bad "loan PATCH" "$(code_of "$R")"
R=$(api POST /api/bank/loans/$LID/payments '{"amount":-5,"paidAt":"2026-11-24T10:00:00.000Z"}')
[ "$(code_of "$R")" = "400" ] && ok "پرداخت منفی → 400" || bad "پرداخت منفی" "$(code_of "$R")"
R=$(api POST /api/bank/loans '{"principal":100,"interestAmount":0,"interestMode":"beginning","installmentCount":1,"firstDue":"1405/10/01","scheduleMode":"monthly"}')
[ "$(code_of "$R")" = "400" ] && ok "loan بدون عضو → 400" || bad "loan بدون عضو" "$(code_of "$R")"

echo "===== تسویه ====="
R=$(api POST /api/bank/members/$BID/settlement '{"claim":300000,"debt":0}')
[ "$(code_of "$R")" = "200" ] && ok "تسویه B ثبت 200" || bad "تسویه B" "$(code_of "$R")"
[ "$(jf "$R" "d['settlementNet']")" = "300000" ] && ok "خالص تسویه B=+300000" || bad "خالص B" "$(jf "$R" "d['settlementNet']")"
R=$(api DELETE /api/bank/members/$BID/settlement)
[ "$(code_of "$R")" = "200" ] && ok "لغو تسویه B 200" || bad "لغو تسویه B" "$(code_of "$R")"
R=$(api POST /api/bank/members/$BID/settlement '{"claim":300000,"debt":0}')
[ "$(code_of "$R")" = "200" ] && [ "$(jf "$R" "d['settled']")" = "True" ] && ok "تسویه مجدد B" || bad "تسویه مجدد B" "$(code_of "$R")"
R=$(api POST /api/bank/members/$AID/settlement '{"claim":1200000,"debt":400000}')
[ "$(code_of "$R")" = "200" ] && ok "تسویه A ثبت 200" || bad "تسویه A" "$(code_of "$R")"
[ "$(jf "$R" "d['settlementNet']")" = "800000" ] && ok "خالص تسویه A=+800000 (اعتبار−مانده وام)" || bad "خالص A" "$(jf "$R" "d['settlementNet']")"
R=$(api POST /api/bank/members/$AID/settlement '{"claim":-1,"debt":0}')
[ "$(code_of "$R")" = "400" ] && ok "تسویه طلب منفی → 400" || bad "تسویه طلب منفی" "$(code_of "$R")"

echo "===== سوابق و پشتیبان ====="
R=$(api GET /api/bank/audit)
[ "$(code_of "$R")" = "200" ] && ok "audit GET 200" || bad "audit GET" "$(code_of "$R")"
CNT=$(jf "$R" "len(d)")
[ "$CNT" -ge 12 ] 2>/dev/null && ok "تعداد سوابق≥12 (فعلی: $CNT)" || bad "تعداد سوابق" "$CNT"
HAS=$(jf "$R" "any('بازیابی پشتیبان' in x['action'] or 'تسویه' in x['action'] for x in d)")
[ "$HAS" = "True" ] && ok "سابقه تسویه/بازیابی موجود" || bad "سابقه تسویه/بازیابی" "$HAS"
curl -s -b /tmp/jar-reg.txt "$BASE/api/bank/backup" -o /tmp/smoke-backup.json
python3 -c "import json; b=json.load(open('/tmp/smoke-backup.json')); assert len(b['members'])==2 and len(b['loans'])==1" && ok "backup GET محتوای درست" || bad "backup GET" "محتوا"
R=$(api POST /api/bank/backup @/tmp/smoke-backup.json)
[ "$(code_of "$R")" = "200" ] && ok "backup POST بازیابی 200" || bad "backup POST" "$(code_of "$R")"

echo
echo "===== نتیجه ====="
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && echo "ALL GREEN ✅" || echo "خطاها باید رفع شوند ❌"
# پاک‌سازی به‌صورت جداگانه انجام می‌شود: بازیابی پشتیبان خالی (backup-empty.json)
# پس از تست تطبیق محاسبات (bank-calc-check.mjs) و مرور مرورگر.
exit $FAIL
