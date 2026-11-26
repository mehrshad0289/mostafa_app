import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "فَم بانک",
  description: "اپلیکیشن موبایل فَم بانک — مدیریت بانک خانوادگی",
};

export const viewport: Viewport = {
  themeColor: "#1a46af",
  width: "device-width",
  initialScale: 1,
};

/** پوسته موبایل فَم بانک — فونت/تم از layout ریشه ارث می‌رسد */
export default function MobileLayout({ children }: { children: ReactNode }) {
  return children;
}
