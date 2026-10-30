import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link href="/" className="footer-brand">
            <Image src="/logo-mark-light.svg" alt="" width={58} height={58} />
            <span>Жак-Андрэ</span>
          </Link>
          <p>
            Маленькие радости.
            <br />
            Большая любовь к выпечке.
          </p>
        </div>
        <div>
          <h3>Загляните к нам</h3>
          <Link href="/menu">
            Наше меню <ArrowUpRight size={14} />
          </Link>
          <Link href="/#about">История пекарни</Link>
          <Link href="/#locations">Адреса и часы работы</Link>
        </div>
        <div>
          <h3>С заботой о вас</h3>
          <Link href="/#delivery">Доставка и самовывоз</Link>
          <Link href="/account">Личный кабинет</Link>
          <Link href="/terms">Условия заказа</Link>
        </div>
        <div>
          <h3>Будем на связи</h3>
          <a href="tel:+79183395390">+7 (918) 339-53-90</a>
          <a href="mailto:info@jacques-andre.ru">info@jacques-andre.ru</a>
          <p>Краснодар · Ежедневно 08:00–21:00</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Жак-Андрэ · Тестовый сайт</span>
        <div>
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/admin">Для сотрудников</Link>
        </div>
      </div>
    </footer>
  );
}
