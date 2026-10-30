"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section className="container empty-state">
      <h1>Не удалось загрузить страницу</h1>
      <p>Проверьте, что база настроена, и попробуйте ещё раз.</p>
      <button className="button" onClick={reset}>
        Повторить
      </button>
    </section>
  );
}
