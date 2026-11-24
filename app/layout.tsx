import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

/* فونت فارسی وزیرمتن — ظاهر اپ‌های بانکی ایرانی */
const vazirmatn = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mostafa App",
  description: "یادداشت‌ها و فم بانک",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
