"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { api } from "@/lib/client";
import type { Cart } from "@/lib/types";
import Modal from "./Modal";
import CartContents from "./CartContents";
type ShopContext = {
  cart: Cart;
  loading: boolean;
  busy: boolean;
  refresh: () => Promise<void>;
  mutate: (body: unknown) => Promise<boolean>;
  openCart: () => void;
  closeCart: () => void;
  toast: (text: string) => void;
  error: string;
};
const Context = createContext<ShopContext | null>(null);
export const useShop = () => {
  const value = useContext(Context);
  if (!value) throw new Error("ShopProvider missing");
  return value;
};
export default function ShopProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({ items: [], count: 0, subtotal: 0 });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const mutationPending = useRef(false);
  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.current.then(operation);
    queue.current = result.then(() => undefined, () => undefined);
    return result;
  }, []);
  const refresh = useCallback(() => enqueue(async () => {
    try {
      setCart(await api<Cart>("cart"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }), [enqueue]);
  useEffect(() => {
    void refresh();
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refresh]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const mutate = async (body: unknown) => {
    if (loading || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try {
      return await enqueue(async () => {
        try {
          setCart(await api<Cart>("cart", body));
          setError("");
          return true;
        } catch (e) {
          setError((e as Error).message);
          setNotice((e as Error).message);
          return false;
        }
      });
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        cart,
        loading,
        busy,
        refresh,
        mutate,
        openCart: () => setOpen(true),
        closeCart: () => setOpen(false),
        toast: setNotice,
        error,
      }}
    >
      {children}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ваша корзина"
        drawer
      >
        <CartContents compact />
      </Modal>
      {notice && (
        <div className="toast" role={notice === error ? "alert" : "status"}>
          {notice === error ? <X size={18} /> : <Check size={18} />}
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="Закрыть уведомление"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <CookieNotice />
    </Context.Provider>
  );
}
function CookieNotice() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(
      !document.cookie
        .split("; ")
        .some((c) => c.startsWith("bakery_cookie_notice=")),
    );
  }, []);
  return visible ? (
    <aside className="cookie-notice" aria-label="Использование cookies">
      <div>
        <strong>Немного cookies к вашему кофе</strong>
        <p>
          Они сохраняют корзину и вход. Никакой рекламы и аналитики.{" "}
          <Link href="/cookies">Подробнее</Link>
        </p>
      </div>
      <button
        className="button button-small"
        onClick={() => {
          document.cookie = `bakery_cookie_notice=1; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          setVisible(false);
        }}
      >
        Понятно
      </button>
    </aside>
  ) : null;
}
