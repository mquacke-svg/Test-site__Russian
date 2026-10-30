import Checkout from "@/components/Checkout";
import { getCatalog } from "@/lib/shop";
export const dynamic = "force-dynamic";
export default function Page() {
  const { locations, settings } = getCatalog();
  return (
    <section className="container page-section">
      <span className="eyebrow">ЕЩЁ ОДИН ШАГ ДО ПРИЯТНОГО</span>
      <h1>Оформление заказа</h1>
      <Checkout locations={locations} settings={settings} />
    </section>
  );
}
