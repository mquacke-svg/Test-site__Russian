"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MapPin, Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useShop } from "./ShopProvider";
export default function Header() {
  const { cart, openCart } = useShop();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <>
      <div className="demo-bar">
        Локальная тестовая версия <span>·</span> Заказы не передаются в пекарню
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="Жак-Андрэ — главная">
            <Image src="/logo-mark.svg" alt="" width={50} height={50} />
            <span>
              Жак-Андрэ<small>ФРАНЦУЗСКАЯ ПЕКАРНЯ</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Основная навигация">
            <Link className={pathname === "/menu" ? "active" : ""} href="/menu">
              Наше меню
            </Link>
            <Link href="/#about">О пекарне</Link>
            <Link href="/#delivery">Доставка</Link>
            <Link href="/#locations">Адреса</Link>
          </nav>
          <div className="header-actions">
            <span className="header-city">
              <MapPin size={15} /> Краснодар
            </span>
            <Link
              href="/account"
              className="icon-button"
              aria-label="Личный кабинет"
            >
              <UserRound size={21} />
            </Link>
            <button
              className="cart-button"
              onClick={openCart}
              aria-label={`Корзина, товаров: ${cart.count}`}
            >
              <ShoppingBag size={19} />
              <span className="cart-label">Корзина</span>
              <span className="cart-count">{cart.count}</span>
            </button>
            <button
              className="icon-button mobile-toggle"
              aria-label={open ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <nav
          id="mobile-navigation"
          className="mobile-navigation"
          aria-label="Мобильная навигация"
          hidden={!open}
        >
          {[
            ["/menu", "Наше меню"],
            ["/#about", "О пекарне"],
            ["/#delivery", "Доставка"],
            ["/#locations", "Адреса"],
          ].map(([href, text]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {text}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
