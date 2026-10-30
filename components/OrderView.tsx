"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client";
import { money, statusLabels, type Order } from "@/lib/types";
export function OrderCard({
  order,
  detailed = false,
}: {
  order: Order;
  detailed?: boolean;
}) {
  return (
    <article className="order-card">
      <div className="order-top">
        <h3>{order.sequence === null ? order.number : `Заказ №${order.sequence}`}</h3>
        <span className="status-badge">{statusLabels[order.status]}</span>
      </div>
      <div className="order-info">
        <p>
          {new Date(order.createdAt).toLocaleString("ru-RU", {
            timeZone: "Europe/Moscow",
          })}{" "}
          · {order.fulfillment === "pickup" ? "Самовывоз" : "Доставка"}
        </p>
        {detailed && (
          <>
            <p>{order.locationLabel || order.address}</p>
            <p>
              {order.name} · {order.phone}
            </p>
            {order.comment && <p>Комментарий: {order.comment}</p>}
          </>
        )}
      </div>
      <div className="summary-items">
        {order.items.map((i) => (
          <div className="summary-item" key={i.id}>
            <span>
              {i.name}
              {i.variantLabel ? `, ${i.variantLabel}` : ""} × {i.quantity}
            </span>
            <strong>{money(i.price * i.quantity)}</strong>
          </div>
        ))}
      </div>
      {order.delivery > 0 && (
        <div className="summary-item">
          <span>Доставка</span>
          <span>{money(order.delivery)}</span>
        </div>
      )}
      <div className="total-row">
        <span>Итого</span>
        <strong>{money(order.total)}</strong>
      </div>
      {!detailed && (
        <Link
          href={`/orders/${order.id}`}
          className="text-link"
          style={{ marginTop: 18 }}
        >
          Подробнее →
        </Link>
      )}
    </article>
  );
}
export default function OrderView({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      api<Order>(`orders/${id}`)
        .then((v) => {
          if (live) {
            setOrder(v);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    void load();
    const timer = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id]);
  return (
    <div className="container page-section" style={{ maxWidth: 760 }}>
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : order ? (
        <>
          <div className="section-heading centered">
            <CheckCircle2
              size={42}
              strokeWidth={1.3}
              style={{ margin: "0 auto 18px" }}
            />
            <span className="eyebrow">ТЕСТОВЫЙ ЗАКАЗ СОХРАНЁН</span>
            <h1 style={{ fontSize: 40, marginTop: 15 }}>
              Спасибо за ваш выбор!
            </h1>
            <p style={{ marginTop: 18 }}>
              Статус заказа обновляется автоматически. Оплата при получении.
            </p>
          </div>
          <OrderCard order={order} detailed />
          <p className="fine-print">
            Гостевой заказ доступен в этом браузере, пока сохранены технические
            cookies. Для истории заказов{" "}
            <Link href="/account" className="text-link">
              войдите в кабинет
            </Link>
            .
          </p>
          <Link href="/menu" className="button" style={{ marginTop: 25 }}>
            Ещё немного вкусного
          </Link>
        </>
      ) : (
        <p>Загружаем заказ…</p>
      )}
    </div>
  );
}
