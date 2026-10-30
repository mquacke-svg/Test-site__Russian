export default function Page() {
  return (
    <article className="container page-section legal">
      <span className="eyebrow">ПРОЗРАЧНО И ПОНЯТНО</span>
      <h1>Как мы используем cookies</h1>
      <p>
        Это локальная тестовая версия магазина «Жак-Андрэ». Cookies — небольшие
        данные, которые браузер сохраняет для работы сайта.
      </p>
      <h2>Только необходимые данные</h2>
      <ul>
        <li>
          <strong>bakery_guest — до 30 дней.</strong> Случайный идентификатор
          гостевого браузера. Позволяет восстановить корзину и посмотреть свои
          гостевые заказы. Имя, телефон и состав корзины в cookie не хранятся.
        </li>
        <li>
          <strong>Cookies Better Auth — до 7 дней для сессии.</strong> Сохраняют
          вход в аккаунт. Краткосрочные cookies используются для безопасного
          возвращения из VK или Google.
        </li>
        <li>
          <strong>bakery_cookie_notice — до 1 года.</strong> Запоминает, что вы
          закрыли уведомление о cookies.
        </li>
      </ul>
    </article>
  );
}
