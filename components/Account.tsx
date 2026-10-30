"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { authClient } from "@/lib/auth-client";
import type { Order } from "@/lib/types";
import { OrderCard } from "./OrderView";
export default function Account() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
    if (!session) return;
    const load = () =>
      api<Order[]>("orders")
        .then(setOrders)
        .catch((e) => setError(e.message));
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [session, isPending, router]);
  const claim = async () => {
    try {
      const result = await api<{ count: number }>("orders/claim", {});
      setNotice(
        result.count
          ? `Добавлено заказов: ${result.count}`
          : "В этом браузере нет новых гостевых заказов.",
      );
      setOrders(await api<Order[]>("orders"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (!session) return <p>Открываем кабинет…</p>;
  return (
    <>
      <div className="account-head">
        <div>
          <span className="eyebrow">ВАШ ЛИЧНЫЙ КАБИНЕТ</span>
          <h1 style={{ marginTop: 12 }}>Бонжур, {session.user.name}!</h1>
        </div>
        <button
          className="button button-outline"
          onClick={async () => {
            await authClient.signOut();
            window.location.assign("/");
          }}
        >
          Выйти
        </button>
      </div>
      <div className="form-card" style={{ marginBottom: 30 }}>
        <p>Уже заказывали без регистрации в этом браузере?</p>
        <button
          className="text-link"
          style={{ marginTop: 12 }}
          onClick={() => void claim()}
        >
          Сохранить гостевые заказы в кабинете →
        </button>
      </div>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <h2 style={{ marginBottom: 25 }}>Ваши заказы</h2>
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
      {!orders.length && (
        <div className="empty-state">
          <p>Ваша вкусная история ещё впереди.</p>
          <Link href="/menu" className="button">
            Открыть меню
          </Link>
        </div>
      )}
    </>
  );
}
