// تطبیق محاسبات سرور با توابع مرجع lib/bank — استپ ۱۹
// اجرا: سرور روی 3100 → node /home/z/my-project/scripts/bank-calc-check.mjs
// توجه: داده آزمایشی باید با bank-smoke-test.sh ساخته شده باشد (قبل از پاک‌سازی).
import {
  memberClaim,
  memberDebt,
  memberShareDue,
  recalcFund,
  loanPaid,
  loanRemaining,
  loanTotals,
} from "../mostafa_app/lib/bank.ts";

const BASE = "http://localhost:3100";
const get = (p) => fetch(BASE + p).then((r) => r.json());

const [members, deposits, loans, settings] = await Promise.all([
  get("/api/bank/members"),
  get("/api/bank/deposits"),
  get("/api/bank/loans"),
  get("/api/bank/settings"),
]);

const now = new Date();
let fails = 0;
function check(name, actual, expected) {
  const a = Math.round(Number(actual) * 100) / 100;
  const e = Math.round(Number(expected) * 100) / 100;
  if (a === e) {
    console.log(`PASS: ${name} (actual=${a})`);
  } else {
    fails++;
    console.log(`FAIL: ${name} — actual=${a} expected=${e}`);
  }
}

console.log(`داده: ${members.length} عضو، ${deposits.length} واریزی، ${loans.length} وام | مبلغ هر سهم=${settings.amountPerShare}`);

for (const m of members) {
  const due = memberShareDue(m, deposits, settings.amountPerShare, now);
  const claim = memberClaim(deposits, m.id);
  const debt = memberDebt(m, deposits, loans, settings.amountPerShare, now);
  console.log(`— عضو «${m.name}»: اعتبار=${claim} | تعهد ماهانه=${due.monthlyDue} | تعهد پرداخت‌شده=${due.totalSharePaid} | تعهد مانده=${due.left}`);
  check(`اعتبار ${m.name} == memberClaim`, m.totalDeposited ?? 0, claim);
  if (m.settled && m.settlementClaim !== null) {
    check(`تسویه ${m.name}: طلب ثبت‌شده == اعتبار محاسباتی`, m.settlementClaim, claim);
    check(`تسویه ${m.name}: بدهی ثبت‌شده == مانده وام + تعهد مانده`, m.settlementDebt, debt);
    check(`تسویه ${m.name}: خالص == طلب − بدهی`, m.settlementNet, m.settlementClaim - m.settlementDebt);
  }
}

for (const l of loans) {
  const totals = loanTotals(l.principal, l.interestAmount, l.interestMode);
  check(`وام «${l.memberName}»: totalAmount سرور == loanTotals`, l.totalAmount, totals.totalAmount);
  check(`وام «${l.memberName}»: disbursedAmount سرور == loanTotals`, l.disbursedAmount, totals.disbursedAmount);
  check(`وام «${l.memberName}»: مانده سرور ثبت‌شده? (محاسبه) — loanRemaining`, loanRemaining(l), Math.max(0, l.totalAmount - loanPaid(l)));
  const sumSchedule = l.schedule.reduce((s, i) => s + i.amount, 0);
  check(`وام «${l.memberName}»: جمع اقساط == totalAmount`, sumSchedule, l.totalAmount);
}

const fund = recalcFund({ members, deposits, loans });
const expectedBalance =
  deposits.reduce((s, d) => s + d.amount, 0) -
  loans.reduce((s, l) => s + (l.disbursedAmount ?? l.principal ?? 0), 0) +
  loans.reduce((s, l) => s + loanPaid(l), 0);
check("موجودی بانک (recalcFund) == واریزی − پرداختی وام + بازپرداخت", fund.balance, expectedBalance);
check("جمع سهم‌ها", fund.totalShares, members.reduce((s, m) => s + m.shares, 0));

console.log(fails === 0 ? "\nALL GREEN ✅" : `\n${fails} مورد مغایرت ❌`);
process.exit(fails === 0 ? 0 : 1);
