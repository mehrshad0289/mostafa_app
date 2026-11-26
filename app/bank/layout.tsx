import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "فَم بانک",
  description: "مدیریت فَم بانک: اعضا، تراکنش‌ها و وام‌ها",
};

export default function BankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
