"use client";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useShop } from "./ShopProvider";
import { money } from "@/lib/types";
export default function CartContents({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { cart, loading, busy, mutate, closeCart, error, refresh } = useShop();
  if (loading) return <p className="muted">Загружаем корзину…</p>;
  if (!cart.items.length)
    return (
      <div className="empty-state">
        <ShoppingBag size={46} strokeWidth={1} />
        <h3>Здесь пока тихо</h3>
        <p>Добавьте что-нибудь свежее к вашему дню.</p>
        {error && (
          <p role="alert">
            {error} <button onClick={() => void refresh()}>Повторить</button>
          </p>
        )}
        <Link className="button" href="/menu" onClick={closeCart}>
          Выбрать выпечку
        </Link>
      </div>
    );
  return (
    <div className={compact ? "" : "cart-layout"}>
      <div>
        <div className="cart-toolbar">
          <span>{cart.count} шт.</span>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void mutate({ action: "clear" })}
          >
            Очистить корзину
          </button>
        </div>
        <ul className="cart-list">
          {cart.items.map((item) => (
            <li key={item.id} className="cart-line">
              {item.image && (
                <Image
                  src={item.image}
                  alt=""
                  width={90}
                  height={90}
                  className="cart-image"
                />
              )}
              <div className="cart-line-info">
                <strong>{item.name}</strong>
                {item.variantLabel && (
                  <span className="muted">{item.variantLabel}</span>
                )}
                <span>
                  {item.available ? money(item.price!) : "Сейчас недоступен"}
                </span>
                {item.stock !== null && <span className="muted">В наличии: {item.stock} шт. для всех объёмов</span>}
                <div className="quantity">
                  <button
                    disabled={busy}
                    aria-label={`Уменьшить количество: ${item.name}${item.variantLabel ? `, ${item.variantLabel}` : ""}`}
                    onClick={() =>
                      void mutate({
                        action: "update",
                        itemId: item.id,
                        quantity: item.quantity - 1,
                      })
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button
                    disabled={busy || item.quantity >= 99}
                    aria-label={`Увеличить количество: ${item.name}${item.variantLabel ? `, ${item.variantLabel}` : ""}`}
                    onClick={() =>
                      void mutate({
                        action: "update",
                        itemId: item.id,
                        quantity: item.quantity + 1,
                      })
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="cart-line-end">
                <strong>{money((item.price || 0) * item.quantity)}</strong>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={`Удалить: ${item.name}${item.variantLabel ? `, ${item.variantLabel}` : ""}`}
                  onClick={() =>
                    void mutate({ action: "remove", itemId: item.id })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="cart-summary">
        <div className="total-row">
          <span>Товары</span>
          <strong>{money(cart.subtotal)}</strong>
        </div>
        <p className="muted">
          Самовывоз бесплатно. Стоимость доставки рассчитаем при оформлении.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Link
          href="/checkout"
          className="button full-width"
          onClick={closeCart}
        >
          К оформлению <span>→</span>
        </Link>
        {compact && (
          <Link
            href="/cart"
            className="text-button centered"
            onClick={closeCart}
          >
            Открыть корзину
          </Link>
        )}
        <p className="fine-print">Оплата при получении · Тестовый заказ</p>
      </div>
    </div>
  );
}
