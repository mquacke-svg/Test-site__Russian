/**
 * Точки сети пекарен-кондитерских «Жак-Андрэ» в Краснодаре.
 */

export interface Location {
  /** Slug латиницей — для якорей и ключей списка */
  id: string;
  /** Короткое название точки для карточки */
  title: string;
  /** Полный адрес */
  address: string;
  /** Город */
  city: string;
  /** Телефон в человекочитаемом виде. null — телефона нет */
  phone: string | null;
  /** Телефон для ссылки tel:, вида +79183395390. null — телефона нет */
  phoneRaw: string | null;
  /** Часы работы для витрины */
  hours: string;
  /** Часы работы в машиночитаемом виде (openingHours / schema.org) */
  hoursMachine: { opens: string; closes: string; days: string[] };
  /** Якорная точка сети */
  isPrimary: boolean;
}

/** Общая почта сети */
export const CONTACT_EMAIL = 'info@jacques-andre.ru';

/** Название сети */
export const BRAND_NAME = 'Жак-Андрэ';

const EVERY_DAY = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAILY_HOURS = {
  opens: '08:00',
  closes: '21:00',
  days: EVERY_DAY,
};

export const locations: Location[] = [
  {
    id: 'rossiyskaya-74',
    title: 'На Российской',
    address: 'ул. Российская, 74',
    city: 'Краснодар',
    phone: '+7 (918) 339-53-90',
    phoneRaw: '+79183395390',
    hours: 'Ежедневно 08:00–21:00',
    hoursMachine: DAILY_HOURS,
    isPrimary: true,
  },
  {
    id: 'stavropolskaya-183-2',
    title: 'На Ставропольской',
    address: 'ул. Ставропольская, 183/2',
    city: 'Краснодар',
    phone: '+7 (967) 308-89-96',
    phoneRaw: '+79673088996',
    hours: 'Ежедневно 08:00–21:00',
    hoursMachine: DAILY_HOURS,
    isPrimary: false,
  },
  {
    id: 'krasnyh-partizan-1-4',
    title: 'На Красных Партизан',
    address: 'ул. Красных Партизан, 1/4 лит10',
    city: 'Краснодар',
    phone: '+7 (918) 167-98-43',
    phoneRaw: '+79181679843',
    hours: 'Ежедневно 08:00–21:00',
    hoursMachine: DAILY_HOURS,
    isPrimary: false,
  },
  {
    id: 'generala-shifrina-1',
    title: 'На Генерала Шифрина',
    address: 'ул. Генерала Шифрина, 1',
    city: 'Краснодар',
    phone: null,
    phoneRaw: null,
    hours: 'Ежедневно 08:00–21:00',
    hoursMachine: DAILY_HOURS,
    isPrimary: false,
  },
];

/** Якорная точка сети — для шапки, футера и контактного блока */
export function getPrimaryLocation(): Location {
  return locations.find((location) => location.isPrimary) ?? locations[0];
}

/** Точка по slug */
export function getLocationById(id: string): Location | undefined {
  return locations.find((location) => location.id === id);
}
