import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Croissant,
  Coffee,
  CakeSlice,
  Sandwich,
  CookingPot,
  Cherry,
  Wheat,
  Leaf,
  Heart,
  Clock3,
  MapPin,
  Truck,
  Store,
} from "lucide-react";
import { getCatalog } from "@/lib/shop";
import { money } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import { Wave, Flower } from "@/components/Decor";
export const dynamic = "force-dynamic";
const icons = [
  Croissant,
  CakeSlice,
  CakeSlice,
  Sandwich,
  CookingPot,
  Cherry,
  Coffee,
  Leaf,
];
export default function HomePage() {
  const { products, categories, locations, settings } = getCatalog();
  const featured = products
    .filter((p) => p.isBestseller && p.available)
    .slice(0, 4);
  const picks = [
    {
      title: "Слоёное счастье",
      text: "Хрустящая корочка. Нежное сердце.",
      image: "/products/croissant-2.webp",
      href: "/menu#pastry",
      color: "sage",
    },
    {
      title: "Для сладких моментов",
      text: "Десерты, ради которых стоит замедлиться.",
      image: "/products/cake-strawberry.webp",
      href: "/menu#desserts",
      color: "peach",
    },
    {
      title: "Пауза на кофе",
      text: "Ваш любимый ритуал — каждый день.",
      image: "/products/coffee-heart-latte.webp",
      href: "/menu#coffee",
      color: "yellow",
    },
  ];
  return (
    <>
      <section className="hero-section">
        <div className="hero-grain" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-line" /> БОНЖУР, КРАСНОДАР!
            </span>
            <h1>
              Маленькие радости.
              <br />
              <em>Каждый день.</em>
            </h1>
            <p>
              Аромат свежего хлеба, хруст тёплого круассана
              <br className="desktop-break" /> и время для себя. Добро
              пожаловать в «Жак-Андрэ».
            </p>
            <div className="hero-buttons">
              <Link href="/menu" className="button button-peach">
                Выбрать что-то вкусное <ArrowRight size={19} />
              </Link>
              <Link href="#about" className="hero-story">
                Наша история <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="hero-footnote">
              <span className="round-mark">
                <Wheat size={24} strokeWidth={1.3} />
              </span>
              <span>
                Печём с любовью с 2014 года
                <br />
                <strong>Свежая выпечка каждое утро</strong>
              </span>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-circle" />
            <Image
              src="/images/bakery-hero.png"
              alt="Композиция из золотистых круассанов, ягодной тарталетки и фисташкового эклера"
              width={1536}
              height={1024}
              priority
              sizes="(max-width: 760px) 100vw, 58vw"
            />
            <div className="hero-stamp">
              СЧАСТЬЕ
              <br />
              <Heart size={22} strokeWidth={1.4} />
              <span>в каждом кусочке</span>
            </div>
            <span className="hero-caption">L’art de la gourmandise</span>
          </div>
          <Flower className="flower-hero" />
        </div>
        <Wave />
      </section>
      <section className="benefits-strip container">
        <span>
          <Wheat /> Натуральные ингредиенты
        </span>
        <span>
          <Heart /> Французские рецепты
        </span>
        <span>
          <Clock3 /> Свежее каждый день
        </span>
        <span>
          <MapPin /> 4 пекарни рядом
        </span>
      </section>
      <section className="section container">
        <div className="section-heading centered">
          <span className="eyebrow">
            МАЛЕНЬКОЕ УДОВОЛЬСТВИЕ — БОЛЬШАЯ РАДОСТЬ
          </span>
          <h2>С чего начнётся ваш день?</h2>
          <p>У каждого настроения есть свой вкус. Найдите ваш.</p>
        </div>
        <div className="editorial-grid">
          {picks.map((p, i) => (
            <Link
              key={p.title}
              href={p.href}
              className={`editorial-card ${p.color}`}
            >
              <span className="editorial-number">0{i + 1}</span>
              <div className="editorial-image">
                <Image
                  src={p.image}
                  alt=""
                  fill
                  sizes="(max-width: 760px) 90vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="editorial-text">
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <span className="pill-link">
                  Попробовать <ArrowUpRight size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="section bestsellers-section">
        <div className="container">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">ПРОВЕРЕНО ЛЮБОВЬЮ</span>
              <h2>За ними возвращаются</h2>
            </div>
            <Link href="/menu" className="text-link">
              Всё меню <ArrowRight size={18} />
            </Link>
          </div>
          <div className="category-links">
            {categories.map((c, i) => {
              const Icon = icons[i] || Croissant;
              return (
                <Link href={`/menu#${c.id}`} key={c.id}>
                  <Icon size={20} strokeWidth={1.3} />
                  {c.name}
                </Link>
              );
            })}
          </div>
          <div className="product-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>
      <section id="about" className="about-section">
        <Wave top />
        <div className="container about-grid">
          <div className="about-photo">
            <Image
              src="/bakery-1.webp"
              alt="Витрина со свежей выпечкой в пекарне Жак-Андрэ"
              fill
              sizes="(max-width: 760px) 90vw, 45vw"
              className="object-cover"
            />
            <span className="photo-note">Всё начинается с любви.</span>
          </div>
          <div className="about-copy">
            <span className="eyebrow">НЕ ПРОСТО ПЕКАРНЯ</span>
            <h2>
              Французская душа.
              <br />
              <em>Краснодарское сердце.</em>
            </h2>
            <p>
              Мы верим: для счастья не всегда нужен большой повод. Иногда
              достаточно тёплого круассана, хорошего кофе и улыбки за прилавком.
            </p>
            <p>
              С 2014 года мы печём хлеб, готовим нежные десерты и встречаем вас
              в наших пекарнях. Вкладываем заботу в каждую деталь — от первого
              замеса до последней крошки.
            </p>
            <Link href="#locations" className="text-link">
              Загляните в гости <ArrowUpRight size={18} />
            </Link>
            <div className="signature">С любовью, Жак-Андрэ</div>
          </div>
          <Flower className="flower-about" />
        </div>
        <Wave />
      </section>
      <section id="delivery" className="section container">
        <div className="section-heading centered">
          <span className="eyebrow">МЫ ПОЗАБОТИЛИСЬ ОБО ВСЁМ</span>
          <h2>Радость ближе, чем кажется</h2>
        </div>
        <div className="delivery-grid">
          <div className="delivery-card">
            <Store size={34} strokeWidth={1.2} />
            <h3>Заберите по пути</h3>
            <p>
              Выберите удобную пекарню. Мы подготовим заказ и согласуем время
              получения.
            </p>
            <strong>Самовывоз — бесплатно</strong>
            <Link href="#locations" className="text-link">
              Найти пекарню <ArrowRight size={17} />
            </Link>
          </div>
          <div className="delivery-card peach">
            <Truck size={34} strokeWidth={1.2} />
            <h3>Привезём к вашему столу</h3>
            <p>
              Доставка по{" "}
              {settings.city === "Краснодар" ? "Краснодару" : settings.city} —{" "}
              {money(settings.fee)}. Минимальная сумма товаров —{" "}
              {money(settings.minimum)}.
            </p>
            <strong>Бесплатно от {money(settings.freeFrom)}</strong>
            <span className="fine-print">
              Адрес и время подтверждает сотрудник. Оплата при получении.
            </span>
          </div>
        </div>
      </section>
      <section id="locations" className="locations-section section">
        <div className="container">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">ВАША ПЕКАРНЯ РЯДОМ</span>
              <h2>Приходите на аромат</h2>
            </div>
            <span className="muted">Краснодар · Каждый день</span>
          </div>
          <div className="locations-grid">
            {locations.map((l, i) => (
              <article key={l.id}>
                <span className="location-number">0{i + 1}</span>
                <MapPin size={23} strokeWidth={1.3} />
                <h3>{l.title}</h3>
                <p>{l.address}</p>
                <p className="muted">{l.hours}</p>
                {l.phone && (
                  <a href={`tel:${l.phoneRaw}`} className="text-link">
                    {l.phone}
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
