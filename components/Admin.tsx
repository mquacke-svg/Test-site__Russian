"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { Plus, Search, Upload, X } from "lucide-react";
import { api } from "@/lib/client";
import { authClient } from "@/lib/auth-client";
import {
  money,
  statusLabels,
  type Category,
  type DeliverySettings,
  type Order,
  type Product,
} from "@/lib/types";
import { canTransition } from "@/lib/rules";
import { OrderCard } from "./OrderView";
import Modal from "./Modal";
type Catalog = {
  products: Product[];
  categories: Category[];
  settings: DeliverySettings;
};
export default function Admin({ initial }: { initial: Catalog }) {
  const [tab, setTab] = useState("orders"),
    [catalog, setCatalog] = useState(initial),
    [orders, setOrders] = useState<Order[]>([]),
    [status, setStatus] = useState("all"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Product | null>(null),
    [isNew, setIsNew] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [catalogError, setCatalogError] = useState(""),
    [busy, setBusy] = useState(false);
  const [integration, setIntegration] = useState<{
    telegram: boolean;
    notifications: {
      id: string;
      attempts: number;
      sentAt: number | null;
      lastError: string | null;
    }[];
  } | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => {
      if (tab === "orders")
        void api<Order[]>("admin/orders")
          .then((v) => {
            if (live) setOrders(v);
          })
          .catch((e) => {
            if (live) setError(e.message);
          });
      if (tab === "settings")
        void api<typeof integration>("admin/integrations")
          .then((v) => {
            if (live) setIntegration(v);
          })
          .catch((e) => {
            if (live) setError(e.message);
          });
    };
    load();
    const timer = setInterval(load, 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [tab]);
  const reloadCatalog = async () => {
    setBusy(true);
    setCatalogError("");
    try {
      setCatalog(await api<Catalog>("catalog"));
    } catch (e) {
      setCatalogError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveProduct = async (p: Product) => {
    setBusy(true);
    setError("");
    try {
      await api("admin/product", { ...p, creating: isNew, expectedStock: editing?.stock });
      setCatalog((current) => ({
        ...current,
        products: current.products.some((item) => item.id === p.id)
          ? current.products.map((item) => item.id === p.id ? p : item)
          : [...current.products, p],
      }));
      setEditing(null);
      setMessage("Товар сохранён.");
      await reloadCatalog();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeStatus = async (id: string, value: string) => {
    setBusy(true);
    setError("");
    try {
      await api("admin/status", { id, status: value });
      setOrders(await api<Order[]>("admin/orders"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const settings = await api<DeliverySettings>("admin/settings", {
        fee: Math.round(Number(form.get("fee")) * 100),
        minimum: Math.round(Number(form.get("minimum")) * 100),
        freeFrom: Math.round(Number(form.get("freeFrom")) * 100),
        city: form.get("city"),
      });
      setCatalog({ ...catalog, settings });
      setMessage("Условия доставки обновлены.");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="account-head">
        <div>
          <span className="eyebrow">ЖАК-АНДРЭ · РАБОЧЕЕ МЕСТО</span>
          <h1 style={{ marginTop: 10 }}>Пекарня под контролем</h1>
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
      <div className="admin-tabs" role="group" aria-label="Разделы админки">
        {[
          ["orders", "Заказы"],
          ["products", "Каталог"],
          ["settings", "Доставка и подключения"],
        ].map(([key, label]) => (
          <button
            className={`filter ${tab === key ? "active" : ""}`}
            aria-pressed={tab === key}
            key={key}
            onClick={() => {
              setTab(key);
              setMessage("");
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && !editing && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {catalogError && (
        <div className="error" role="alert">
          Товар сохранён, но не удалось обновить каталог: {catalogError}{" "}
          <button type="button" disabled={busy} onClick={() => void reloadCatalog()}>
            Повторить загрузку каталога
          </button>
        </div>
      )}
      {tab === "orders" && (
        <>
          <div className="admin-toolbar">
            <label className="form-field">
              Статус
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">Все заказы</option>
                {Object.entries(statusLabels).map(([key, text]) => (
                  <option key={key} value={key}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">
              Обновление каждые 10 секунд · {orders.length} заказов
            </span>
          </div>
          {orders
            .filter((o) => status === "all" || o.status === status)
            .map((o) => (
              <div key={o.id} style={{ marginBottom: 30 }}>
                <OrderCard order={o} detailed />
                <div className="admin-order-actions">
                  {Object.keys(statusLabels)
                    .filter((s) => canTransition(o.status, s, o.fulfillment))
                    .map((s) => (
                      <button
                        className="button button-small button-outline"
                        key={s}
                        disabled={busy}
                        onClick={() => void changeStatus(o.id, s)}
                      >
                        {statusLabels[s]}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          {!orders.length && (
            <div className="empty-state">
              <h2>Заказов пока нет</h2>
              <p>Первый заказ появится здесь после оформления на сайте.</p>
            </div>
          )}
        </>
      )}
      {tab === "products" && (
        <>
          <p className="muted">
            Учтено на складе: {catalog.products.reduce((sum, p) => sum + (p.stock ?? 0), 0)} шт.
            {" "}Остаток не указан для {catalog.products.filter((p) => p.stock === null).length} товаров.
          </p>
          <div className="admin-toolbar">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="Поиск товара в админке"
                placeholder="Найти товар"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                setIsNew(true);
                setError("");
                setEditing({
                  id: "",
                  name: "",
                  description: "",
                  category: catalog.categories[0].id,
                  price: null,
                  image: null,
                  available: true,
                  stock: null,
                  isBestseller: false,
                  isSeasonal: false,
                  variants: [],
                });
              }}
            >
              <Plus size={17} /> Добавить товар
            </button>
          </div>
          <div className="admin-products">
            {catalog.products
              .filter((p) =>
                p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
              .map((p) => (
                <div className="admin-product" key={p.id}>
                  {p.image && (
                    <Image
                      src={p.image}
                      alt=""
                      width={55}
                      height={55}
                      style={{
                        borderRadius: 8,
                        objectFit: "cover",
                        height: 55,
                      }}
                    />
                  )}
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.variants.length
                        ? `от ${money(Math.min(...p.variants.map((v) => v.price)))}`
                        : p.price === null
                          ? "Цена не задана"
                          : money(p.price)}{" "}
                      · {p.available ? "В продаже" : "Скрыт из продажи"}
                      {" · "}{p.stock === null ? "Остаток не указан" : `Остаток: ${p.stock} шт.`}
                    </small>
                  </div>
                  <button
                    className="button button-small button-outline"
                    disabled={busy}
                    onClick={() => {
                      setIsNew(false);
                      setError("");
                      setEditing(p);
                    }}
                  >
                    Редактировать
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
      {tab === "settings" && (
        <div className="cart-layout">
          <form className="form-card" onSubmit={saveSettings}>
            <h2>Доставка</h2>
            <label className="form-field">
              Город
              <input
                name="city"
                defaultValue={catalog.settings.city}
                required
              />
            </label>
            <label className="form-field">
              Стоимость доставки, ₽
              <input
                name="fee"
                type="number"
                min="0"
                step="0.01"
                defaultValue={catalog.settings.fee / 100}
                required
              />
            </label>
            <label className="form-field">
              Бесплатная доставка от, ₽
              <input
                name="freeFrom"
                type="number"
                min="0"
                step="0.01"
                defaultValue={catalog.settings.freeFrom / 100}
                required
              />
            </label>
            <label className="form-field">
              Минимальная сумма товаров для доставки, ₽
              <input
                name="minimum"
                type="number"
                min="0"
                step="0.01"
                defaultValue={catalog.settings.minimum / 100}
                required
              />
            </label>
            <button className="button" disabled={busy}>
              Сохранить настройки
            </button>
          </form>
          <div className="form-card">
            <h2>Telegram</h2>
            <p className={integration?.telegram ? "success" : "error"}>
              {integration?.telegram
                ? "Ключи добавлены. Доставку проверяйте по сообщениям и очереди."
                : "Telegram не подключён. Заказы сохраняются в админке, уведомления ожидают настройки."}
            </p>
            <p className="muted">
              Ожидают отправки:{" "}
              {integration?.notifications.filter((n) => !n.sentAt).length || 0}
            </p>
            <p className="muted">
              Отправлены:{" "}
              {integration?.notifications.filter((n) => n.sentAt).length || 0}
            </p>
            {integration?.notifications.some((n) => n.lastError) && (
              <p className="error">
                Есть ошибки отправки. Проверьте ключи бота и ID чата. Повторные
                попытки выполняются автоматически.
              </p>
            )}
            <p className="fine-print" style={{ marginTop: 20 }}>
              Ключи настраиваются в локальном файле окружения. Инструкция — в
              README проекта.
            </p>
          </div>
        </div>
      )}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? "Новый товар" : "Редактировать товар"}
      >
        {editing && (
          <ProductEditor
            key={editing.id || "new"}
            product={editing}
            categories={catalog.categories}
            isNew={isNew}
            busy={busy}
            error={error}
            onSave={saveProduct}
          />
        )}
      </Modal>
    </>
  );
}
function ProductEditor({
  product,
  categories,
  isNew,
  busy,
  error,
  onSave,
}: {
  product: Product;
  categories: Category[];
  isNew: boolean;
  busy: boolean;
  error: string;
  onSave: (p: Product) => Promise<void>;
}) {
  const [p, setP] = useState<Product>(product),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/shop/admin/upload", {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setP((current) => ({ ...current, image: result.url }));
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(p);
      }}
    >
      <label className="form-field">
        Идентификатор (латиница и дефисы)
        <input
          value={p.id}
          required
          disabled={!isNew}
          pattern="[a-z0-9-]+"
          onChange={(e) => setP({ ...p, id: e.target.value })}
        />
      </label>
      <label className="form-field">
        Название
        <input
          value={p.name}
          required
          minLength={2}
          onChange={(e) => setP({ ...p, name: e.target.value })}
        />
      </label>
      <label className="form-field">
        Описание
        <textarea
          rows={3}
          maxLength={1500}
          value={p.description || ""}
          onChange={(e) => setP({ ...p, description: e.target.value })}
        />
      </label>
      <label className="form-field">
        Категория
        <select
          value={p.category}
          onChange={(e) => setP({ ...p, category: e.target.value })}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        Остаток, шт. (пусто — не указан; общий для всех объёмов)
        <input
          type="number"
          min="0"
          max="1000000"
          step="1"
          value={p.stock === null ? "" : p.stock}
          onChange={(e) => setP({ ...p, stock: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </label>
      <label className="form-field">
        Цена, ₽ (пусто — цена уточняется)
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={p.price === null ? "" : p.price / 100}
          onChange={(e) =>
            setP({
              ...p,
              price:
                e.target.value === ""
                  ? null
                  : Math.round(Number(e.target.value) * 100),
            })
          }
        />
      </label>
      <div className="admin-variants">
        <p style={{ marginBottom: 15 }}>Варианты напитка</p>
        {p.variants.map((v, index) => (
          <div className="admin-variant" key={v.id}>
            <label className="form-field">
              Объём, мл
              <input
                type="number"
                min="1"
                max="10000"
                value={v.volumeMl}
                required
                onChange={(e) =>
                  setP({
                    ...p,
                    variants: p.variants.map((x, i) =>
                      i === index
                        ? {
                            ...x,
                            volumeMl: Number(e.target.value),
                            label: `${e.target.value} мл`,
                          }
                        : x,
                    ),
                  })
                }
              />
            </label>
            <label className="form-field">
              Цена, ₽
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={v.price / 100}
                required
                onChange={(e) =>
                  setP({
                    ...p,
                    variants: p.variants.map((x, i) =>
                      i === index
                        ? {
                            ...x,
                            price: Math.round(Number(e.target.value) * 100),
                          }
                        : x,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Удалить вариант ${v.label}`}
              onClick={() =>
                setP({
                  ...p,
                  variants: p.variants.filter((_, i) => i !== index),
                })
              }
            >
              <X size={17} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-link"
          onClick={() =>
            setP({
              ...p,
              variants: [
                ...p.variants,
                {
                  id: `variant-${crypto.randomUUID()}`,
                  productId: p.id,
                  label: "250 мл",
                  volumeMl: 250,
                  price: 10000,
                },
              ],
            })
          }
        >
          + Добавить объём
        </button>
      </div>
      {p.image && (
        <Image
          src={p.image}
          alt="Фото товара"
          width={130}
          height={100}
          style={{ borderRadius: 8, objectFit: "cover", marginBottom: 12 }}
        />
      )}
      <label className="form-field">
        <span>
          <Upload size={15} style={{ display: "inline" }} /> Фото: JPEG, PNG или
          WebP до 5 МБ
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {(["available", "isBestseller", "isSeasonal"] as const).map((key, i) => (
        <label key={key} className="checkbox-row">
          <input
            type="checkbox"
            checked={p[key]}
            onChange={(e) => setP({ ...p, [key]: e.target.checked })}
          />
          {["В продаже", "Популярный товар", "Сезонный товар"][i]}
        </label>
      ))}
      {(error || uploadError) && (
        <p className="error" role="alert">
          {error || uploadError}
        </p>
      )}
      <button
        type="submit"
        className="button full-width"
        disabled={busy || uploading}
      >
        {busy
          ? "Сохраняем…"
          : uploading
            ? "Загружаем фото…"
            : "Сохранить товар"}
      </button>
    </form>
  );
}
