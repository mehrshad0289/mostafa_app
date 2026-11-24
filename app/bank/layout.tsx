import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "فم بانک",
  description: "مدیریت فم بانک: اعضا، واریزی‌ها و وام‌ها",
};

export default function BankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
