import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "بانک حقیقی",
  description: "مدیریت صندوق قرض‌الحسنه: اعضا، واریزی‌ها و وام‌ها",
};

export default function BankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
