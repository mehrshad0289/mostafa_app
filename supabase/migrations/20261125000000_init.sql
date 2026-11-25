-- Mostafa App — مایگریشن اولیه: ساخت جدول‌های Supabase بر اساس مدل داده lib/db.ts
-- اعمال از طریق SQL Editor داشبورد Supabase یا «supabase db push».
--
-- طراحی طبق مأموریت: ساده، فقط فیلدهای ضروری، بدون RLS/Role/Permission،
-- بدون Secret Key (فقط NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY
-- از سمت سرور استفاده می‌شوند).
-- نشست‌ها stateless (امضای HMAC در کوکی) هستند و عمداً جدول ندارند.
-- ستون ord ترتیب آرایه‌های مدل داده را حفظ می‌کند (جدیدترین اول؛ users قدیمی‌ترین اول).
-- تاریخ‌ها به‌صورت متن ISO ذخیره می‌شوند تا رفت‌وبرگشت بیتی دقیق باشد (مطابق فایل JSON قبلی).

create table if not exists public.items (
  id text primary key,
  kind text not null default 'general',
  title text not null default '',
  note text not null default '',
  done boolean not null default false,
  created_at text not null default '',
  ord double precision not null default 0
);

create table if not exists public.users (
  id text primary key,
  username text not null default '',
  password_hash text not null default '',
  salt text not null default '',
  role text not null default 'member',
  full_name text not null default '',
  phone text not null default '',
  member_id text,
  active boolean not null default true,
  password_login_enabled boolean not null default true,
  created_at text not null default '',
  updated_at text not null default '',
  ord double precision not null default 0
);

create table if not exists public.bank_settings (
  id integer primary key,
  amount_per_share double precision not null default 500000,
  deposit_titles jsonb not null default '[]'::jsonb,
  duplicate_warning boolean not null default true
);

create table if not exists public.bank_members (
  id text primary key,
  name text not null default '',
  shares double precision not null default 0,
  phone text not null default '',
  gender text not null default 'male',
  note text not null default '',
  total_deposited double precision not null default 0,
  settled boolean not null default false,
  settled_at text,
  settlement_claim double precision,
  settlement_debt double precision,
  settlement_net double precision,
  created_at text not null default '',
  ord double precision not null default 0
);

create table if not exists public.bank_deposits (
  id text primary key,
  member_id text,
  member_name text not null default '',
  type text not null default 'share',
  title text not null default '',
  amount double precision not null default 0,
  period_key text not null default '',
  created_at text not null default '',
  ord double precision not null default 0
);

create table if not exists public.bank_loans (
  id text primary key,
  member_id text not null default '',
  member_name text not null default '',
  principal double precision not null default 0,
  interest_mode text not null default 'beginning',
  interest_amount double precision not null default 0,
  total_amount double precision not null default 0,
  disbursed_amount double precision not null default 0,
  installment_count integer not null default 0,
  schedule jsonb not null default '[]'::jsonb,
  payments jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  note text not null default '',
  created_at text not null default '',
  ord double precision not null default 0
);

create table if not exists public.bank_audit (
  id text primary key,
  at text not null default '',
  action text not null default '',
  kind text not null default '',
  record_id text not null default '',
  detail text not null default '',
  ord double precision not null default 0
);

create table if not exists public.payment_requests (
  id text primary key,
  kind text not null default 'share',
  member_id text not null default '',
  user_id text not null default '',
  username text not null default '',
  amount double precision not null default 0,
  receipt text not null default '',
  note text not null default '',
  status text not null default 'pending',
  loan_id text,
  installment_number integer,
  created_at text not null default '',
  reviewed_at text,
  review_note text,
  ord double precision not null default 0
);

create table if not exists public.loan_requests (
  id text primary key,
  member_id text not null default '',
  user_id text not null default '',
  username text not null default '',
  amount double precision not null default 0,
  months integer not null default 1,
  reason text not null default '',
  status text not null default 'pending',
  created_at text not null default '',
  reviewed_at text,
  review_note text,
  ord double precision not null default 0
);

-- داده اولیه (معادل data/db.json قبلی): تنظیمات بانک + دو یادداشت نمونه
insert into public.bank_settings (id, amount_per_share, deposit_titles, duplicate_warning)
values (1, 500000, '["سهم ماهانه","سود وام","واریزی سود","واریزی متفرقه"]'::jsonb, true)
on conflict (id) do nothing;

insert into public.items (id, kind, title, note, done, created_at, ord)
values
  ('1', 'general', 'شروع پروژه', 'داده‌ها داخل فایل JSON ذخیره می‌شوند.', false, '2026-11-23T13:00:00.000Z', 2),
  ('2', 'haqiqi', 'نمونه پنل اشخاص حقیقی', 'این یادداشت در بخش Mostafa App حقیقی نمایش داده می‌شود.', false, '2026-11-23T13:10:00.000Z', 1)
on conflict (id) do nothing;
