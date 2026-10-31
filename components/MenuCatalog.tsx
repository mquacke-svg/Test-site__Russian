"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { Category, Product } from "@/lib/types";
import ProductCard from "./ProductCard";
export default function MenuCatalog({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  useEffect(() => {
    const set = () => {
      const id = window.location.hash.slice(1);
      setFilter(categories.some((c) => c.id === id) ? id : "all");
    };
    set();
    window.addEventListener("hashchange", set);
    window.addEventListener("popstate", set);
    return () => {
      window.removeEventListener("hashchange", set);
      window.removeEventListener("popstate", set);
    };
  }, [categories]);
  const selectFilter = (id: string) => {
    const url = new URL(window.location.href);
    url.hash = id === "all" ? "" : id;
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
    setFilter(id);
  };
  const shown = products.filter(
    (p) =>
      (filter === "all" || p.category === filter) &&
      `${p.name} ${p.description || ""}`
        .toLocaleLowerCase("ru")
        .includes(search.toLocaleLowerCase("ru").trim()),
  );
  const countWord = {
    one: "позиция",
    few: "позиции",
    many: "позиций",
    other: "позиции",
  }[
    new Intl.PluralRules("ru").select(shown.length) as
      "one" | "few" | "many" | "other"
  ];
  return (
    <div className="container catalog">
      <div className="catalog-controls">
        <div className="filter-row" role="group" aria-label="Категории меню">
          <button
            className={filter === "all" ? "filter active" : "filter"}
            aria-pressed={filter === "all"}
            onClick={() => selectFilter("all")}
          >
            Всё меню
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={filter === c.id ? "filter active" : "filter"}
              aria-pressed={filter === c.id}
              onClick={() => selectFilter(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти что-нибудь вкусное"
            aria-label="Поиск по меню"
          />
          {search && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setSearch("")}
            >
              <X size={17} />
            </button>
          )}
        </label>
      </div>
      <div className="catalog-count" aria-live="polite">
        {shown.length} {countWord} · Свежая выпечка каждый день
      </div>
      <div className="product-grid">
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {!shown.length && (
        <div className="empty-state">
          <h2>Пока ничего не нашлось</h2>
          <p>Попробуйте другое название или категорию.</p>
          <button
            className="button"
            onClick={() => {
              setSearch("");
              selectFilter("all");
            }}
          >
            Показать всё меню
          </button>
        </div>
      )}
    </div>
  );
}
