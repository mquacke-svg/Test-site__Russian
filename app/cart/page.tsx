import CartContents from "@/components/CartContents";
export default function CartPage() {
  return (
    <section className="container page-section">
      <span className="eyebrow">ПРИЯТНЫЕ МЕЛОЧИ УЖЕ РЯДОМ</span>
      <h1>Ваша корзина</h1>
      <CartContents />
    </section>
  );
}
