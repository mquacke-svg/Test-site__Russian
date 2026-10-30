"use client";
import { useState } from "react";
import Image from "next/image";
import { Plus, ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { money } from "@/lib/types";
import { useShop } from "./ShopProvider";
import Modal from "./Modal";
export default function ProductCard({
  product: p,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [variantId, setVariantId] = useState(p.variants[0]?.id || "");
  const { mutate, busy, toast } = useShop();
  const selected = p.variants.find((v) => v.id === variantId);
  const price = p.variants.length
    ? Math.min(...p.variants.map((v) => v.price))
    : p.price;
  const add = async () => {
    if (
      await mutate({
        action: "add",
        productId: p.id,
        variantId: p.variants.length ? selected?.id : undefined,
        quantity: 1,
      })
    ) {
      toast(`${p.name} — в корзине`);
      setOpen(false);
    }
  };
  return (
    <>
      <article className="product-card">
        <button
          className="product-photo"
          onClick={() => setOpen(true)}
          aria-label={`Подробнее: ${p.name}`}
        >
          {p.image ? (
            <Image
              src={p.image}
              alt=""
              fill
              priority={priority}
              sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 300px"
              className="object-cover"
            />
          ) : (
            <span className="product-placeholder">ЖА</span>
          )}
          {p.isBestseller && (
            <span className="product-badge">Наш любимчик</span>
          )}
          {(!p.available || p.stock === 0) && (
            <span className="product-badge">Скоро вернётся</span>
          )}
          <span className="photo-arrow">
            <ArrowUpRight size={17} />
          </span>
        </button>
        <div className="product-info">
          <button className="product-name" onClick={() => setOpen(true)}>
            {p.name}
          </button>
          {(p.variants.length > 0 || p.isSeasonal) && (
            <p>
              {p.variants.length
                ? p.variants.map((v) => v.label).join(" / ")
                : "Сезонная выпечка"}
            </p>
          )}
          {p.stock !== null && <p>{p.stock > 0 ? `В наличии: ${p.stock} шт.` : "Нет в наличии"}</p>}
          <div className="product-bottom">
            <strong>
              {price === null
                ? "Цена уточняется"
                : `${p.variants.length > 1 ? "от " : ""}${money(price)}`}
            </strong>
            <button
              className="add-button"
              disabled={busy || !p.available || p.stock === 0 || price === null}
              aria-label={`Добавить в корзину: ${p.name}`}
              onClick={() => (p.variants.length ? setOpen(true) : void add())}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </article>
      <Modal open={open} onClose={() => setOpen(false)} title={p.name}>
        <div className="product-detail">
          {p.image && (
            <div className="detail-photo">
              <Image
                src={p.image}
                alt={p.name}
                fill
                sizes="(max-width: 640px) 90vw, 480px"
                className="object-cover"
              />
            </div>
          )}
          <p>{p.description || "Свежая выпечка из нашей пекарни."}</p>
          {p.stock !== null && <p>{p.stock > 0 ? `В наличии: ${p.stock} шт.` : "Нет в наличии"}</p>}
          {p.variants.length > 0 && (
            <fieldset className="variant-picker">
              <legend>Выберите объём</legend>
              {p.variants.map((v) => (
                <label
                  key={v.id}
                  className={variantId === v.id ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name={`variant-${p.id}`}
                    value={v.id}
                    checked={variantId === v.id}
                    onChange={() => setVariantId(v.id)}
                  />
                  {v.label} · {money(v.price)}
                </label>
              ))}
            </fieldset>
          )}
          <button
            className="button full-width"
            disabled={busy || !p.available || p.stock === 0 || price === null}
            onClick={() => void add()}
          >
            {!p.available || p.stock === 0
              ? "Сейчас недоступен"
              : price === null
                ? "Цена уточняется"
                : `В корзину · ${money(selected?.price ?? price)}`}
          </button>
          <p className="fine-print">
            Фотография иллюстрирует товар. Цены тестовые.
          </p>
        </div>
      </Modal>
    </>
  );
}
