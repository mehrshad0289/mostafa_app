#!/usr/bin/env bash
# تست کامل سیستم احراز هویت — سناریوی پذیرش:
# ثبت‌نام → رد ورود غیرفعال → فعال‌سازی ادمین → ورود → غیرفعال‌سازی/بستن ورود با رمز
# → باطل شدن فوری نشست → ریست رمز → محافظت‌های ادمین → خروج
# اجرا: bash scripts/test_auth_system.sh  (سرور بیلدشده باید روی پورت 3100 بالا باشد)
set -u
BASE="http://localhost:3100"
PASS=0; FAIL=0
TMP=$(mktemp -d)
ADMIN_JAR="$TMP/admin.jar"
MEMBER_JAR="$TMP/member.jar"
OUT="$TMP/last"

post() { # post <path> <json> [jar]
  local jar="${3:-$TMP/none.jar}"
  curl -s -o "$OUT" -w "%{http_code}" -X POST "$BASE$1" \
    -H "Content-Type: application/json" -b "$jar" -c "$jar" -d "$2"
}
get() { # get <path> <jar>
  curl -s -o "$OUT" -w "%{http_code}" -X GET "$BASE$1" -b "$2" -c "$2"
}
say() { echo "$1"; }
chk_status() { # chk_status <name> <expected> <actual>
  if [ "$3" = "$2" ]; then PASS=$((PASS+1)); say "PASS  $1 ($3)";
  else FAIL=$((FAIL+1)); say "FAIL  $1 — expected $2 got $3"; fi
}
chk_contains() { # chk_contains <name> <needle> <file>
  if grep -q "$2" "$3"; then PASS=$((PASS+1)); say "PASS  $1";
  else FAIL=$((FAIL+1)); say "FAIL  $1 — «$2» not found in: $(head -c 300 "$3")"; fi
}
uid_of() { # uid_of <username> — از فهرست کاربران ادمین
  python3 -c "
import json,sys
d=json.load(open('$OUT'))
u=[x for x in d['users'] if x['username']=='$1']
print(u[0]['id'] if u else '')"
}

# ---------- آماده‌سازی: صبر برای بالا آمدن سرور ----------
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/login" || echo 000) && [ "$code" = "200" ] && break
  sleep 1
done

say "== 1) ثبت‌نام =="
code=$(post /api/auth/register '{"username":"testuser1","password":"Test@123","fullName":"کاربر تست","phone":"09120000000"}')
chk_status "register → 201" 201 "$code"
chk_contains "register پیام موفقیت" "ثبت‌نام انجام شد" "$OUT"
code=$(post /api/auth/register '{"username":"testuser1","password":"Test@123"}')
chk_status "register تکراری → 400" 400 "$code"
chk_contains "پیام نام تکراری" "قبلاً ثبت شده است" "$OUT"
code=$(post /api/auth/register '{"username":"ab","password":"Test@123"}')
chk_status "نام کاربری کوتاه → 400" 400 "$code"
code=$(post /api/auth/register '{"username":"test-x","password":"123"}')
chk_status "رمز کوتاه → 400" 400 "$code"
code=$(post /api/auth/register '{"username":"bad name!","password":"Test@123"}')
chk_status "نام کاربری با نویسه غیرمجاز → 400" 400 "$code"

say "== 2) ورود حساب غیرفعال رد می‌شود =="
code=$(post /api/auth/login '{"username":"testuser1","password":"Test@123"}')
chk_status "ورود حساب در انتظار تأیید → 403" 403 "$code"
chk_contains "پیام حساب غیرفعال" "حساب شما غیرفعال است. با مدیر تماس بگیرید." "$OUT"

say "== 3) ورود ادمین =="
code=$(post /api/auth/login '{"username":"admin","password":"Admin@12345"}' "$ADMIN_JAR")
chk_status "ورود ادمین → 200" 200 "$code"
code=$(get /api/admin/users "$ADMIN_JAR")
chk_status "لیست کاربران → 200" 200 "$code"
ADMIN_ID=$(uid_of admin)
TEST_ID=$(uid_of testuser1)
say "ADMIN_ID=$ADMIN_ID TEST_ID=$TEST_ID"

say "== 4) فعال‌سازی توسط ادمین و ورود کاربر =="
code=$(post "/api/admin/users/$TEST_ID/activate" '{}' "$ADMIN_JAR")
chk_status "activate → 200" 200 "$code"
chk_contains "پیام فعال‌سازی" "فعال شد" "$OUT"
code=$(post /api/auth/login '{"username":"testuser1","password":"Test@123"}' "$MEMBER_JAR")
chk_status "ورود کاربر فعال → 200" 200 "$code"
code=$(get /api/auth/me "$MEMBER_JAR")
chk_contains "me کاربر فعال" "testuser1" "$OUT"
code=$(post /api/auth/logout '{}' "$MEMBER_JAR")
chk_status "خروج کاربر → 200" 200 "$code"
code=$(get /api/auth/me "$MEMBER_JAR")
chk_contains "بعد از خروج me خالی" '"user":null' "$OUT"

say "== 5) غیرفعال‌سازی حساب: نشست فوراً باطل و ورود رد =="
post /api/auth/login '{"username":"testuser1","password":"Test@123"}' "$MEMBER_JAR" >/dev/null
code=$(post "/api/admin/users/$TEST_ID/deactivate" '{}' "$ADMIN_JAR")
chk_status "deactivate → 200" 200 "$code"
code=$(get /api/auth/me "$MEMBER_JAR")
chk_contains "نشست کاربر غیرفعال‌شده باطل شد" '"user":null' "$OUT"
code=$(post /api/auth/login '{"username":"testuser1","password":"Test@123"}')
chk_status "ورود حساب غیرفعال → 403" 403 "$code"
chk_contains "پیام حساب غیرفعال (دوم)" "حساب شما غیرفعال است. با مدیر تماس بگیرید." "$OUT"
post "/api/admin/users/$TEST_ID/activate" '{}' "$ADMIN_JAR" >/dev/null

say "== 6) بستن «ورود با رمز»: نشست فوراً باطل و ورود رد =="
post /api/auth/login '{"username":"testuser1","password":"Test@123"}' "$MEMBER_JAR" >/dev/null
code=$(get /api/auth/me "$MEMBER_JAR")
chk_contains "کاربر دوباره لاگین است" "testuser1" "$OUT"
code=$(post "/api/admin/users/$TEST_ID/disable-password-login" '{}' "$ADMIN_JAR")
chk_status "disable-password-login → 200" 200 "$code"
code=$(get /api/auth/me "$MEMBER_JAR")
chk_contains "نشست بعد از بستن ورود با رمز باطل شد" '"user":null' "$OUT"
code=$(post /api/auth/login '{"username":"testuser1","password":"Test@123"}')
chk_status "ورود با رمز بسته → 403" 403 "$code"
chk_contains "پیام ورود با رمز غیرفعال" "ورود با رمز عبور برای حساب شما غیرفعال است. با مدیر تماس بگیرید." "$OUT"
code=$(post "/api/admin/users/$TEST_ID/enable-password-login" '{}' "$ADMIN_JAR")
chk_status "enable-password-login → 200" 200 "$code"
code=$(post /api/auth/login '{"username":"testuser1","password":"Test@123"}' "$MEMBER_JAR")
chk_status "ورود بعد از بازکردن ورود با رمز → 200" 200 "$code"

say "== 7) ریست رمز توسط ادمین =="
code=$(post "/api/admin/users/$TEST_ID/reset-password" '{}' "$ADMIN_JAR")
chk_status "reset-password (تولید رمز موقت) → 200" 200 "$code"
TEMP_PW=$(python3 -c "import json;print(json.load(open('$OUT')).get('tempPassword') or '')")
say "TEMP_PW=$TEMP_PW"
if [ -n "$TEMP_PW" ]; then PASS=$((PASS+1)); say "PASS  رمز موقت برگردانده شد"; else FAIL=$((FAIL+1)); say "FAIL  رمز موقت خالی بود"; fi
code=$(post /api/auth/login '{"username":"testuser1","password":"Test@123"}')
chk_status "ورود با رمز قدیم بعد از ریست → 401" 401 "$code"
code=$(get /api/auth/me "$MEMBER_JAR")
chk_contains "نشست کاربر بعد از ریست رمز باطل شد" '"user":null' "$OUT"
code=$(post /api/auth/login "{\"username\":\"testuser1\",\"password\":\"$TEMP_PW\"}" "$MEMBER_JAR")
chk_status "ورود با رمز موقت → 200" 200 "$code"
NEW_PW="NewPass@99"
code=$(post "/api/admin/users/$TEST_ID/reset-password" "{\"password\":\"$NEW_PW\"}" "$ADMIN_JAR")
chk_status "reset-password (رمز مشخص) → 200" 200 "$code"
chk_contains "رمز مشخص در پاسخ برنمی‌گردد" '"tempPassword":null' "$OUT"
code=$(post /api/auth/login "{\"username\":\"testuser1\",\"password\":\"$NEW_PW\"}")
chk_status "ورود با رمز جدید ادمین‌تنظیم → 200" 200 "$code"

say "== 8) محافظت‌های ادمین (خودش و آخرین ادمین) =="
code=$(post "/api/admin/users/$ADMIN_ID/deactivate" '{}' "$ADMIN_JAR")
chk_status "ادمین خودش را غیرفعال کند → 400" 400 "$code"
chk_contains "پیام منع غیرفعال‌سازی خود" "نمی‌توانید حساب خودتان را غیرفعال کنید." "$OUT"
code=$(post "/api/admin/users/$ADMIN_ID/disable-password-login" '{}' "$ADMIN_JAR")
chk_status "ادمین ورود با رمز خودش را ببندد → 400" 400 "$code"
chk_contains "پیام منع بستن ورود با رمز خود" "نمی‌توانید ورود با رمز عبور حساب خودتان را غیرفعال کنید." "$OUT"
code=$(post "/api/admin/users" '{"username":"admin2","password":"Admin2@123","role":"admin"}' "$ADMIN_JAR")
chk_status "ساخت ادمین دوم → 201" 201 "$code"
code=$(get /api/admin/users "$ADMIN_JAR")
ADMIN2_ID=$(uid_of admin2)
code=$(post "/api/admin/users/$ADMIN2_ID/deactivate" '{}' "$ADMIN_JAR")
chk_status "غیرفعال‌سازی ادمین دوم (ادمین فعال دیگر هست) → 200" 200 "$code"
code=$(post "/api/auth/login" '{"username":"admin2","password":"Admin2@123"}')
chk_status "ادمین دوم غیرفعال وارد نمی‌شود → 403" 403 "$code"

say "== 9) گارد دسترسی: کاربر عادی به اندپوینت‌های ادمین =="
post /api/auth/login '{"username":"testuser1","password":"NewPass@99"}' "$MEMBER_JAR" >/dev/null
code=$(get /api/admin/users "$MEMBER_JAR")
chk_status "لیست کاربران با کاربر عادی → 403" 403 "$code"
chk_contains "پیام فقط مدیر" "فقط مدیر دسترسی دارد." "$OUT"
code=$(post "/api/admin/users/$TEST_ID/activate" '{}' "$MEMBER_JAR")
chk_status "activate با کاربر عادی → 403" 403 "$code"

say "== 10) رمز هرگز plain ذخیره نمی‌شود =="
if grep -q "Test@123\|NewPass@99\|Admin2@123" data/db.json; then
  FAIL=$((FAIL+1)); say "FAIL  رمز خام در فایل داده پیدا شد!"
else
  PASS=$((PASS+1)); say "PASS  رمز خام در فایل داده نیست (فقط hash)"
fi

say "== 11) ورود موقت بدون رمز ادمین =="
code=$(post /api/auth/login '{"username":"admin","password":""}' "$ADMIN_JAR")
chk_status "ورود ادمین با رمز خالی → 200" 200 "$code"
chk_contains "نقش ادمین در پاسخ" '"role":"admin"' "$OUT"
code=$(post /api/auth/login '{"username":"admin"}' "$ADMIN_JAR")
chk_status "ورود ادمین بدون فیلد رمز → 200" 200 "$code"
code=$(post /api/auth/login '{"username":"testuser1","password":""}')
chk_status "کاربر عادی با رمز خالی → 400" 400 "$code"
code=$(post /api/auth/login '{"username":"nosuchuser","password":""}')
chk_status "کاربر ناموجود با رمز خالی → 400" 400 "$code"

say "== 12) وضعیت ذخیره‌سازی =="
code=$(get /api/admin/storage-status "$ADMIN_JAR")
chk_status "storage-status با ادمین → 200" 200 "$code"
chk_contains "حالت ذخیره‌سازی در پاسخ هست" '"mode"' "$OUT"
code=$(get /api/admin/storage-status "$MEMBER_JAR")
chk_status "storage-status با کاربر عادی → 403" 403 "$code"

say ""
say "RESULT: PASS=$PASS FAIL=$FAIL"
rm -rf "$TMP"
[ "$FAIL" = "0" ]
