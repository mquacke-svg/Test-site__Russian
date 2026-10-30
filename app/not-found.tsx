import Link from "next/link";
export default function NotFound() {
  return (
    <section className="container empty-state">
      <span className="eyebrow">404 · ЗДЕСЬ ОСТАЛИСЬ ТОЛЬКО КРОШКИ</span>
      <h1>Страница не нашлась</h1>
      <p>Но в нашем меню точно есть что-то хорошее.</p>
      <Link className="button" href="/menu">
        Открыть меню
      </Link>
    </section>
  );
}
