<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Работа с проектом

## Назначение и стек

Русскоязычный сайт французской пекарни-кондитерской «Жак-Андрэ» в Краснодаре:
главная страница и каталог меню с фильтрами по категориям.

- Next.js 16.4.3, App Router; React 19.2.8; TypeScript со строгой проверкой.
- Tailwind CSS v4 через `@tailwindcss/postcss`; токены заданы в `app/globals.css`.
- Менеджер пакетов — npm; сохранять `package-lock.json`.
- Импорт `@/*` указывает на корень проекта. Каталога `src/` нет.
- Рабочие данные хранятся в SQLite через Drizzle ORM; `data/` содержит исходный seed.
- Better Auth управляет входом VK/Google и серверными сессиями; Zod проверяет запросы.

## Команды

- `npm ci` — установка зависимостей по lock-файлу, если требуется.
- `npm run dev` — сервер разработки; по умолчанию `http://localhost:3000`.
- `npm run build` — production-сборка с проверкой TypeScript и генерацией страниц.
- `npm start` — запуск готовой production-сборки.
- `npx tsc --noEmit` — отдельная проверка типов при установленных зависимостях.
  Тип `LayoutProps` генерируется Next.js: на чистом checkout сначала выполнить
  `npx next typegen` либо сборку.
- `npm run setup` — миграции, начальные данные и локальный секрет; не перезаписывает каталог.
- `npm run admin:create` — создание администратора с собственным паролем.
- `npm test` — серверные тесты Vitest в отдельной временной базе.
- `npm run test:e2e` — Playwright/Edge; нужен запущенный тестовый сайт.
- `npm run backup` / `npm run restore -- <timestamp> --server-stopped` — резервная копия/восстановление.

## Карта файлов

- `app/page.tsx` — `/`: новый hero, категории, товары, история, доставка и адреса.
- `app/menu/page.tsx` — `/menu`: каталог и метаданные страницы меню.
- `app/layout.tsx` — корневой layout, локальные шрифты, Header/Footer, ShopProvider,
  ссылка пропуска навигации; тестовый сайт закрыт от индексации.
- `app/globals.css` — Tailwind, фирменные токены и глобальные стили доступности.
- `components/` — секции страниц и общие Header, Footer, ProductCard.
  Header и MenuCatalog используют клиентское состояние.
- `data/products.ts` — исходный каталог для первого заполнения; текущие товары менять
  в админке/базе. Суммы рабочего магазина — целые копейки, исходный seed — рубли.
- `data/locations.ts` — адреса, часы работы, телефоны, название и общая почта сети.
- `public/` — логотипы SVG, фото пекарни и `products/*.webp`.
- `next.config.ts` — настройки оптимизации изображений.
- `DESIGN.md` — визуальные референсы, описание логотипов и происхождения фото.
- Общие инструкции по работе с проектом хранить в `AGENTS.md`.

## Правила изменений

- Перед изменениями Next.js читать соответствующие локальные руководства из
  `node_modules/next/dist/docs/`. Они имеют расширение `.md`.
- Страницы и layout оставлять серверными по умолчанию; `'use client'` добавлять
  для интерактивности и браузерных API.
- Текст интерфейса — на русском. Сохранять типизированные slug категорий и товаров.
- Следовать оформлению соседнего файла: общего formatter-конфига сейчас нет.
- Сохранять согласованную новую шалфейно-зелёную, сливочную и персиковую палитру. Текущие
  шрифты — Playfair Display для заголовков и Inter для текста.
- `DESIGN.md` содержит ранние рекомендации (Montserrat, JPEG и другие значения
  палитры); учитывать текущую реализацию в layout/CSS и реальные WebP-ассеты.
  Не возвращать старые параметры автоматически.
- Для фото использовать `next/image`, подходящие `sizes` и осмысленный `alt`;
  пустой `alt` допустим для декоративного фото, дублирующего соседний текст.
  Реальные фото ассортимента предпочтительнее стоковых.
- Сохранять клавиатурную навигацию, видимый фокус, skip-link, семантические
  заголовки и ARIA-состояния мобильного меню и фильтров.
- Высота Header связана с sticky-отступами MenuCatalog: менять их согласованно.
- Цены в `data/products.ts` помечены как снимок от 22.12.2025; не представлять их
  как заново проверенные без отдельной проверки источника.
- Не редактировать `.next/`, `next-env.d.ts`, `*.tsbuildinfo` и `node_modules/`
  вручную. Не добавлять необработанные фото из корня вместо файлов `public/`.

## Проверка результата

После изменений кода выполнять `npm run build`. Для изменений интерфейса также
проверять `/` и `/menu` в браузере на мобильной и настольной ширине: навигацию,
фильтры, изображения, отсутствие горизонтальной прокрутки и доступность с клавиатуры.
Успешная сборка сама по себе не подтверждает визуальное качество.

Шрифты загружаются через `next/font/local`, сеть для сборки не нужна.
Секреты и SQLite/загрузки находятся в игнорируемых `.env.local` и `.local/`.
Реальную работу VK/Google/Telegram подтверждать только после проверки с ключами владельца.
