/**
 * Template HTML del menu. Ogni testo che arriva dai dati passa da escapeHtml.
 * Espone window.FFCRender; dipende da window.FFCLogic.
 */
(function (root) {
  'use strict';

  const { escapeHtml: esc } = root.FFCLogic;
  const MAX_SPICE = 4;
  const ASSET_BASE = '../';

  const ICONS = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.8 6.3 20l1.4-6.3L2.9 9.4l6.4-.7z" fill="currentColor"/></svg>',
    chili: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 7.2c3 .3 4.8 3 4.1 6.5-.9 4.4-5.7 8-12.1 8.6-1 .1-1.3-.9-.5-1.5 3.9-2.7 5.1-6 5.6-9.2.4-2.8 1.3-4.6 2.9-4.4z" fill="currentColor"/><path d="M15.4 7.3c-.1-1.8.9-3.4 2.8-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  function img(path, alt, cls, sizes) {
    if (!path) return `<div class="${cls} ${cls}--empty" aria-hidden="true"><img src="${ASSET_BASE}assets/img/brand/mascot.png" alt=""></div>`;
    return `<img class="${cls}" src="${ASSET_BASE}${esc(path)}" alt="${esc(alt)}" loading="lazy" decoding="async" width="640" height="640"${sizes ? ` sizes="${sizes}"` : ''}>`;
  }

  function spice(level) {
    if (!level) return '';
    const label = `Piccante: ${level} su ${MAX_SPICE}`;
    return `<span class="spice" role="img" aria-label="${label}" title="${label}">${ICONS.chili.repeat(level)}</span>`;
  }

  function categoryNav(categories) {
    return categories.map((c) => `
      <a class="cat-chip" href="#${esc(c.slug)}" data-cat-link="${esc(c.slug)}">
        ${c.image ? `<img src="${ASSET_BASE}${esc(c.image)}" alt="" width="40" height="40" loading="lazy">` : ''}
        <span>${esc(c.name)}</span>
      </a>`).join('');
  }

  function badges(item, bestSellers) {
    const out = [];
    if (!item.available) out.push('<span class="badge badge--out">Esaurito</span>');
    if (bestSellers.includes(item.id)) out.push(`<span class="badge badge--star">${ICONS.star}Più ordinato</span>`);
    if ((item.tags || []).includes('vegano')) out.push('<span class="badge badge--veg">Vegano</span>');
    return out.length ? `<div class="badges">${out.join('')}</div>` : '';
  }

  /** Card in sola vetrina: niente prezzo e niente clic, l'ordine si fa su Qromo. */
  function itemCard(item, bestSellers) {
    return `
      <li>
        <article class="item-card${item.available ? '' : ' is-out'}">
          <span class="item-card__media">${img(item.image, item.name, 'item-card__img')}</span>
          <span class="item-card__body">
            ${badges(item, bestSellers)}
            <h3 class="item-card__name">${esc(item.name)} ${spice(item.spice)}</h3>
            ${item.description ? `<p class="item-card__desc">${esc(item.description)}</p>` : ''}
          </span>
        </article>
      </li>`;
  }

  function section(category, bestSellers) {
    const count = category.items.length;
    return `
      <section class="m-section" id="${esc(category.slug)}" data-section="${esc(category.slug)}" aria-labelledby="h-${esc(category.slug)}">
        <header class="m-section__head">
          ${category.image ? `<img class="m-section__badge" src="${ASSET_BASE}${esc(category.image)}" alt="" width="72" height="72" loading="lazy">` : ''}
          <h2 class="display m-section__title" id="h-${esc(category.slug)}">${esc(category.name)}</h2>
          <span class="m-section__count">${count} ${count === 1 ? 'prodotto' : 'prodotti'}</span>
        </header>
        <ul class="item-grid" role="list">${category.items.map((i) => itemCard(i, bestSellers)).join('')}</ul>
      </section>`;
  }

  root.FFCRender = { categoryNav, section };
})(typeof self !== 'undefined' ? self : this);
