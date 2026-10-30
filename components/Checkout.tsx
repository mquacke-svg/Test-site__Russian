"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Truck, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import {
  money,
  type Cart,
  type DeliverySettings,
  type Location,
  type Order,
} from "@/lib/types";
import { useShop } from "./ShopProvider";
type Quote = Cart & {
  delivery: number;
  total: number;
  fingerprint: string;
  settings: DeliverySettings;
};
export default function Checkout({
  locations,
  settings: initialSettings,
}: {
  locations: Location[];
  settings: DeliverySettings;
}) {
  const { cart, loading, refresh } = useShop();
  const router = useRouter();
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [current, setCurrent] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [done, setDone] = useState(false);
  const key = useRef("");
  const settings = current?.settings || initialSettings;
  useEffect(() => {
    key.current =
      sessionStorage.getItem("bakery_checkout_key") || crypto.randomUUID();
    sessionStorage.setItem("bakery_checkout_key", key.current);
    void api<Order | null>(`order-attempt?key=${key.current}`)
      .then((prior) => {
        if (prior) {
          sessionStorage.removeItem("bakery_checkout_key");
          router.replace(`/orders/${prior.id}`);
        }
      })
      .catch(() => {});
  }, [router]);
  useEffect(() => {
    let live = true;
    setCurrent(null);
    if (!cart.count) return;
    setQuoteBusy(true);
    api<Quote>("quote", { fulfillment })
      .then((q) => {
        if (live) {
          setCurrent(q);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setQuoteBusy(false);
      });
    return () => {
      live = false;
    };
  }, [cart, fulfillment]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!current || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const order = await api<Order>("orders", {
        name: form.get("name"),
        phone: form.get("phone"),
        fulfillment,
        locationId: form.get("locationId") || undefined,
        address: form.get("address") || undefined,
        comment: form.get("comment") || "",
        consent: form.get("consent") === "on",
        fingerprint: current.fingerprint,
        idempotencyKey: key.current,
      });
      setDone(true);
      sessionStorage.removeItem("bakery_checkout_key");
      await refresh();
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.code === "ATTEMPT_OWNER_CHANGED") {
        key.current = crypto.randomUUID();
        sessionStorage.setItem("bakery_checkout_key", key.current);
      }
      if (e instanceof ApiError && e.code === "PRICE_CHANGED") {
        try {
          setCurrent(await api<Quote>("quote", { fulfillment }));
        } catch {
          setCurrent(null);
        }
      }
    } finally {
      setBusy(false);
    }
  };
  if (loading || done)
    return (
      <p className="muted">
        {done ? "Открываем ваш заказ…" : "Загружаем корзину…"}
      </p>
    );
  if (!cart.count)
    return (
      <div className="empty-state">
        <h2>Сначала выберем что-нибудь вкусное</h2>
        <p>Добавьте товары в корзину, чтобы оформить заказ.</p>
        <Link href="/menu" className="button">
          Перейти в меню
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="cart-layout">
      <div className="form-card">
        <h2>Как вам удобнее?</h2>
        <div className="choice-row">
          <label>
            <input
              type="radio"
              name="fulfillment"
              checked={fulfillment === "pickup"}
              onChange={() => setFulfillment("pickup")}
            />
            <Store size={18} /> Самовывоз
          </label>
          <label>
            <input
              type="radio"
              name="fulfillment"
              checked={fulfillment === "delivery"}
              onChange={() => setFulfillment("delivery")}
            />
            <Truck size={18} /> Доставка
          </label>
        </div>
        {fulfillment === "pickup" ? (
          <label className="form-field">
            Ваша пекарня
            <select name="locationId" required>
              {locations.map((l) => (
                <option value={l.id} key={l.id}>
                  {l.address}
                </option>
              ))}
            </select>
            <span className="fine-print">
              Ежедневно 08:00–21:00. Точное время подтвердит сотрудник. Вне
              рабочих часов — к ближайшему открытию.
            </span>
          </label>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 15 }}>
              Доставляем по городу {settings.city}. От {money(settings.minimum)}
              , бесплатно от {money(settings.freeFrom)}.
            </p>
            <label className="form-field">
              Адрес в городе {settings.city}
              <textarea
                name="address"
                required
                minLength={8}
                maxLength={400}
                placeholder="Улица, дом, квартира, подъезд"
                rows={3}
                autoComplete="street-address"
              />
            </label>
            <p className="fine-print" style={{ marginBottom: 24 }}>
              Возможность доставки по адресу и время согласует сотрудник.
            </p>
          </>
        )}
        <h2>Ваши контакты</h2>
        <div className="form-grid">
          <label className="form-field">
            Имя
            <input
              name="name"
              autoComplete="given-name"
              minLength={2}
              maxLength={100}
              required
              placeholder="Как к вам обращаться"
            />
          </label>
          <label className="form-field">
            Телефон
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="+7 (___) ___-__-__"
              maxLength={25}
            />
          </label>
        </div>
        <label className="form-field">
          Комментарий к заказу
          <textarea
            name="comment"
            maxLength={1000}
            rows={3}
            placeholder="Пожелания, которые нам важно знать"
          />
        </label>
        <p className="fine-print">
          Можно заказать без регистрации.{" "}
          <Link href="/login" className="text-link">
            Войти
          </Link>{" "}
          — чтобы сохранять заказы в личном кабинете.
        </p>
      </div>
      <aside className="cart-summary">
        <h2 style={{ fontSize: 27 }}>Ваш вкусный заказ</h2>
        <div className="summary-items">
          {(current?.items || cart.items).map((i) => (
            <div className="summary-item" key={i.id}>
              <span>
                {i.name}
                {i.variantLabel ? `, ${i.variantLabel}` : ""} × {i.quantity}
              </span>
              <strong>{money((i.price || 0) * i.quantity)}</strong>
            </div>
          ))}
        </div>
        <div className="summary-item">
          <span>Получение</span>
          <strong>
            {current
              ? current.delivery
                ? money(current.delivery)
                : "Бесплатно"
              : quoteBusy
                ? "Рассчитываем"
                : "Не рассчитано"}
          </strong>
        </div>
        <div className="total-row" style={{ marginTop: 22 }}>
          <span>Итого</span>
          <strong>{current ? money(current.total) : "—"}</strong>
        </div>
        <p>
          <ShieldCheck
            size={16}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 7,
            }}
          />{" "}
          Оплата при получении
        </p>
        <label className="checkbox-row">
          <input type="checkbox" name="consent" required />
          <span>
            Ознакомлен(а) с <Link href="/terms">условиями заказа</Link> и{" "}
            <Link href="/privacy">обработкой данных</Link>. Это тестовый заказ.
          </span>
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button
          className="button full-width"
          disabled={busy || quoteBusy || !current}
          type="submit"
        >
          {busy ? "Сохраняем заказ…" : "Оформить тестовый заказ"} <span>→</span>
        </button>
        <p className="fine-print">
          После оформления заказ появится в админке со статусом «Ожидает
          подтверждения».
        </p>
      </aside>
    </form>
  );
}
