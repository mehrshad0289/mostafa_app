import type { Metadata } from "next";
import { Lalezar, Markazi_Text, Noto_Naskh_Arabic, Vazirmatn } from "next/font/google";
import "./globals.css";

/* فونت فارسی وزیرمتن — ظاهر اپ‌های بانکی ایرانی (پیش‌فرض) */
const vazirmatn = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
  display: "swap",
});

/* فونت‌های جایگزین selectable در بخش تنظیمات ظاهری (جلسه بیست‌ویکم) */
const naskh = Noto_Naskh_Arabic({
  variable: "--font-naskh",
  subsets: ["arabic"],
  display: "swap",
});

const markazi = Markazi_Text({
  variable: "--font-markazi",
  subsets: ["arabic"],
  display: "swap",
});

const lalezar = Lalezar({
  variable: "--font-lalezar",
  subsets: ["arabic"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mostafa App",
  description: "یادداشت‌ها و فَم بانک",
};

/**
 * اعمال تنظیمات ظاهری ذخیره‌شده (تم، فونت، حالت نمایش) قبل از اولین رندر —
 * تا صفحه با تم/فونت درست paint شود و چشمک نزند. تنظیمات در localStorage
 * همین مرورگر ذخیره می‌شود و به سرور فرستاده نمی‌شود.
 */
const APPEARANCE_BOOTSTRAP = `(function(){try{
var a=JSON.parse(localStorage.getItem("mostafa-appearance")||"{}");
var h=document.documentElement;
if(a.theme)h.dataset.theme=String(a.theme);
if(a.font)h.dataset.font=String(a.font);
var m=(a.mode==="dark"||a.mode==="light")?a.mode:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
h.dataset.mode=m;
}catch(e){document.documentElement.dataset.mode="light";}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      data-mode="light"
      suppressHydrationWarning
      className={`${vazirmatn.variable} ${naskh.variable} ${markazi.variable} ${lalezar.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
