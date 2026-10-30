import type { Metadata } from "next";
import { getCatalog } from "@/lib/shop";
import MenuCatalog from "@/components/MenuCatalog";
import { Flower, Wave } from "@/components/Decor";
export const metadata: Metadata = { title: "Наше меню" };
export const dynamic = "force-dynamic";
export default function MenuPage() {
  const { products, categories } = getCatalog();
  return (
    <>
      <section className="page-banner">
        <span className="eyebrow">ИСПЕЧЕНО С ЛЮБОВЬЮ</span>
        <h1>Каждому дню — свой вкус</h1>
        <p>От первого глотка кофе до последней крошки.</p>
        <Flower className="banner-flower" />
        <Wave />
      </section>
      <MenuCatalog products={products} categories={categories} />
    </>
  );
}
