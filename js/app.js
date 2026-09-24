/* =========================================================
   MIRAI 未来 — интерактив сайта
   Без зависимостей. Модули ниже идут в порядке страницы.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Утилиты ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const nf = new Intl.NumberFormat('ru-RU');
  const store = {
    get(k) { try { return localStorage.getItem('mirai:' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('mirai:' + k, v); } catch (e) { /* хранилище недоступно */ } },
  };
  const plural = (n, forms) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  };
  const fmtHours = h => {
    const m = Math.round(h * 60 / 5) * 5;
    const hh = Math.floor(m / 60), mm = m % 60;
    if (!hh) return `${mm} мин`;
    return mm ? `${hh} ч ${mm} мин` : `${hh} ч`;
  };
  const fnv = s => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };
  const goTo = sel => { const el = $(sel); if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); };
  const play = v => { if (!v) return; const p = v.play(); if (p && p.catch) p.catch(() => {}); };

  let toastTimer = 0;
  const toast = text => {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 3400);
  };

  /* ---------- Загрузка голограммы (один раз за сессию) ---------- */
  const BOOT_MS = (() => {
    const boot = $('#boot');
    if (!boot) return 0;
    let seen = false;
    try { seen = sessionStorage.getItem('mirai:boot') === '1'; } catch (e) { /* хранилище недоступно */ }
    if (reduced || seen) { boot.remove(); return 0; }
    try { sessionStorage.setItem('mirai:boot', '1'); } catch (e) { /* хранилище недоступно */ }
    const bar = $('#boot-bar'), pct = $('#boot-pct'), line = $('#boot-line');
    const LINES = ['Инициализация голограммы', 'Калибровка проектора', 'Синхронизация с Токио', 'Голограмма готова'];
    const DUR = 1300, start = performance.now();
    let closed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      boot.classList.add('is-done');
      setTimeout(() => boot.remove(), 750);
    };
    const step = now => {
      const t = clamp((now - start) / DUR, 0, 1);
      bar.style.transform = `scaleX(${t})`;
      pct.textContent = String(Math.round(t * 100)).padStart(3, '0') + '%';
      line.textContent = LINES[Math.min(LINES.length - 1, Math.floor(t * LINES.length))];
      if (t < 1) requestAnimationFrame(step);
      else setTimeout(done, 150);
    };
    requestAnimationFrame(step);
    boot.addEventListener('click', done);
    return DUR + 250;
  })();

  /* ---------- Данные ---------- */
  // Видео Kling лежат в media/: <id>.mp4 и кадр-обложка <id>.jpg
  const sourcesHTML = key => `<source src="media/${key}.mp4" type="video/mp4">`;
  const posterOf = key => `media/${key}.jpg`;

  const CITIES = {
    sapporo:   { name: 'Саппоро',   k: '札幌', lat: 43.06, lon: 141.35, side: 'r', n: 3, ap: 'CTS', apName: 'Саппоро · Новый Титосэ' },
    niseko:    { name: 'Нисэко',    k: 'ニセコ', lat: 42.80, lon: 140.69, side: 'l', n: 3, ap: 'CTS', apName: 'Саппоро · Новый Титосэ' },
    nikko:     { name: 'Никко',     k: '日光', lat: 36.72, lon: 139.70, side: 'r', n: 1, ap: 'HND', apName: 'Токио · Ханэда' },
    tokyo:     { name: 'Токио',     k: '東京', lat: 35.68, lon: 139.69, side: 'r', n: 3, ap: 'HND', apName: 'Токио · Ханэда', sk: true },
    hakone:    { name: 'Хаконэ',    k: '箱根', lat: 35.23, lon: 139.02, side: 'b', n: 1, ap: 'HND', apName: 'Токио · Ханэда' },
    kanazawa:  { name: 'Канадзава', k: '金沢', lat: 36.56, lon: 136.65, side: 't', n: 2, ap: 'KMQ', apName: 'Комацу', sk: true },
    kyoto:     { name: 'Киото',     k: '京都', lat: 35.01, lon: 135.77, side: 'r', n: 3, ap: 'KIX', apName: 'Осака · Кансай', sk: true },
    osaka:     { name: 'Осака',     k: '大阪', lat: 34.69, lon: 135.50, side: 'l', n: 2, ap: 'KIX', apName: 'Осака · Кансай', sk: true },
    nara:      { name: 'Нара',      k: '奈良', lat: 34.69, lon: 135.80, side: 'b', n: 1, ap: 'KIX', apName: 'Осака · Кансай' },
    hiroshima: { name: 'Хиросима',  k: '広島', lat: 34.39, lon: 132.46, side: 't', n: 2, ap: 'HIJ', apName: 'Хиросима', sk: true },
    fukuoka:   { name: 'Фукуока',   k: '福岡', lat: 33.59, lon: 130.40, side: 'b', n: 2, ap: 'FUK', apName: 'Фукуока', sk: true },
    naha:      { name: 'Наха',      k: '那覇', lat: 26.21, lon: 127.68, side: 'r', n: 4, ap: 'OKA', apName: 'Наха · Окинава', inset: true },
    ishigaki:  { name: 'Исигаки',   k: '石垣', lat: 24.34, lon: 124.16, side: 't', n: 4, ap: 'ISG', apName: 'Исигаки', inset: true },
  };

  const TOURS = [
    {
      id: 'tokyo', title: 'Неоновый Токио', kanji: '東京', code: 'HND', coords: '35.68°N 139.69°E', airport: 'Токио · Ханэда',
      days: 7, price: 189000, cities: 'Токио · Никко · Хаконэ', best: 'весна и осень',
      route: [['tokyo', 4], ['nikko', 1], ['hakone', 1]],
      plan: [
        ['День 1', 'Прилёт в Ханэду, заселение в Синдзюку. Вечером перекрёсток Сибуя и смотровая площадка Shibuya Sky.'],
        ['День 2', 'Асакуса и храм Сэнсо-дзи, затем Акихабара: аркады, винтажные приставки и мейд-кафе.'],
        ['День 3', 'Цифровой музей teamLab Planets, остров Одайба и вечерний круиз по Токийскому заливу.'],
        ['День 4', 'Никко: святилище Тосё-гу, серпантин Ирохадзака и водопад Кэгон. Ночь в рёкане.'],
        ['День 5', 'Хаконэ: канатная дорога над долиной Овакудани, озеро Аси и вид на Фудзи. Вечером онсэн.'],
        ['День 6', 'Возвращение в Токио. Голден-гай и Омоидэ-ёкотё: крошечные бары и якитори.'],
        ['День 7', 'Внешний рынок Цукидзи, свободное время и вылет домой.'],
      ],
    },
    {
      id: 'kyoto', title: 'Киото: путь тории', kanji: '京都', code: 'KIX', coords: '35.01°N 135.77°E', airport: 'Осака · Кансай',
      days: 9, price: 214000, cities: 'Киото · Нара · Осака', best: 'весна · сакура',
      route: [['kyoto', 5], ['nara', 1], ['osaka', 2]],
      plan: [
        ['День 1', 'Прилёт в Кансай, поезд Haruka до Киото и вечерняя прогулка по Гиону.'],
        ['День 2', 'Фусими Инари на рассвете: тоннель из тысяч красных тории, пока там нет толп.'],
        ['День 3', 'Арасияма: бамбуковая роща, храм Тэнрю-дзи и парк обезьян Ивата-яма.'],
        ['День 4', 'Золотой павильон Кинкаку-дзи, сад камней Рёан-дзи и чайная церемония.'],
        ['День 5', 'Мастер-класс по кухне кайсэки и вечер в переулке Понто-тё.'],
        ['День 6', 'Нара: олени в парке Нара и Большой Будда в храме Тодай-дзи. Ночь в рёкане.'],
        ['День 7', 'Осака: замок Осаки и уличная еда Дотонбори, такояки и окономияки.'],
        ['День 8', 'Свободный день: Universal Studios Japan или шопинг в Умэде.'],
        ['День 9', 'Вылет из Кансая.'],
      ],
    },
    {
      id: 'hokkaido', title: 'Хоккайдо: снег и онсэны', kanji: '北海道', code: 'CTS', coords: '43.06°N 141.35°E', airport: 'Саппоро · Новый Титосэ',
      days: 8, price: 236000, cities: 'Саппоро · Отару · Нисэко', best: 'январь — февраль',
      route: [['tokyo', 1], ['sapporo', 3], ['niseko', 3]],
      plan: [
        ['День 1', 'Прилёт в Токио, ночь у аэропорта Ханэда.'],
        ['День 2', 'Перелёт в Саппоро. Телебашня и рамэн с мисо в переулке Рамэн-ёкотё.'],
        ['День 3', 'Снежный фестиваль Юки-мацури (в начале февраля) или рынок Нидзё с крабами.'],
        ['День 4', 'Отару: каналы, стеклодувные мастерские и музей музыкальных шкатулок.'],
        ['День 5', 'Переезд в Нисэко. Пудровый снег и катание с инструктором.'],
        ['День 6', 'Второй день на склонах, вечером онсэн под открытым небом.'],
        ['День 7', 'Свободный день: снегоступы или ночное катание.'],
        ['День 8', 'Трансфер в аэропорт Новый Титосэ и вылет.'],
      ],
    },
    {
      id: 'okinawa', title: 'Окинава: лазурный край', kanji: '沖縄', code: 'OKA', coords: '26.21°N 127.68°E', airport: 'Наха · Окинава',
      days: 10, price: 248000, cities: 'Наха · Керама · Исигаки', best: 'июль — октябрь',
      route: [['tokyo', 1], ['naha', 4], ['ishigaki', 4]],
      plan: [
        ['День 1', 'Прилёт в Токио, ночь у аэропорта.'],
        ['День 2', 'Перелёт на Окинаву. Улица Кокусай-дори и ужин с местной кухней.'],
        ['День 3', 'Замок Сюри и рынок Макиси.'],
        ['День 4', 'Океанариум Тюрауми с китовыми акулами и мыс Мандзамо.'],
        ['День 5', 'Острова Керама на катере: снорклинг с морскими черепахами.'],
        ['День 6', 'Перелёт на Исигаки. Бухта Кабира.'],
        ['День 7', 'Снорклинг или дайвинг с мантами.'],
        ['День 8', 'Остров Такэтоми: красные черепичные крыши и повозки с буйволами.'],
        ['День 9', 'Свободный день на пляже.'],
        ['День 10', 'Вылет через Наху и Токио.'],
      ],
    },
  ];

  const SEASONS = {
    spring: {
      k: '春', name: 'Весна', sub: 'сакура', months: 'март — май', temp: 'Токио, в среднем: 9–19 °C', fx: 'petals', tour: 'kyoto',
      text: 'Сакура цветёт всего неделю-полторы и идёт по стране с юга на север. Японцы называют это сакура-дзэнсэн, фронт цветения. Даты тура мы подстраиваем под свежий прогноз.',
      frontTitle: 'Сакура-фронт: когда зацветает',
      front: [['Окинава', 'середина января'], ['Фукуока', 'около 22 марта'], ['Токио', 'около 24 марта'], ['Киото', 'конец марта'], ['Канадзава', 'начало апреля'], ['Саппоро', 'начало мая']],
    },
    summer: {
      k: '夏', name: 'Лето', sub: 'мацури', months: 'июнь — август', temp: 'Токио, в среднем: 22–27 °C', fx: 'fireflies', tour: 'okinawa',
      text: 'Время фестивалей, фейерверков ханаби и тёплого моря. Июнь — сезон дождей цую, а с августа на юге бывают тайфуны, поэтому страховку берём с покрытием отмены.',
      frontTitle: 'Календарь мацури',
      front: [['Гион-мацури, Киото', 'весь июль, шествия 17 и 24'], ['Фейерверк на реке Сумида, Токио', 'последняя суббота июля'], ['Нэбута-мацури, Аомори', '2–7 августа'], ['Обон, вся страна', 'середина августа']],
    },
    autumn: {
      k: '秋', name: 'Осень', sub: 'момидзи', months: 'сентябрь — ноябрь', temp: 'Токио, в среднем: 13–23 °C', fx: 'leaves', tour: 'tokyo',
      text: 'Клёны момидзи краснеют в обратном порядке: сначала горы Хоккайдо, в самом конце Киото и Токио. Сухо и солнечно, лучшая погода для долгих прогулок.',
      frontTitle: 'Момидзи-фронт: когда краснеют клёны',
      front: [['Дайсэцудзан, Хоккайдо', 'середина — конец сентября'], ['Никко', 'октябрь'], ['Хаконэ', 'ноябрь'], ['Киото', 'вторая половина ноября'], ['Токио', 'конец ноября — начало декабря']],
    },
    winter: {
      k: '冬', name: 'Зима', sub: 'снег и онсэны', months: 'декабрь — февраль', temp: 'Токио, в среднем: 5–8 °C', fx: 'snow', tour: 'hokkaido',
      text: 'Сухой пудровый снег Нисэко, горячие источники под снегопадом и ледяные скульптуры Саппоро. В Токио в это время ясно и почти без осадков.',
      frontTitle: 'Зимний календарь',
      front: [['Сёгацу, японский Новый год', '1–3 января'], ['Сакура на Окинаве', 'середина января'], ['Снежный фестиваль, Саппоро', 'начало февраля'], ['Пудровый снег в Нисэко', 'декабрь — март']],
    },
  };

  const PRESETS = [
    { id: 'classic', name: 'Классика', stops: [['tokyo', 3], ['hakone', 1], ['kyoto', 3], ['nara', 1], ['osaka', 2]] },
    { id: 'north', name: 'Север', stops: [['tokyo', 2], ['nikko', 1], ['sapporo', 3], ['niseko', 3]] },
    { id: 'west', name: 'Запад', stops: [['osaka', 2], ['kyoto', 3], ['hiroshima', 2], ['fukuoka', 2]] },
    { id: 'islands', name: 'Острова', stops: [['tokyo', 2], ['naha', 3], ['ishigaki', 4]] },
  ];

  /* ---------- Звук: пентатоника ин (мияко-буси) ---------- */
  const Sound = (() => {
    const btn = $('#sound');
    const STEPS = [0, 1, 5, 7, 8, 12, 13, 17, 19, 20];
    const BASE = 293.66; // ре первой октавы
    let ctx = null, on = false, last = 0, lastEl = null;

    const ensure = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    const pluck = (step = 0, vol = .05, dur = 1.2) => {
      if (!on) return;
      const c = ensure();
      if (!c) return;
      const now = c.currentTime;
      const f = BASE * Math.pow(2, STEPS[((step % STEPS.length) + STEPS.length) % STEPS.length] / 12);
      const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
      o1.type = 'triangle'; o1.frequency.value = f;
      o2.type = 'sine'; o2.frequency.value = f * 2.005;
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f * 7, now);
      lp.frequency.exponentialRampToValueAtTime(f * 1.4, now + dur);
      g.gain.setValueAtTime(.0001, now);
      g.gain.exponentialRampToValueAtTime(vol, now + .008);
      g.gain.exponentialRampToValueAtTime(.0001, now + dur);
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(c.destination);
      o1.start(now); o2.start(now); o1.stop(now + dur + .05); o2.stop(now + dur + .05);
    };
    const chord = (base = 2) => [0, 2, 4].forEach((s, i) => setTimeout(() => pluck(base + s, .04, 1.8), i * 90));
    const error = () => { pluck(1, .05, .5); setTimeout(() => pluck(0, .05, .6), 120); };
    const set = v => {
      on = v;
      btn.setAttribute('aria-pressed', String(on));
      if (on) { ensure(); chord(); }
    };
    btn.addEventListener('click', () => { set(!on); toast(on ? 'Звук включён: интерфейс звучит в японском ладу ин' : 'Звук выключен'); });
    document.addEventListener('pointerover', e => {
      if (!on || e.pointerType === 'touch') return;
      const el = e.target.closest('[data-sound], .city, .chip, .stab, .tour__hit, .cmd__item');
      if (!el || el === lastEl) return;
      lastEl = el;
      const t = performance.now();
      if (t - last < 60) return;
      last = t;
      pluck(Math.floor(Math.random() * 6), .022, .8);
    });
    document.addEventListener('pointerout', e => { if (lastEl && !lastEl.contains(e.relatedTarget)) lastEl = null; });
    return { pluck, chord, error, toggle: () => set(!on), get on() { return on; } };
  })();

  /* ---------- Частицы сезона ---------- */
  const FX = (() => {
    const c = $('#fx');
    const ctx = c.getContext('2d');
    const PAL = {
      petals: ['#FF9BD2', '#FFC4E4', '#FF7AD9'],
      fireflies: ['#FFE9A3', '#7DF9FF', '#FFD27A'],
      leaves: ['#FF9160', '#FFB86B', '#FF6A5C'],
      snow: ['#E6F6FF', '#7DF9FF', '#BFEFFF'],
    };
    let W = 0, H = 0, dpr = 1, type = 'leaves', parts = [], bursts = [], raf = 0, lastT = 0, fade = 1, heroH = 600;
    const mouse = { x: -9999, y: -9999 };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[(Math.random() * arr.length) | 0];

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      heroH = $('.hero').offsetHeight;
      c.width = W * dpr; c.height = H * dpr;
      const want = Math.round(clamp(W * H / 26000, 16, fine ? 64 : 30));
      while (parts.length < want) parts.push(make(true));
      parts.length = want;
    };
    const make = (fresh, x, y) => {
      const p = {
        x: x ?? rnd(0, W), y: y ?? (fresh ? rnd(0, H) : rnd(-60, -10)),
        s: rnd(.6, 1.25), r: rnd(0, Math.PI * 2), vr: rnd(-.02, .02), ph: rnd(0, Math.PI * 2),
        vx: 0, vy: 0, col: pick(PAL[type]), life: Infinity,
      };
      if (type === 'petals') { p.vy = rnd(.35, .85); p.vx = rnd(-.2, .35); }
      if (type === 'leaves') { p.vy = rnd(.55, 1.1); p.vx = rnd(-.3, .3); p.s *= 1.2; }
      if (type === 'snow') { p.vy = rnd(.25, .75); p.vx = rnd(-.15, .15); p.s = rnd(.4, 1.4); }
      if (type === 'fireflies') { p.vy = rnd(-.25, .1); p.vx = rnd(-.25, .25); }
      return p;
    };
    const drawOne = (p, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.col;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (type === 'petals') {
        ctx.rotate(p.r);
        ctx.scale(p.s, p.s * (.55 + .45 * Math.sin(p.ph)));
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.bezierCurveTo(6, -6, 6, 5, 0, 8);
        ctx.bezierCurveTo(-6, 5, -6, -6, 0, -7);
        ctx.fill();
      } else if (type === 'leaves') {
        ctx.rotate(p.r);
        ctx.scale(p.s * (.6 + .4 * Math.cos(p.ph)), p.s);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const rr = i % 2 ? 3.2 : 8;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-.5, 2, 1, 7);
      } else if (type === 'snow') {
        ctx.beginPath();
        ctx.arc(0, 0, 2.2 * p.s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const blink = .35 + .65 * Math.max(0, Math.sin(p.ph));
        ctx.globalAlpha = alpha * blink;
        ctx.shadowColor = p.col; ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 2 * p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    const move = (p, k) => {
      p.ph += (type === 'fireflies' ? .05 : .03) * k;
      p.r += p.vr * k;
      if (type === 'fireflies') {
        p.vx += rnd(-.02, .02) * k; p.vy += rnd(-.02, .02) * k;
        p.vx = clamp(p.vx, -.5, .5); p.vy = clamp(p.vy, -.5, .4);
      }
      const sway = type === 'leaves' ? Math.sin(p.ph) * .9 : type === 'petals' ? Math.sin(p.ph) * .5 : type === 'snow' ? Math.sin(p.ph) * .25 : 0;
      p.x += (p.vx + sway) * k;
      p.y += p.vy * k;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 12000) {
        const d = Math.sqrt(d2) || 1, f = (1 - d / 110) * 3.2 * k;
        p.x += dx / d * f; p.y += dy / d * f;
      }
    };
    const frame = t => {
      raf = 0;
      const k = clamp((t - (lastT || t)) / 16.67, 0, 3);
      lastT = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      fade += ((window.scrollY < heroH * .7 ? 1 : .35) - fade) * .05;
      for (const p of parts) {
        move(p, k);
        if (p.y > H + 30 || p.x < -40 || p.x > W + 40 || p.y < -80) Object.assign(p, make(false));
        drawOne(p, .85 * fade);
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const p = bursts[i];
        p.vx *= .97; p.vy = p.vy * .97 + (type === 'fireflies' ? -.01 : .04);
        move(p, k);
        p.life -= k;
        if (p.life <= 0) { bursts.splice(i, 1); continue; }
        drawOne(p, Math.min(1, p.life / 40));
      }
      ctx.globalAlpha = 1;
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && !reduced) { lastT = 0; raf = requestAnimationFrame(frame); } };

    const setType = t => {
      if (t === type && parts.length) return;
      type = t;
      parts = parts.map(() => make(true));
    };
    const burst = (x, y) => {
      if (reduced) return;
      const n = fine ? 26 : 18;
      for (let i = 0; i < n; i++) {
        const p = make(false, x, y);
        const a = rnd(0, Math.PI * 2), sp = rnd(1.5, type === 'fireflies' ? 6 : 4.5);
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 1;
        p.life = rnd(60, 110);
        if (type === 'fireflies') p.col = pick(['#FFE9A3', '#FF7AD9', '#7DF9FF', '#A98BFF']);
        bursts.push(p);
      }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    resize();
    start();
    return { setType, burst };
  })();

  /* ---------- Голограмма Японии: облако точек в псевдо-3D ---------- */
  const Holo = (() => {
    const wrap = $('#holo3d'), cvs = $('#holo-canvas'), ctx = cvs.getContext('2d'), tagsEl = $('#holo-tags');
    const LON0 = 136.4, LAT0 = 34.8, K = Math.cos(36 * Math.PI / 180), SC = 1 / 8.5;
    const rings = window.MIRAI_JAPAN || [];
    const boxes = rings.map(r => {
      let a = 999, b = -999, c = 999, d = -999;
      for (let i = 0; i < r.length; i += 2) { a = Math.min(a, r[i]); b = Math.max(b, r[i]); c = Math.min(c, r[i + 1]); d = Math.max(d, r[i + 1]); }
      return [a, b, c, d];
    });
    const inside = (lon, lat) => rings.some((r, k) => {
      const bx = boxes[k];
      if (lon < bx[0] || lon > bx[1] || lat < bx[2] || lat > bx[3]) return false;
      let c = false;
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
        if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    });
    // Рельеф: пик Фудзи и хребет Японских Альп, с голографическим преувеличением
    const FUJI = [138.73, 35.36];
    const relief = (lon, lat) => {
      const dx = (lon - FUJI[0]) * K, dy = lat - FUJI[1];
      const alps = Math.exp(-((((lon - 137.6) * K) ** 2) + (lat - 36.2) ** 2) / .35) * .9;
      return Math.exp(-(dx * dx + dy * dy) / .05) * 3.4 + alps;
    };
    const raw = [];
    const add = (lon, lat, y, type) => raw.push((lon - LON0) * K * SC, y * SC, (lat - LAT0) * SC, type);
    for (let lat = 24; lat <= 45.8; lat += .22) {
      for (let lon = 122.8; lon <= 146.2; lon += .22 / K) if (inside(lon, lat)) add(lon, lat, relief(lon, lat), 0);
    }
    rings.forEach(r => {
      for (let i = 0; i < r.length; i += 2) {
        const j = (i + 2) % r.length;
        const x1 = r[i], y1 = r[i + 1], x2 = r[j], y2 = r[j + 1];
        const n = Math.max(1, Math.round(Math.hypot((x2 - x1) * K, y2 - y1) / .1));
        for (let k = 0; k < n; k++) add(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n, 0, 1);
      }
    });
    for (let rr = .02; rr <= .55; rr += .045) {
      const n = Math.round(rr * 60);
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2;
        const lon = FUJI[0] + Math.cos(a) * rr / K, lat = FUJI[1] + Math.sin(a) * rr;
        add(lon, lat, relief(lon, lat), 2);
      }
    }
    const P = new Float32Array(raw);
    const N = P.length / 4;
    const bx = new Float32Array(N), by = new Float32Array(N), bs = new Float32Array(N), bg = new Uint8Array(N);

    // Главные города: id, тур и высота светового столба (разная, чтобы подписи не слипались)
    const MAIN = [['tokyo', 'tokyo', .52], ['kyoto', 'kyoto', .3], ['sapporo', 'hokkaido', .42], ['naha', 'okinawa', .36]];
    const beams = Object.entries(CITIES).map(([id, c]) => {
      const main = MAIN.find(m => m[0] === id);
      return { id, x: (c.lon - LON0) * K * SC, z: (c.lat - LAT0) * SC, h: main ? main[2] : .16, main: !!main };
    });
    const tags = MAIN.map(([id, tour]) => {
      const c = CITIES[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'htag';
      b.setAttribute('aria-label', `${c.name}: открыть тур`);
      b.innerHTML = `<b aria-hidden="true">${c.k}</b><span>${c.name}</span><small>${c.lat.toFixed(2)}°N · ${c.lon.toFixed(2)}°E</small>`;
      b.addEventListener('click', e => { e.stopPropagation(); Tours.open(tour); });
      tagsEl.appendChild(b);
      return { id, el: b, beam: beams.find(x => x.id === id), w: 0, h: 0 };
    });
    const measure = () => tags.forEach(tg => { tg.w = tg.el.offsetWidth; tg.h = tg.el.offsetHeight; });

    let W = 0, H = 0, dpr = 1, F = 1, cx = 0, cy = 0;
    let yaw = -.35, vel = .12, dragging = false, lastX = 0, dragDist = 0, visible = true, raf = 0, last = 0;
    const PITCH = .98, CAM = 3.6, AUTO = .12;
    const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
    let cs = 1, sn = 0;
    const out = [0, 0, 0];
    const proj = (x, y, z) => {
      const X = x * cs + z * sn, Z = -x * sn + z * cs;
      const up = y * cp + Z * sp, depth = Z * cp - y * sp;
      const f = F / (CAM + depth);
      out[0] = cx + X * f; out[1] = cy - up * f; out[2] = depth;
      return out;
    };

    const resize = () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      if (!W || !H) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
      F = Math.min(W * .36, H * .42) * CAM;
      cx = W / 2; cy = H * .5;
      measure();
      draw(performance.now());
    };

    const draw = t => {
      if (!W) return;
      const dt = Math.min(.05, (t - (last || t)) / 1000);
      last = t;
      if (!dragging && !reduced) { vel += (AUTO - vel) * Math.min(1, dt * 1.2); yaw += vel * dt; }
      cs = Math.cos(yaw); sn = Math.sin(yaw);
      const acc = getComputedStyle(root).getPropertyValue('--accent').trim() || '#FF9160';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // Кольца проектора под картой
      ctx.lineWidth = 1;
      [[1.3, .28, [2, 6]], [1.42, .18, [18, 10]], [1.08, .12, []]].forEach(([r, a, dash]) => {
        ctx.beginPath();
        for (let k = 0; k <= 96; k++) {
          const ang = k / 96 * Math.PI * 2;
          const p = proj(Math.cos(ang) * r, -.06, Math.sin(ang) * r);
          if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        }
        ctx.setLineDash(dash);
        ctx.lineDashOffset = reduced ? 0 : -t / 60;
        ctx.strokeStyle = `rgba(125,249,255,${a})`;
        ctx.stroke();
      });
      ctx.setLineDash([]);
      for (let k = 0; k < 36; k++) {
        const ang = k / 36 * Math.PI * 2;
        const a = proj(Math.cos(ang) * 1.3, -.06, Math.sin(ang) * 1.3), ax = a[0], ay = a[1];
        const b = proj(Math.cos(ang) * 1.36, -.06, Math.sin(ang) * 1.36);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b[0], b[1]);
        ctx.strokeStyle = 'rgba(125,249,255,.35)'; ctx.stroke();
      }

      // Облако точек с яркостью по глубине и сканирующей плоскостью
      const scanZ = reduced ? 9 : ((t / 5200) % 1) * 2.6 - 1.3;
      for (let i = 0; i < N; i++) {
        const o = i * 4, type = P[o + 3];
        const p = proj(P[o], P[o + 1], P[o + 2]);
        let a = clamp(.3 + (.9 - p[2]) * .38, .12, 1);
        if (Math.abs(P[o + 2] - scanZ) < .045) a = 1;
        a *= type === 1 ? 1 : type === 2 ? .95 : .7;
        bx[i] = p[0]; by[i] = p[1]; bs[i] = (type === 2 ? 1.9 : type === 1 ? 1.5 : 1.3) * CAM / (CAM + p[2]);
        bg[i] = type * 4 + Math.min(3, (a * 4) | 0);
      }
      const COLORS = ['#7DF9FF', '#D8FEFF', acc];
      for (let g = 0; g < 12; g++) {
        ctx.fillStyle = COLORS[(g / 4) | 0];
        ctx.globalAlpha = .22 + (g % 4) * .26;
        for (let i = 0; i < N; i++) {
          if (bg[i] !== g) continue;
          const s = bs[i];
          ctx.fillRect(bx[i] - s / 2, by[i] - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;

      // Линия сканирования
      if (!reduced && Math.abs(scanZ) < 1.2) {
        const a = proj(-1.2, 0, scanZ), ax = a[0], ay = a[1];
        const b = proj(1.2, 0, scanZ);
        const gr = ctx.createLinearGradient(ax, ay, b[0], b[1]);
        gr.addColorStop(0, 'rgba(125,249,255,0)');
        gr.addColorStop(.5, 'rgba(125,249,255,.55)');
        gr.addColorStop(1, 'rgba(125,249,255,0)');
        ctx.strokeStyle = gr; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }

      // Световые столбы городов
      beams.forEach(bm => {
        const a = proj(bm.x, 0, bm.z), ax = a[0], ay = a[1];
        const b = proj(bm.x, bm.h, bm.z), bxp = b[0], byp = b[1];
        const col = bm.main ? acc : '#7DF9FF';
        const gr = ctx.createLinearGradient(ax, ay, bxp, byp);
        gr.addColorStop(0, col);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = gr;
        ctx.lineWidth = bm.main ? 2 : 1.2;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bxp, byp); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(ax, ay, bm.main ? 3 : 2, 0, Math.PI * 2); ctx.fill();
        if (bm.main) {
          const ph = reduced ? .5 : (((t / 1400 + bm.x) % 1) + 1) % 1;
          ctx.globalAlpha = 1 - ph;
          ctx.strokeStyle = col; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(ax, ay, 4 + ph * 16, (4 + ph * 16) * cp, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
      ctx.globalCompositeOperation = 'source-over';

      // Подписи над столбами
      // Подписи над столбами: слева от центра смотрят влево, справа — вправо, и не выходят за рамку
      tags.forEach(tg => {
        const p = proj(tg.beam.x, tg.beam.h, tg.beam.z);
        const left = p[0] < cx;
        const x = clamp(left ? p[0] - tg.w - 4 : p[0] + 4, 2, W - tg.w - 2);
        const y = clamp(p[1] - tg.h, 2, H - tg.h - 2);
        tg.el.classList.toggle('is-l', left);
        tg.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        tg.el.style.opacity = p[2] > .45 ? '.5' : '1';
        tg.el.style.zIndex = String(100 - Math.round(p[2] * 40));
      });
    };

    const loop = t => { raf = 0; draw(t); if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(loop); };
    const kick = () => { if (!raf && visible && !reduced) raf = requestAnimationFrame(loop); };

    wrap.addEventListener('pointerdown', e => {
      dragDist = 0;
      if (e.target.closest('.htag')) return;
      dragging = true; lastX = e.clientX; vel = 0;
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      dragDist += Math.abs(dx);
      yaw += dx * .008;
      vel = clamp(dx * .3, -3, 3);
      if (reduced) draw(performance.now());
    }, { passive: true });
    const end = () => { dragging = false; };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(wrap);
    new ResizeObserver(resize).observe(wrap);
    document.addEventListener('visibilitychange', kick);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    resize();
    kick();
    return { justDragged: () => dragDist > 6 };
  })();

  /* ---------- Часы Токио ---------- */
  (() => {
    const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const els = $$('[data-clock]');
    const tick = () => { const s = fmt.format(new Date()); els.forEach(el => { el.textContent = s; }); };
    tick();
    setInterval(tick, 1000);
  })();

  /* ---------- Эффект расшифровки текста ---------- */
  const GLYPHS_JP = 'アイウエオカキクケコサシスセソタチツテトナニヌネハヒフヘホマミムメモヤユヨラリルレロワン';
  const GLYPHS_RU = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789';
  const scramble = (el, dur = 900) => {
    if (reduced) return;
    const text = el.dataset.text || (el.dataset.text = el.textContent);
    const set = el.closest('.hero') ? GLYPHS_JP : GLYPHS_RU;
    const start = performance.now();
    const step = now => {
      const t = clamp((now - start) / dur, 0, 1);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === ' ' || i / text.length < t * 1.15 - .1) out += ch;
        else out += set[(Math.random() * set.length) | 0];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = text;
    };
    requestAnimationFrame(step);
  };

  /* ---------- Терминал в hero ---------- */
  const Term = (() => {
    const el = $('#term');
    let timer = 0;
    const print = lines => {
      clearTimeout(timer);
      const full = lines.join('\n');
      if (reduced) { el.innerHTML = ''; el.textContent = full; return; }
      let i = 0;
      const tick = () => {
        i = Math.min(full.length, i + 2);
        el.textContent = full.slice(0, i);
        const caret = document.createElement('span');
        caret.className = 'caret';
        el.appendChild(caret);
        if (i < full.length) timer = setTimeout(tick, 18);
      };
      tick();
    };
    return { print };
  })();

  /* ---------- HUD: прокрутка, прогресс, линия станций ---------- */
  (() => {
    const hud = $('#hud'), bar = $('#progress'), train = $('#train'), rail = $('#rail');
    const media = $('#hero-media');
    const sections = ['top', 'tours', 'route', 'seasons', 'book'].map(id => document.getElementById(id));
    const stations = $$('.rail__st');
    const navLinks = $$('.hud__nav a');
    let ticking = false, px = 0, py = 0;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(y / max, 0, 1) : 0;
      hud.classList.toggle('is-scrolled', y > 20);
      bar.style.transform = `scaleX(${p})`;
      if (rail.offsetHeight) {
        const h = rail.querySelector('.rail__line').offsetHeight - 22;
        train.style.setProperty('--y', (p * h).toFixed(1) + 'px');
      }
      if (!reduced) {
        const hh = window.innerHeight;
        if (y < hh * 1.2) {
          media.style.setProperty('--py', (y * .25 + py).toFixed(1) + 'px');
          media.style.setProperty('--px', px.toFixed(1) + 'px');
          media.style.setProperty('--ps', (1.04 + y / hh * .08).toFixed(3));
        }
      }
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();

    if (fine && !reduced) {
      $('.hero').addEventListener('pointermove', e => {
        const nx = e.clientX / window.innerWidth - .5, ny = e.clientY / window.innerHeight - .5;
        px = -nx * 18; py = -ny * 12;
        request();
      });
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const i = sections.indexOf(en.target);
        stations.forEach((s, j) => s.classList.toggle('is-active', j === i));
        navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => io.observe(s));

    // Мобильное меню
    const menu = $('#menu'), nav = $('#nav');
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    });
    nav.addEventListener('click', e => {
      if (e.target.closest('a')) { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }
    });
  })();

  /* ---------- Курсор и магнитные кнопки ---------- */
  if (fine && !reduced) {
    const cur = $('#cursor'), label = cur.querySelector('.cursor__label'), xy = $('#cursor-xy');
    let shown = '';
    let x = -100, y = -100, tx = -100, ty = -100;
    window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; cur.classList.add('is-on'); }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
    document.addEventListener('pointerover', e => {
      const lab = e.target.closest('[data-cursor]');
      const hov = e.target.closest('a, button, label, select, input, [role="tab"]');
      cur.classList.toggle('is-label', !!lab);
      cur.classList.toggle('is-hover', !lab && !!hov);
      if (lab) label.textContent = lab.dataset.cursor;
    });
    const loop = () => {
      x += (tx - x) * .2; y += (ty - y) * .2;
      cur.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const txt = `X ${String(Math.max(0, Math.round(tx))).padStart(4, '0')} · Y ${String(Math.max(0, Math.round(ty))).padStart(4, '0')}`;
      if (txt !== shown) { shown = txt; xy.textContent = txt; }
      requestAnimationFrame(loop);
    };
    loop();

    document.addEventListener('pointermove', e => {
      $$('[data-magnetic]').forEach(b => {
        const r = b.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const near = Math.abs(dx) < r.width / 2 + 30 && Math.abs(dy) < r.height / 2 + 30;
        b.style.setProperty('--mx', near ? (dx * .22).toFixed(1) + 'px' : '0px');
        b.style.setProperty('--my', near ? (dy * .32).toFixed(1) + 'px' : '0px');
      });
    }, { passive: true });
  }

  /* ---------- Туры ---------- */
  const Tours = (() => {
    const grid = $('#tours-grid');
    grid.innerHTML = TOURS.map(t => `
      <article class="tour brk reveal" data-id="${t.id}" data-cursor="Открыть">
        <div class="tour__media"><video muted loop playsinline preload="none" poster="${posterOf(t.id)}" aria-hidden="true">${sourcesHTML(t.id)}</video></div>
        <div class="tour__sheen" aria-hidden="true"></div>
        <div class="tour__top">
          <span class="tour__code">${t.code}</span>
          <span class="tour__kanji" aria-hidden="true">${t.kanji}</span>
        </div>
        <div class="tour__hud" aria-hidden="true"><span>${t.coords}</span><span class="tour__live">rec</span></div>
        <div class="tour__body">
          <h3 class="tour__title">${t.title}</h3>
          <p class="tour__cities">${t.cities}</p>
          <div class="tour__row">
            <div class="tour__meta"><span class="tag">${t.days} ${plural(t.days, ['день', 'дня', 'дней'])}</span><span class="tag">${t.best}</span></div>
            <p class="tour__price">от ${nf.format(t.price)} ₽</p>
          </div>
        </div>
        <button class="tour__hit" type="button" aria-label="Программа тура «${t.title}»"></button>
      </article>`).join('');

    const cards = $$('.tour', grid);
    const setPlaying = (card, on) => {
      const v = card.querySelector('video');
      if (on && !reduced) { play(v); card.classList.add('is-playing'); }
      else { v.pause(); card.classList.remove('is-playing'); }
    };

    cards.forEach(card => {
      const hit = card.querySelector('.tour__hit');
      hit.addEventListener('click', () => open(card.dataset.id));
      if (fine) {
        card.addEventListener('pointerenter', () => setPlaying(card, true));
        card.addEventListener('pointerleave', () => {
          setPlaying(card, false);
          card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
        });
        if (!reduced) {
          card.addEventListener('pointermove', e => {
            const r = card.getBoundingClientRect();
            const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
            card.style.setProperty('--ry', ((nx - .5) * 9).toFixed(2) + 'deg');
            card.style.setProperty('--rx', ((.5 - ny) * 9).toFixed(2) + 'deg');
            card.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
            card.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
          });
        }
      }
      hit.addEventListener('focus', () => setPlaying(card, true));
      hit.addEventListener('blur', () => setPlaying(card, false));
    });

    // На телефоне видео включается, когда карточка в центре экрана
    if (!fine) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => setPlaying(en.target, en.isIntersecting));
      }, { threshold: .6 });
      cards.forEach(c => io.observe(c));
    }

    // Модальное окно тура
    const modal = $('#tour-modal'), mv = $('#m-video');
    let current = null;
    const open = id => {
      const t = TOURS.find(x => x.id === id);
      if (!t) return;
      current = t;
      $('#m-eyebrow').innerHTML = `<b class="eyebrow__kanji">${t.kanji}</b>${t.code} · ${t.airport}`;
      $('#m-title').textContent = t.title;
      $('#m-meta').textContent = `${t.days} ${plural(t.days, ['день', 'дня', 'дней'])} · ${t.cities} · лучше всего: ${t.best} · от ${nf.format(t.price)} ₽ на человека`;
      $('#m-days').innerHTML = t.plan.map(([d, txt]) => `<li><b>${d}</b><span>${txt}</span></li>`).join('');
      mv.poster = posterOf(t.id);
      mv.innerHTML = sourcesHTML(t.id);
      mv.load();
      if (!reduced) play(mv);
      modal.showModal();
      Sound.pluck(4, .04, 1.4);
    };
    modal.addEventListener('close', () => mv.pause());
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
    $('#m-close').addEventListener('click', () => modal.close());
    $('#m-book').addEventListener('click', () => { modal.close(); Booking.selectTour(current.id); goTo('#book'); });
    $('#m-route').addEventListener('click', () => { modal.close(); Route.load(current.route); goTo('#route'); });

    return { open };
  })();

  /* ---------- Конструктор маршрута ---------- */
  const Route = (() => {
    const mapEl = $('#map'), cvs = $('#map-canvas'), ctx = cvs.getContext('2d');
    const layer = $('#map-cities'), insetEl = $('#map-inset');
    const listEl = $('#route-list'), sumEl = $('#route-sum'), jrEl = $('#route-jr'), presetsEl = $('#route-presets');
    const MAIN = { lon0: 128.3, lon1: 146.1, lat0: 30.0, lat1: 45.8, k: Math.cos(38 * Math.PI / 180) };
    const INSET = { lon0: 123.4, lon1: 130.0, lat0: 24.0, lat1: 28.9, k: Math.cos(26.5 * Math.PI / 180) };
    const RATE = .55; // ₽ за иену, для расчёта
    let S = 0, dpr = 1, mainT = null, insetT = null, pathMain = null, pathInset = null, dots = new Float32Array(0);
    let visible = false, raf = 0;
    let route = [];
    const listeners = [];

    const km = (a, b) => {
      const R = 6371, toR = Math.PI / 180;
      const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };
    // Ориентировочная модель: синкансэн ~220–240 км/ч, местные линии ~70 км/ч, самолёт для островов и дальних перелётов
    const leg = (aId, bId) => {
      const a = CITIES[aId], b = CITIES[bId];
      const d = km(a, b);
      if (a.inset || b.inset || d > 650) return { air: true, d, h: .5 + d / 750, yen: 0, rub: 12000 };
      const L = d * 1.25;
      let h, yen;
      if (a.sk && b.sk) { h = .25 + L / 240; yen = L * 28; }
      else if (a.sk || b.sk) { const loc = Math.min(L, 50); h = .25 + (L - loc) / 220 + loc / 70; yen = (L - loc) * 28 + loc * 20; }
      else { h = .25 + L / 70; yen = L * 20; }
      return { air: false, d, h, yen: Math.round(yen / 10) * 10, rub: 0 };
    };
    const legs = () => route.slice(1).map((s, i) => leg(route[i].id, s.id));

    const makeT = (b, box) => {
      const bw = (b.lon1 - b.lon0) * b.k, bh = b.lat1 - b.lat0;
      const sc = Math.min(box.w / bw, box.h / bh);
      const ox = box.x + (box.w - bw * sc) / 2, oy = box.y + (box.h - bh * sc) / 2;
      return (lon, lat) => [ox + (lon - b.lon0) * b.k * sc, oy + (b.lat1 - lat) * sc];
    };
    const pos = id => { const c = CITIES[id]; return (c.inset ? insetT : mainT)(c.lon, c.lat); };

    // Кнопки городов
    Object.entries(CITIES).forEach(([id, c]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'city';
      b.dataset.id = id;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span class="city__n"></span>${c.name} <b aria-hidden="true">${c.k}</b>`;
      b.addEventListener('click', () => toggle(id));
      layer.appendChild(b);
    });
    const cityBtns = $$('.city', layer);

    // Подписи городов: перебираем позиции вокруг точки и берём ту, что меньше всего перекрывает соседей
    const labelAt = {};
    const ov = (a, b, p = 3) => {
      const w = Math.min(a[0] + a[2] + p, b[0] + b[2]) - Math.max(a[0] - p, b[0]);
      const h = Math.min(a[1] + a[3] + p, b[1] + b[3]) - Math.max(a[1] - p, b[1]);
      return w > 0 && h > 0 ? w * h : 0;
    };
    const placeCities = () => {
      if (!mainT) return;
      const ids = Object.keys(CITIES);
      const dotsR = ids.map(id => { const [x, y] = pos(id); return [x - 6, y - 6, 12, 12]; });
      const inset = [insetEl.offsetLeft, insetEl.offsetTop, insetEl.offsetWidth, insetEl.offsetHeight];
      const legend = $('.map__legend', mapEl);
      const fixed = [[legend.offsetLeft, legend.offsetTop, legend.offsetWidth, legend.offsetHeight]];
      const inRoute = id => route.some(s => s.id === id);
      const order = [...cityBtns].sort((a, b) => inRoute(b.dataset.id) - inRoute(a.dataset.id));
      const placed = [];
      order.forEach(btn => {
        const id = btn.dataset.id, c = CITIES[id], i = ids.indexOf(id);
        const [x, y] = pos(id);
        const w = btn.offsetWidth, h = btn.offsetHeight;
        const cands = [];
        [8, 24].forEach(g => {
          const d = g * .75;
          const at = {
            r: [x + g, y - h / 2], l: [x - g - w, y - h / 2], t: [x - w / 2, y - g - h], b: [x - w / 2, y + g],
            tr: [x + d, y - d - h], tl: [x - d - w, y - d - h], br: [x + d, y + d], bl: [x - d - w, y + d],
          };
          [...new Set([c.side, 'r', 'l', 't', 'b', 'tr', 'tl', 'br', 'bl'])].forEach((k, j) => {
            cands.push({ r: [at[k][0], at[k][1], w, h], pen: j * 3 + (g > 8 ? 40 : 0) });
          });
        });
        let best = cands[0].r, bestScore = Infinity;
        cands.forEach(cd => {
          const r = cd.r;
          const out = Math.max(0, 4 - r[0]) + Math.max(0, 4 - r[1]) + Math.max(0, r[0] + r[2] - (S - 4)) + Math.max(0, r[1] + r[3] - (S - 4));
          let score = cd.pen + out * 400;
          placed.forEach(o => { score += ov(r, o) * 2; });
          fixed.forEach(o => { score += ov(r, o) * 2; });
          if (!c.inset) score += ov(r, inset, 0) * 2;
          dotsR.forEach((o, j) => { if (j !== i) score += ov(r, o, 0) * 1.5; });
          if (score < bestScore) { bestScore = score; best = r; }
        });
        placed.push(best);
        labelAt[id] = best;
        btn.style.left = best[0].toFixed(1) + 'px';
        btn.style.top = best[1].toFixed(1) + 'px';
      });
    };

    const layout = () => {
      S = mapEl.clientWidth;
      if (!S) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cvs.width = Math.round(S * dpr); cvs.height = Math.round(S * dpr);
      const pad = S * .04;
      mainT = makeT(MAIN, { x: pad, y: pad, w: S - 2 * pad, h: S - 2 * pad });
      const iw = S * .34;
      const ih = iw * ((INSET.lat1 - INSET.lat0) / ((INSET.lon1 - INSET.lon0) * INSET.k));
      const ib = { x: S * .035, y: S * .035, w: iw, h: ih };
      insetT = makeT(INSET, { x: ib.x + 6, y: ib.y + 20, w: ib.w - 12, h: ib.h - 26 });
      insetEl.style.cssText = `left:${ib.x}px;top:${ib.y}px;width:${ib.w}px;height:${ib.h}px`;

      pathMain = new Path2D(); pathInset = new Path2D();
      (window.MIRAI_JAPAN || []).forEach(ring => {
        let maxLat = -90;
        for (let i = 1; i < ring.length; i += 2) maxLat = Math.max(maxLat, ring[i]);
        const isInset = maxLat < 29.2;
        const T = isInset ? insetT : mainT, p = isInset ? pathInset : pathMain;
        for (let i = 0; i < ring.length; i += 2) {
          const [x, y] = T(ring[i], ring[i + 1]);
          if (i) p.lineTo(x, y); else p.moveTo(x, y);
        }
        p.closePath();
      });

      const step = Math.max(4.5, S / 74);
      const tmp = [];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let y = step / 2; y < S; y += step) {
        for (let x = step / 2; x < S; x += step) {
          if (ctx.isPointInPath(pathMain, x, y) || ctx.isPointInPath(pathInset, x, y)) tmp.push(x, y);
        }
      }
      dots = new Float32Array(tmp);
      placeCities();
      draw(performance.now());
    };

    const draw = t => {
      if (!mainT) return;
      const acc = getComputedStyle(root).getPropertyValue('--accent').trim() || '#FF6A3D';
      const HUD = '#7DF9FF', AIR = '#A98BFF';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);

      // Точечная матрица суши и сканирующая линия
      ctx.fillStyle = 'rgba(125,249,255,.2)';
      ctx.beginPath();
      for (let i = 0; i < dots.length; i += 2) ctx.rect(dots[i] - .9, dots[i + 1] - .9, 1.8, 1.8);
      ctx.fill();
      const sweep = reduced ? -999 : ((t / 4600) % 1) * S * 1.3 - S * .15;
      ctx.fillStyle = HUD;
      for (let i = 0; i < dots.length; i += 2) {
        const dd = Math.abs(dots[i + 1] - sweep);
        if (dd < 36) {
          const k = 1 - dd / 36;
          ctx.globalAlpha = .15 + .75 * k;
          ctx.fillRect(dots[i] - 1, dots[i + 1] - 1, 2 + k, 2 + k);
        }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(125,249,255,.45)';
      ctx.lineWidth = 1;
      ctx.stroke(pathMain);
      ctx.stroke(pathInset);

      // Дуги маршрута
      const L = legs();
      for (let i = 0; i < L.length; i++) {
        const [x1, y1] = pos(route[i].id), [x2, y2] = pos(route[i + 1].id);
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const bend = Math.min(70, len * .22) * (L[i].air ? 1 : .5);
        const cx = (x1 + x2) / 2 - dy / len * bend, cy = (y1 + y2) / 2 + dx / len * bend;
        const col = L[i].air ? AIR : acc;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cx, cy, x2, y2);
        ctx.setLineDash(L[i].air ? [3, 6] : [10, 5]);
        ctx.lineDashOffset = reduced ? 0 : -t / 40;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.shadowColor = col; ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.setLineDash([]);
        if (!reduced) {
          const u = (t / 2000 + i * .37) % 1;
          const px = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2;
          const py = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2;
          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill();
        }
      }
      ctx.shadowBlur = 0;

      // Выноски к подписям и точки городов
      ctx.strokeStyle = 'rgba(125,249,255,.5)';
      ctx.lineWidth = 1;
      Object.keys(CITIES).forEach(id => {
        const r = labelAt[id];
        if (!r) return;
        const [x, y] = pos(id);
        const nx = clamp(x, r[0], r[0] + r[2]), ny = clamp(y, r[1], r[1] + r[3]);
        if (Math.hypot(nx - x, ny - y) > 12) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke(); }
      });
      Object.keys(CITIES).forEach(id => {
        const [x, y] = pos(id);
        const idx = route.findIndex(s => s.id === id);
        ctx.beginPath();
        ctx.arc(x, y, idx >= 0 ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = idx >= 0 ? acc : 'rgba(230,246,255,.9)';
        ctx.fill();
        if (idx >= 0 && !reduced) {
          const ph = (t / 1100 + idx * .2) % 1;
          ctx.beginPath(); ctx.arc(x, y, 6 + ph * 14, 0, Math.PI * 2);
          ctx.strokeStyle = acc; ctx.globalAlpha = 1 - ph; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
    };
    const loop = t => { raf = 0; draw(t); if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(loop); };
    const kick = () => { if (!raf && visible && !reduced) raf = requestAnimationFrame(loop); };

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(mapEl);
    new ResizeObserver(() => layout()).observe(mapEl);
    document.addEventListener('visibilitychange', kick);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (mainT) placeCities(); });

    // Список, итоги, JR Pass
    PRESETS.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.preset = p.id;
      b.setAttribute('aria-pressed', 'false');
      b.textContent = p.name;
      b.title = p.stops.map(([id]) => CITIES[id].name).join(' → ');
      b.addEventListener('click', () => { load(p.stops); Sound.chord(1); });
      presetsEl.appendChild(b);
    });

    const render = () => {
      const L = legs();
      if (!route.length) {
        listEl.innerHTML = '<li class="legs__empty">Маршрут пуст. Нажмите на город на карте или выберите готовый вариант выше.</li>';
      } else {
        listEl.innerHTML = route.map((s, i) => {
          const c = CITIES[s.id];
          const stop = `<li class="stop">
            <span class="stop__n">${String(i + 1).padStart(2, '0')}</span>
            <span class="stop__name">${c.name}<small aria-hidden="true">${c.k}</small></span>
            <span class="nights" role="group" aria-label="Ночей в городе ${c.name}">
              <button type="button" data-act="dec" data-i="${i}" aria-label="Меньше ночей">−</button>
              <span>${s.nights} ${plural(s.nights, ['ночь', 'ночи', 'ночей'])}</span>
              <button type="button" data-act="inc" data-i="${i}" aria-label="Больше ночей">+</button>
            </span>
            <button class="stop__x" type="button" data-act="del" data-i="${i}" aria-label="Убрать ${c.name} из маршрута">×</button>
          </li>`;
          const l = L[i];
          const legHtml = l ? `<li class="leg ${l.air ? 'leg--air' : ''}"><span class="leg__mode">${l.air ? 'перелёт' : 'поезд'}</span><span>${fmtHours(l.h)}</span><span>${nf.format(Math.round(l.d))} км</span>${l.air ? `<span>≈ ${nf.format(l.rub)} ₽</span>` : `<span>≈ ${nf.format(l.yen)} ¥</span>`}</li>` : '';
          return stop + legHtml;
        }).join('');
      }

      const nights = route.reduce((s, x) => s + x.nights, 0);
      const hours = L.reduce((s, l) => s + l.h, 0);
      const dist = L.reduce((s, l) => s + l.d, 0);
      const yen = L.reduce((s, l) => s + l.yen, 0);
      const air = L.reduce((s, l) => s + l.rub, 0);
      const total = route.length ? 92000 + nights * 13500 + air + yen * RATE : 0;
      sumEl.innerHTML = `
        <div><dt>Городов</dt><dd>${route.length}</dd></div>
        <div><dt>Ночей / дней</dt><dd>${nights} / ${route.length ? nights + 1 : 0}</dd></div>
        <div><dt>В пути</dt><dd>${L.length ? fmtHours(hours) : '—'}</dd></div>
        <div><dt>Расстояние</dt><dd>${L.length ? nf.format(Math.round(dist)) + ' км' : '—'}</dd></div>
        <div class="sum__total"><dt>Ориентировочно на человека</dt><dd>${route.length ? '≈ ' + nf.format(Math.round(total / 1000) * 1000) + ' ₽' : '—'}</dd></div>`;

      const days = nights + 1;
      const pass = days <= 7 ? [50000, 7] : days <= 14 ? [80000, 14] : [100000, 21];
      if (route.length < 2) jrEl.innerHTML = 'Добавьте хотя бы два города, и мы подскажем, нужен ли JR Pass.';
      else if (!yen) jrEl.innerHTML = 'На этом маршруте нет поездов, только перелёты. <b>JR Pass не понадобится.</b>';
      else if (yen > pass[0]) jrEl.innerHTML = `Поезда по маршруту стоят ≈ ${nf.format(yen)} ¥. <b>JR Pass на ${pass[1]} дней выгоднее</b>: он стоит ${nf.format(pass[0])} ¥.`;
      else jrEl.innerHTML = `Поезда по маршруту стоят ≈ ${nf.format(yen)} ¥, а JR Pass на ${pass[1]} дней стоит ${nf.format(pass[0])} ¥. <b>Выгоднее купить билеты отдельно.</b>`;

      cityBtns.forEach(b => {
        const idx = route.findIndex(s => s.id === b.dataset.id);
        const c = CITIES[b.dataset.id];
        b.classList.toggle('is-on', idx >= 0);
        b.setAttribute('aria-pressed', String(idx >= 0));
        b.querySelector('.city__n').textContent = idx >= 0 ? idx + 1 : '';
        b.setAttribute('aria-label', idx >= 0 ? `${c.name}, остановка ${idx + 1}. Нажмите, чтобы убрать` : `${c.name}. Нажмите, чтобы добавить в маршрут`);
      });
      const key = route.map(s => s.id + s.nights).join();
      $$('.chip', presetsEl).forEach(b => {
        const p = PRESETS.find(x => x.id === b.dataset.preset);
        b.setAttribute('aria-pressed', String(p.stops.map(([id, n]) => id + n).join() === key));
      });
      placeCities();
      if (!visible || reduced) draw(performance.now());
      listeners.forEach(fn => fn());
    };

    const toggle = id => {
      const i = route.findIndex(s => s.id === id);
      if (i >= 0) { route.splice(i, 1); Sound.pluck(0, .04, .7); }
      else {
        route.push({ id, nights: CITIES[id].n });
        Sound.pluck(route.length + 2, .05, 1.3);
      }
      render();
    };
    const load = stops => { route = stops.map(([id, nights]) => ({ id, nights })); render(); };

    listEl.addEventListener('click', e => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const i = +b.dataset.i, s = route[i];
      if (!s) return;
      if (b.dataset.act === 'del') { route.splice(i, 1); Sound.pluck(0, .04, .7); }
      if (b.dataset.act === 'inc') { s.nights = Math.min(14, s.nights + 1); Sound.pluck(5, .03, .6); }
      if (b.dataset.act === 'dec') { s.nights = Math.max(1, s.nights - 1); Sound.pluck(3, .03, .6); }
      render();
    });
    $('#route-reset').addEventListener('click', () => { route = []; render(); });
    $('#route-book').addEventListener('click', () => {
      if (!route.length) { toast('Сначала добавьте в маршрут хотя бы один город'); Sound.error(); return; }
      Booking.selectTour('custom');
      goTo('#book');
    });

    load(PRESETS[0].stops);
    return {
      load,
      stops: () => route.map(s => s.id),
      describe: () => route.map(s => CITIES[s.id].name).join(' → '),
      onChange: fn => listeners.push(fn),
    };
  })();

  /* ---------- Сезоны ---------- */
  const Seasons = (() => {
    const tabs = $('#season-tabs'), panel = $('#season-panel');
    const ids = Object.keys(SEASONS);
    let cur = null;

    tabs.innerHTML = ids.map(id => {
      const s = SEASONS[id];
      return `<button class="stab" type="button" role="tab" id="tab-${id}" data-id="${id}" aria-controls="season-panel" aria-selected="false" tabindex="-1">
        <span class="stab__k" aria-hidden="true">${s.k}</span>
        <span class="stab__t"><b>${s.name}</b><span>${s.sub} · ${s.months}</span></span>
      </button>`;
    }).join('');
    const tabBtns = $$('.stab', tabs);

    const set = (id, opts = {}) => {
      if (!SEASONS[id]) return;
      const s = SEASONS[id];
      const changed = cur !== id;
      cur = id;
      root.dataset.season = id;
      tabBtns.forEach(b => {
        const on = b.dataset.id === id;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', 'tab-' + id);
      const tour = TOURS.find(t => t.id === s.tour);
      panel.innerHTML = `
        <span class="sp__big" aria-hidden="true">${s.k}</span>
        <div class="sp__head">
          <p class="eyebrow"><b class="eyebrow__kanji">${s.k}</b>Режим «${s.sub}» включён</p>
          <h3 class="sp__title">${s.name} · ${s.sub}</h3>
          <div class="sp__facts"><span class="tag">${s.months}</span><span class="tag">${s.temp}</span></div>
        </div>
        <p class="sp__text">${s.text}</p>
        <div class="front">
          <h4>${s.frontTitle}</h4>
          <ol>${s.front.map(([place, when], i) => `<li style="--i:${i}"><span>${place}</span><span>${when}</span></li>`).join('')}</ol>
        </div>
        <div><button class="btn btn--ghost" type="button" data-open-tour="${tour.id}" data-sound>Тур сезона: ${tour.title}</button></div>`;
      if (changed && !reduced) {
        panel.classList.remove('is-swap');
        void panel.offsetWidth;
        panel.classList.add('is-swap');
      }
      $('#season-readout').textContent = `${s.name} · ${s.k}`;
      FX.setType(s.fx);
      store.set('season', id);
      if (opts.sound) Sound.chord(ids.indexOf(id) + 1);
      if (opts.sound) printTerm();
    };

    // Смена сезона с круговой волной (View Transitions API, где поддерживается)
    const switchTo = (id, x, y) => {
      if (id === cur) return;
      if (!document.startViewTransition || reduced) { set(id, { sound: true }); return; }
      const cx = x ?? window.innerWidth / 2, cy = y ?? window.innerHeight / 2;
      const r = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
      root.classList.add('vt-season');
      const vt = document.startViewTransition(() => set(id, { sound: true }));
      vt.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${r}px at ${cx}px ${cy}px)`] },
          { duration: 850, easing: 'cubic-bezier(.2,.7,.1,1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
      vt.finished.finally(() => root.classList.remove('vt-season'));
    };

    tabs.addEventListener('click', e => {
      const b = e.target.closest('.stab');
      if (!b) return;
      const r = b.getBoundingClientRect();
      switchTo(b.dataset.id, r.left + r.width / 2, r.top + r.height / 2);
    });
    tabs.addEventListener('keydown', e => {
      const i = tabBtns.findIndex(b => b.dataset.id === cur);
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabBtns.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabBtns.length) % tabBtns.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = tabBtns.length - 1;
      if (j < 0) return;
      e.preventDefault();
      tabBtns[j].focus();
      switchTo(tabBtns[j].dataset.id);
    });
    panel.addEventListener('click', e => {
      const b = e.target.closest('[data-open-tour]');
      if (b) Tours.open(b.dataset.openTour);
    });

    const m = new Date().getMonth();
    const byMonth = m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
    const saved = store.get('season');
    set(SEASONS[saved] ? saved : byMonth);
    return { set, switchTo, get current() { return cur; } };
  })();

  function printTerm() {
    const s = SEASONS[Seasons.current];
    Term.print([
      '> MIRAI OS 2099.4 · загрузка',
      '> синхронизация с Токио (JST, UTC+9) … ок',
      `> сезон: ${s.name.toLowerCase()} ${s.k} · ${s.sub}`,
      '> маршрут готов к построению',
    ]);
  }
  setTimeout(printTerm, BOOT_MS);

  /* ---------- Hero: касание вызывает сезонный всплеск ---------- */
  $('.hero').addEventListener('click', e => {
    if (e.target.closest('a, button, input, select, label') || Holo.justDragged()) return;
    FX.burst(e.clientX, e.clientY);
    Sound.chord(Object.keys(SEASONS).indexOf(Seasons.current) + 2);
  });

  /* ---------- Заявка и посадочный талон ---------- */
  const Booking = (() => {
    const form = $('#book-form');
    const fName = $('#f-name'), fEmail = $('#f-email'), fTour = $('#f-tour'), fMonth = $('#f-month');
    const paxOut = $('#f-pax');
    const pass = $('#pass'), stamp = $('#p-stamp'), code = $('#p-code');
    const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    const MON = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
    // Транслитерация как в загранпаспорте РФ (ICAO Doc 9303)
    const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: 'ie', ы: 'y', ь: '', э: 'e', ю: 'iu', я: 'ia' };
    const translit = s => [...s.toLowerCase()].map(ch => (ch in TR ? TR[ch] : ch)).join('')
      .replace(/[^a-z0-9 '\-]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
    let pax = 2;

    fTour.innerHTML = TOURS.map(t => `<option value="${t.id}">${t.title}</option>`).join('') + '<option value="custom">Свой маршрут</option>';
    const now = new Date();
    fMonth.innerHTML = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
      return `<option value="${d.getFullYear()}-${d.getMonth()}">${MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`;
    }).join('');
    fMonth.selectedIndex = 1;

    const drawCode = seed => {
      const w = code.clientWidth, h = code.clientHeight;
      if (!w) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      code.width = w * dpr; code.height = h * dpr;
      const c = code.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#E6F6FF';
      let s = seed || 1, x = 0;
      const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
      while (x < w) {
        const bw = 1 + Math.floor(rand() * 3);
        if (rand() > .38) c.fillRect(x, 0, bw, h);
        x += bw + 1 + Math.floor(rand() * 2);
      }
    };

    const update = () => {
      const name = translit(fName.value);
      const pName = $('#p-name');
      pName.textContent = name || 'ANNA SMIRNOVA';
      pName.style.opacity = name ? '1' : '.45';
      let to, city, title;
      if (fTour.value === 'custom') {
        const stops = Route.stops();
        const first = CITIES[stops[0] || 'tokyo'];
        to = first.ap; city = first.apName;
        title = stops.length ? 'Свой маршрут: ' + Route.describe() : 'Свой маршрут';
      } else {
        const t = TOURS.find(x => x.id === fTour.value);
        to = t.code; city = t.airport; title = `${t.title} · ${t.days} ${plural(t.days, ['день', 'дня', 'дней'])}`;
      }
      const [yy, mm] = fMonth.value.split('-').map(Number);
      const cls = form.elements.cls.value;
      const h = fnv([name, fTour.value, fMonth.value, cls, pax].join('|'));
      const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let pnr = '', hh = h;
      for (let i = 0; i < 6; i++) { pnr += ABC[hh % ABC.length]; hh = Math.floor(hh / ABC.length) ^ (i * 2654435761 >>> 0); hh >>>= 0; }
      $('#p-to').textContent = to;
      $('#p-to-city').textContent = city;
      $('#p-date').textContent = `${MON[mm]} ${yy}`;
      $('#p-cls').textContent = cls;
      $('#p-seat').textContent = `${12 + (h % 36)}${'ABCDEFGHK'[(h >>> 8) % 9]}`;
      $('#p-gate').textContent = `${'ABCDE'[(h >>> 12) % 5]}${1 + ((h >>> 16) % 32)}`;
      $('#p-pax').textContent = pax;
      $('#p-pnr').textContent = pnr;
      $('#p-flight').textContent = 'MR ' + (100 + (h % 900));
      $('#p-tour').textContent = title;
      drawCode(h);
      return pnr;
    };

    const clearStamp = () => { if (!stamp.hidden) stamp.hidden = true; };
    form.addEventListener('input', () => { update(); clearStamp(); });
    form.addEventListener('change', () => { update(); clearStamp(); });
    $('#f-pax-minus').addEventListener('click', () => { pax = Math.max(1, pax - 1); paxOut.textContent = pax; update(); clearStamp(); });
    $('#f-pax-plus').addEventListener('click', () => { pax = Math.min(8, pax + 1); paxOut.textContent = pax; update(); clearStamp(); });
    Route.onChange(() => { if (fTour.value === 'custom') update(); });
    new ResizeObserver(() => update()).observe(code);

    const setErr = (input, msg) => {
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      const err = $('#' + input.id + '-err');
      err.textContent = msg;
      if (msg) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const nameOk = /[a-zа-яё]{2,}/i.test(fName.value.trim());
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fEmail.value.trim());
      setErr(fName, nameOk ? '' : 'Введите имя и фамилию, как в загранпаспорте.');
      setErr(fEmail, emailOk ? '' : 'Проверьте email: в нём должны быть @ и домен, например anna@example.ru.');
      if (!nameOk || !emailOk) {
        (nameOk ? fEmail : fName).focus();
        Sound.error();
        return;
      }
      const pnr = update();
      $('#p-stamp-meta').textContent = `бронь ${pnr} · ${new Date().toLocaleDateString('ru-RU')}`;
      stamp.hidden = false;
      pass.classList.remove('is-flash'); void pass.offsetWidth; pass.classList.add('is-flash');
      Sound.chord(4);
      FX.burst(pass.getBoundingClientRect().left + pass.offsetWidth / 2, pass.getBoundingClientRect().top + 60);
      toast('Заявка сформирована. Это демо-версия: данные никуда не отправлены.');
    });

    if (fine && !reduced) {
      pass.addEventListener('pointermove', e => {
        const r = pass.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
        pass.style.setProperty('--ry', ((nx - .5) * 14).toFixed(2) + 'deg');
        pass.style.setProperty('--rx', ((.5 - ny) * 12).toFixed(2) + 'deg');
        pass.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
        pass.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
      });
      pass.addEventListener('pointerleave', () => { pass.style.setProperty('--rx', '0deg'); pass.style.setProperty('--ry', '0deg'); });
    }

    const selectTour = id => { fTour.value = id; update(); clearStamp(); };
    update();
    return { selectTour };
  })();

  /* ---------- Командная строка ---------- */
  (() => {
    const dlg = $('#cmd'), input = $('#cmd-input'), list = $('#cmd-list');
    let items = [], sel = 0;
    const commands = () => [
      ...TOURS.map(t => ({ k: t.kanji[0], label: `Тур: ${t.title}`, tag: 'тур', words: t.cities, run: () => Tours.open(t.id) })),
      ...Object.entries(SEASONS).map(([id, s]) => ({ k: s.k, label: `Сезон: ${s.name.toLowerCase()} · ${s.sub}`, tag: 'сезон', words: s.months, run: () => { goTo('#seasons'); Seasons.switchTo(id); } })),
      ...PRESETS.map(p => ({ k: '道', label: `Маршрут: ${p.name.toLowerCase()}`, tag: 'маршрут', words: p.stops.map(([id]) => CITIES[id].name).join(' '), run: () => { Route.load(p.stops); goTo('#route'); } })),
      { k: '旅', label: 'Перейти к турам', tag: 'раздел', words: 'каталог', run: () => goTo('#tours') },
      { k: '道', label: 'Перейти к карте маршрута', tag: 'раздел', words: 'конструктор карта', run: () => goTo('#route') },
      { k: '予', label: 'Оформить заявку', tag: 'раздел', words: 'бронь талон поездка', run: () => { goTo('#book'); setTimeout(() => $('#f-name').focus({ preventScroll: true }), 600); } },
      { k: '音', label: Sound.on ? 'Выключить звук' : 'Включить звук', tag: 'звук', words: 'музыка', run: () => $('#sound').click() },
    ];
    const render = () => {
      const q = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      items = commands().filter(c => { const hay = (c.label + ' ' + c.words + ' ' + c.tag).toLowerCase(); return q.every(w => hay.includes(w)); });
      sel = clamp(sel, 0, Math.max(0, items.length - 1));
      list.innerHTML = items.length
        ? items.map((c, i) => `<li class="cmd__item" role="option" id="cmd-${i}" data-i="${i}" aria-selected="${i === sel}"><b aria-hidden="true">${c.k}</b><span>${c.label}</span><small>${c.tag}</small></li>`).join('')
        : '<li class="cmd__empty">Ничего не нашлось. Попробуйте «Киото», «снег» или «маршрут».</li>';
      input.setAttribute('aria-activedescendant', items.length ? 'cmd-' + sel : '');
      const cur = list.querySelector('[aria-selected="true"]');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    };
    const run = i => { const c = items[i]; if (!c) return; dlg.close(); setTimeout(c.run, 60); };
    const open = () => { if (dlg.open) return; input.value = ''; sel = 0; render(); dlg.showModal(); input.focus(); Sound.pluck(6, .03, .9); };

    $('#cmd-open').addEventListener('click', open);
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, items.length); render(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(1, items.length); render(); }
      if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    });
    list.addEventListener('click', e => { const li = e.target.closest('.cmd__item'); if (li) run(+li.dataset.i); });
    list.addEventListener('pointermove', e => {
      const li = e.target.closest('.cmd__item');
      if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; render(); }
    });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    document.addEventListener('keydown', e => {
      const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        open();
      }
    });
  })();

  /* ---------- Появление при прокрутке и расшифровка заголовков ---------- */
  (() => {
    const els = $$('.sec-head, .map, .planner, .seasons__tabs, .seasons__panel, .steps, .form, .pass-wrap, .tour');
    els.forEach(el => el.classList.add('reveal'));
    if (reduced) return;
    const vh = window.innerHeight;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.remove('is-pre');
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => {
      if (el.getBoundingClientRect().top > vh) { el.classList.add('is-pre'); io.observe(el); }
    });

    const titles = $$('.sec-title[data-scramble]');
    const tio = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { scramble(en.target, 800); tio.unobserve(en.target); } });
    }, { threshold: .6 });
    titles.forEach(t => tio.observe(t));

    $$('.hero [data-scramble]').forEach((el, i) => setTimeout(() => scramble(el, 1100), BOOT_MS + 150 + i * 250));
  })();

  /* ---------- Видео hero ---------- */
  (() => {
    const v = $('#hero-video');
    if (reduced) v.removeAttribute('autoplay'), v.pause();
    else play(v);
  })();
})();
