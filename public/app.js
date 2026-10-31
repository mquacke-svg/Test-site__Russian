// Только удобства интерфейса. Данные магазина изменяют обычные серверные формы.
const menuButton = document.querySelector('[data-menu-toggle]');
const mobileMenu = document.getElementById('mobile-navigation');
function closeMenu() {
    if (!menuButton || !mobileMenu) return;
    mobileMenu.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Открыть меню');
}
menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    mobileMenu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
});
mobileMenu?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileMenu && !mobileMenu.hidden) {
        closeMenu();
        menuButton.focus();
    }
});

// Нативный dialog обеспечивает удержание фокуса и закрытие клавишей Escape.
document.querySelectorAll('[data-dialog]').forEach(button => {
    button.addEventListener('click', () => {
        const dialog = document.getElementById(button.dataset.dialog);
        if (!dialog) return;
        dialog.showModal();
        document.body.classList.add('dialog-open');
        dialog.addEventListener('close', () => {
            document.body.classList.remove('dialog-open');
            button.focus();
        }, { once: true });
    });
});
document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close-dialog]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.querySelectorAll('input[name="variantId"]').forEach(input => input.addEventListener('change', () => {
        dialog.querySelectorAll('.variant-picker label').forEach(label => label.classList.toggle('selected', label.contains(input)));
        const submit = dialog.querySelector('[data-product-submit]');
        if (submit && !submit.disabled) submit.textContent = 'В корзину · ' + input.dataset.price;
    }));
});

const catalog = document.querySelector('[data-catalog]');
if (catalog) {
    const search = catalog.querySelector('[data-catalog-search]');
    const clear = catalog.querySelector('[data-clear-search]');
    const buttons = [...catalog.querySelectorAll('[data-filter]')];
    const entries = [...catalog.querySelectorAll('.product-entry')];
    const plural = new Intl.PluralRules('ru');
    function filterCatalog() {
        const hash = window.location.hash.slice(1);
        const filter = buttons.some(button => button.dataset.filter === hash) ? hash : 'all';
        const query = search.value.trim().toLocaleLowerCase('ru');
        let count = 0;
        entries.forEach(entry => {
            const visible = (filter === 'all' || entry.dataset.category === filter) && entry.dataset.search.toLocaleLowerCase('ru').includes(query);
            entry.hidden = !visible;
            if (visible) count++;
        });
        buttons.forEach(button => {
            const active = button.dataset.filter === filter;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        const returnTo = location.pathname + location.search + (filter === 'all' ? '' : '#' + filter);
        catalog.querySelectorAll('input[name="returnTo"]').forEach(input => { input.value = returnTo; });
        const word = { one: 'позиция', few: 'позиции', many: 'позиций', other: 'позиции' }[plural.select(count)];
        catalog.querySelector('[data-catalog-count]').textContent = `${count} ${word} · Свежая выпечка каждый день`;
        catalog.querySelector('[data-catalog-empty]').hidden = count > 0;
        clear.hidden = !search.value;
    }
    function chooseFilter(filter) {
        const url = new URL(location.href);
        url.hash = filter === 'all' ? '' : filter;
        if (url.href !== location.href) history.pushState(null, '', url);
        filterCatalog();
    }
    buttons.forEach(button => button.addEventListener('click', () => chooseFilter(button.dataset.filter)));
    search.addEventListener('input', filterCatalog);
    clear.addEventListener('click', () => { search.value = ''; filterCatalog(); search.focus(); });
    catalog.querySelector('[data-reset-catalog]').addEventListener('click', () => { search.value = ''; chooseFilter('all'); search.focus(); });
    window.addEventListener('hashchange', filterCatalog);
    window.addEventListener('popstate', filterCatalog);
    filterCatalog();
}

document.querySelector('[data-admin-search]')?.addEventListener('input', event => {
    const query = event.target.value.trim().toLocaleLowerCase('ru');
    document.querySelectorAll('[data-admin-product]').forEach(row => { row.hidden = !row.dataset.adminProduct.toLocaleLowerCase('ru').includes(query); });
});

const variants = document.querySelector('[data-variants]');
if (variants) {
    let nextIndex = Math.max(-1, ...[...variants.querySelectorAll('input[name]')].map(input => Number(input.name.match(/\[(\d+)\]/)?.[1] ?? -1))) + 1;
    document.querySelector('[data-add-variant]').addEventListener('click', () => {
        if (variants.children.length >= 20) return;
        const index = nextIndex++;
        const id = crypto.randomUUID();
        const row = document.createElement('div');
        row.className = 'admin-variant variant-editor';
        row.innerHTML = `<input type="hidden" name="variants[${index}][id]" value="${id}"><label class="form-field">Название<input name="variants[${index}][label]" value="250 мл" required maxlength="60"></label><label class="form-field">Объём, мл<input name="variants[${index}][volumeMl]" type="number" value="250" min="1" max="10000" required></label><label class="form-field">Цена, ₽<input name="variants[${index}][priceRub]" type="number" min="0.01" step="0.01" required></label><button type="button" class="icon-button" data-remove-variant aria-label="Удалить вариант">×</button>`;
        variants.append(row);
        row.querySelector('input:not([type="hidden"])').focus();
    });
    variants.addEventListener('click', event => {
        const button = event.target.closest('[data-remove-variant]');
        if (!button) return;
        button.closest('.variant-editor').remove();
        document.querySelector('[data-add-variant]').focus();
    });
}
