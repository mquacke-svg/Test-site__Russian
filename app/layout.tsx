import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShopProvider from "@/components/ShopProvider";
import "./globals.css";
const playfair = localFont({
  src: "../public/fonts/PlayfairDisplay-Variable.ttf",
  variable: "--font-playfair",
  weight: "400 900",
  display: "swap",
});
const inter = localFont({
  src: "../public/fonts/Inter-Variable.ttf",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "Жак-Андрэ — маленькие радости каждый день",
    template: "%s · Жак-Андрэ",
  },
  description:
    "Французская пекарня в Краснодаре. Круассаны, десерты и кофе. Тестовый интернет-магазин с доставкой и самовывозом.",
  robots: { index: false, follow: false },
  icons: { icon: "/logo-mark.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${playfair.variable} ${inter.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Перейти к содержимому
        </a>
        <ShopProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </ShopProvider>
      </body>
    </html>
  );
}
