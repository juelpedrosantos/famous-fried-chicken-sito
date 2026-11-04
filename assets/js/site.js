/**
 * Sito vetrina: riempie prezzi, salse, più ordinati e orari a partire dai dati del menu
 * (FFC_MENU) e gestisce header e animazioni allo scroll. Senza dati restano i testi di base.
 */
(function (root) {
  'use strict';

  const L = root.FFCLogic;
  const menu = root.FFC_MENU;
  const SAUCE_CATEGORY = 'salse-dip';
  // Stesso ordine del termometro esposto nel locale: dalla più piccante alla più delicata.
  const THERMOMETER_ORDER = ['Atomic Sauce', 'Louisiana Sauce', 'Spicy Mayo', 'Mango e Habanero', 'Lemon Pepper', 'Famous Sauce',
    'Sweetchili', 'Honey Mustard', 'Smoked BBQ', 'Ranch Sauce', 'New York Sauce', 'Truffle Mayo'];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function category(slug) {
    return menu.categories.find((c) => c.slug === slug);
  }

  function fillStatus() {
    const now = L.romeNow(new Date());
    const status = L.openStatus(menu.business.hours, now);
    $$('[data-open-status]').forEach((el) => {
      el.classList.toggle('is-open', status.open);
      el.classList.toggle('is-closed', !status.open);
      if (status.open) el.textContent = `Aperto ora · fino alle ${status.until}`;
      else if (status.next) el.textContent = `Chiuso ora · riapre alle ${status.next}`;
    });
  }

  function fillSauces() {
    const cat = category(SAUCE_CATEGORY);
    const box = $('[data-sauces]');
    if (!cat || !box) return;
    const byName = new Map(cat.items.map((i) => [i.name.toLowerCase(), i]));
    const sauces = THERMOMETER_ORDER.map((n) => byName.get(n.toLowerCase())).filter((i) => i && i.available);
    if (!sauces.length) return;
    const last = Math.max(sauces.length - 1, 1);
    box.innerHTML = `
      <div class="thermo">
        <img class="thermo__img" src="assets/img/brand/termometro.webp" alt="Termometro del piccante Famous" width="520" height="1325" loading="lazy">
        <ol class="thermo__list" aria-label="Salse dalla più piccante alla più delicata">
          ${sauces.map((s, i) => `<li style="--heat:${(i / last).toFixed(3)}">${L.escapeHtml(s.name)}</li>`).join('')}
        </ol>
      </div>`;
    const count = `${cat.items.filter((i) => i.available).length} salse dip`;
    $$('[data-sauce-count], [data-sauce-pill]').forEach((el) => { el.textContent = count; });
  }

  function fillBestSellers() {
    const list = $('[data-best-sellers]');
    const items = (menu.bestSellers || []).map((id) => L.findItem(menu, id)).filter((i) => i && i.available);
    if (!list || !items.length) return;
    list.innerHTML = items.map((item, index) => `
      <li class="reveal">
        <article class="best-card">
          <span class="best-card__media">
            ${item.image ? `<img src="${L.escapeHtml(item.image)}" alt="${L.escapeHtml(item.name)}" width="640" height="640" loading="lazy">` : ''}
            <span class="best-card__rank" aria-hidden="true">${index + 1}</span>
          </span>
          <span class="best-card__body">
            <span class="best-card__name">${L.escapeHtml(item.name)}</span>
            ${item.description ? `<span class="best-card__desc">${L.escapeHtml(item.description)}</span>` : ''}
          </span>
        </article>
      </li>`).join('');
  }

  function fillHours() {
    const hours = [...menu.business.hours].sort((a, b) => a.day - b.day);
    if (!hours.length) return;
    const today = L.romeNow(new Date()).day;
    const list = $('[data-hours]');
    if (list) {
      list.innerHTML = hours.map((h) => `
        <li class="${h.day === today ? 'is-today' : ''}"><span>${L.dayName(h.day)}</span><strong>${L.displayTime(h.open)} – ${L.displayTime(h.close)}</strong></li>`).join('');
    }
    const opens = new Set(hours.map((h) => h.open));
    if (opens.size === 1) {
      $$('[data-hours-inline]').forEach((el) => { el.textContent = `Aperti tutti i giorni dalle ${L.displayTime(hours[0].open)}.`; });
    }
  }

  function setupHeader() {
    const header = $('[data-header]');
    const hero = $('.hero');
    if (!header || !hero) return;
    const observer = new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-solid', !entry.isIntersecting);
    }, { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` });
    observer.observe(hero);
  }

  const PROMO_KEY = 'ffc-promo-visto';

  /**
   * true se il popup è già comparso in questa visita (stessa scheda): così non ritorna
   * navigando nel sito o tornando da Qromo, ma ricompare a ogni nuova apertura del sito.
   */
  function promoSeenThisVisit() {
    try {
      const seen = root.sessionStorage.getItem(PROMO_KEY) === '1';
      root.sessionStorage.setItem(PROMO_KEY, '1');
      return seen;
    } catch (err) {
      return false; // archiviazione non disponibile: il popup compare
    }
  }

  /** Popup della Fidelity Card: a ogni nuova apertura del sito, una volta per visita. */
  function setupPromo() {
    const promo = $('[data-promo]');
    if (!promo || typeof promo.showModal !== 'function' || promoSeenThisVisit()) return;
    promo.showModal();
    promo.addEventListener('click', (event) => {
      if (event.target === promo || event.target.closest('[data-promo-close], a')) promo.close();
    });
  }

  if (menu && Array.isArray(menu.categories) && L) {
    fillStatus();
    fillSauces();
    fillBestSellers();
    fillHours();
  }
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  setupHeader();
  setupPromo();
})(typeof self !== 'undefined' ? self : this);
