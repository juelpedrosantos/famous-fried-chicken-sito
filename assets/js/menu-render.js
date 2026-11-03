/**
 * Template HTML del menu. Ogni testo che arriva dai dati passa da escapeHtml.
 * Espone window.FFCRender; dipende da window.FFCLogic.
 */
(function (root) {
  'use strict';

  const { escapeHtml: esc, formatPrice, groupRule } = root.FFCLogic;
  const MAX_SPICE = 4;
  const ASSET_BASE = '../';

  const ICONS = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.8 6.3 20l1.4-6.3L2.9 9.4l6.4-.7z" fill="currentColor"/></svg>',
    chili: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 7.2c3 .3 4.8 3 4.1 6.5-.9 4.4-5.7 8-12.1 8.6-1 .1-1.3-.9-.5-1.5 3.9-2.7 5.1-6 5.6-9.2.4-2.8 1.3-4.6 2.9-4.4z" fill="currentColor"/><path d="M15.4 7.3c-.1-1.8.9-3.4 2.8-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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

  function extraPrice(cents) {
    return cents ? `<span class="choice__price">+ ${formatPrice(cents)}</span>` : '';
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

  function itemCard(item, bestSellers) {
    const action = item.available
      ? `<span class="add-btn" aria-hidden="true">${ICONS.plus}</span>`
      : '';
    return `
      <li>
        <button class="item-card${item.available ? '' : ' is-out'}" type="button" data-item-id="${item.id}"
          aria-label="${esc(item.name)}, ${formatPrice(item.price)}${item.available ? '' : ', esaurito'}">
          <span class="item-card__media">${img(item.image, '', 'item-card__img')}</span>
          <span class="item-card__body">
            ${badges(item, bestSellers)}
            <span class="item-card__name">${esc(item.name)} ${spice(item.spice)}</span>
            ${item.description ? `<span class="item-card__desc">${esc(item.description)}</span>` : ''}
            <span class="item-card__foot">
              <span class="item-card__price">${formatPrice(item.price)}</span>
              ${action}
            </span>
          </span>
        </button>
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

  function ruleHint(rule, choiceCount) {
    if (rule.kind === 'included') return 'Incluso';
    if (rule.kind === 'multi' && !rule.required && choiceCount === 1) return 'Facoltativo';
    if (rule.kind === 'single') return rule.required ? 'Obbligatorio · scegli 1' : 'Facoltativo · max 1';
    if (rule.kind === 'quantity') {
      if (rule.min && rule.min === rule.max) return `Obbligatorio · scegli ${rule.min}`;
      return rule.required ? `Almeno ${rule.min}` : 'Facoltativo';
    }
    if (rule.max !== Infinity) return `Facoltativo · max ${rule.max}`;
    return rule.required ? `Almeno ${rule.min}` : 'Facoltativo · scegli quanti vuoi';
  }

  function choiceRow(group, rule, choice) {
    const id = `opt-${group.id}-${choice.id}`;
    const name = `<span class="choice__name">${esc(choice.name)} ${spice(choice.spice)}</span>`;
    const out = choice.available ? '' : '<span class="choice__out">Esaurito</span>';
    if (rule.kind === 'included') {
      return `<li class="choice choice--included"><span class="choice__mark">${ICONS.check}</span>${name}</li>`;
    }
    if (rule.kind === 'quantity') {
      return `
        <li class="choice choice--qty" data-choice="${choice.id}">
          ${name}${extraPrice(choice.price)}${out}
          <span class="stepper stepper--small">
            <button type="button" class="stepper__btn" data-step="-1" data-group="${group.id}" data-choice-id="${choice.id}" aria-label="Togli ${esc(choice.name)}">${ICONS.minus}</button>
            <output class="stepper__value" data-qty-for="${group.id}-${choice.id}">0</output>
            <button type="button" class="stepper__btn" data-step="1" data-group="${group.id}" data-choice-id="${choice.id}" aria-label="Aggiungi ${esc(choice.name)}"${choice.available ? '' : ' disabled'}>${ICONS.plus}</button>
          </span>
        </li>`;
    }
    const type = rule.kind === 'single' && rule.required ? 'radio' : 'checkbox';
    return `
      <li class="choice">
        <input class="choice__input" type="${type}" id="${id}" name="g-${group.id}" data-group="${group.id}" data-choice-id="${choice.id}"${choice.available ? '' : ' disabled'}>
        <label class="choice__label" for="${id}">
          <span class="choice__mark choice__mark--${type}" aria-hidden="true">${ICONS.check}</span>
          ${name}${extraPrice(choice.price)}${out}
        </label>
      </li>`;
  }

  function optionGroup(group) {
    const rule = groupRule(group);
    return `
      <fieldset class="opt-group" data-group-box="${group.id}">
        <legend class="opt-group__legend">
          <span class="opt-group__name">${esc(group.name)}</span>
          <span class="opt-group__hint">${ruleHint(rule, group.choices.length)}</span>
        </legend>
        <p class="opt-group__error" data-group-error="${group.id}" hidden></p>
        <ul class="choice-list" role="list">${group.choices.map((c) => choiceRow(group, rule, c)).join('')}</ul>
      </fieldset>`;
  }

  function itemDialog(item) {
    return `
      <div class="item-sheet__media">
        ${img(item.image, item.name, 'item-sheet__img')}
        <button class="icon-btn icon-btn--float" type="button" data-close-dialog aria-label="Chiudi">${ICONS.close}</button>
      </div>
      <div class="sheet__body">
        <h2 class="display item-sheet__title" id="item-dialog-title">${esc(item.name)} ${spice(item.spice)}</h2>
        ${item.description ? `<p class="item-sheet__desc">${esc(item.description)}</p>` : ''}
        <p class="item-sheet__price">${formatPrice(item.price)}</p>
        ${(item.options || []).map(optionGroup).join('')}
      </div>
      <div class="sheet__foot item-sheet__foot">
        <span class="stepper">
          <button type="button" class="stepper__btn" data-qty-step="-1" aria-label="Diminuisci quantità">${ICONS.minus}</button>
          <output class="stepper__value" data-item-qty aria-live="polite">1</output>
          <button type="button" class="stepper__btn" data-qty-step="1" aria-label="Aumenta quantità">${ICONS.plus}</button>
        </span>
        <button class="btn add-cta" type="button" data-add-item${item.available ? '' : ' disabled'}>
          ${item.available ? 'Aggiungi' : 'Esaurito'} <span data-item-total>${formatPrice(item.price)}</span>
        </button>
      </div>`;
  }

  root.FFCRender = { ICONS, categoryNav, section, itemDialog, spice, img };
})(typeof self !== 'undefined' ? self : this);
