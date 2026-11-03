/**
 * Avvio del menu: rendering delle categorie, scheda prodotto, stato del carrello e orari.
 * Dipende da FFC_MENU (dati), FFC_ORDER_CONFIG, FFCLogic, FFCRender e FFCCart.
 */
(function (root) {
  'use strict';

  const L = root.FFCLogic;
  const R = root.FFCRender;
  const menu = root.FFC_MENU;
  const config = root.FFC_ORDER_CONFIG || {};
  const STORAGE_KEY = 'ffc-cart-v1';
  const MAX_ITEM_QTY = 20;
  const TOAST_MS = 2800;

  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));

  const menuRoot = $('[data-menu-root]');
  if (!menu || !Array.isArray(menu.categories)) {
    menuRoot.innerHTML = '<p class="m-noscript">Il menu non è disponibile in questo momento. Apri il <a href="https://famousfriedchicken.qromo.it/">menu su Qromo</a>.</p>';
    return;
  }

  const itemDialog = $('[data-item-dialog]');
  const state = { cart: [], item: null, selection: {}, qty: 1, showErrors: false };

  /* ---------- Persistenza del carrello (solo per comodità: può mancare) ---------- */

  function sanitizeSelection(item, selection) {
    return (item.options || []).reduce((clean, group) => {
      const picks = (selection || {})[group.id] || {};
      const valid = group.choices.filter((c) => c.available && picks[c.id] > 0);
      if (!valid.length) return clean;
      return { ...clean, [group.id]: Object.fromEntries(valid.map((c) => [c.id, picks[c.id]])) };
    }, L.emptySelection(item));
  }

  function restoreCart() {
    try {
      const stored = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.reduce((cart, entry) => {
        const item = L.findItem(menu, entry && entry.itemId);
        const qty = Math.min(Number(entry && entry.qty) || 0, MAX_ITEM_QTY);
        if (!item || !item.available || qty < 1) return cart;
        const selection = sanitizeSelection(item, entry.selection);
        if (L.validateSelection(item, selection).length) return cart;
        return L.addToCart(cart, L.createLine(item, selection, qty));
      }, []);
    } catch (err) {
      return [];
    }
  }

  function persistCart(cart) {
    try {
      const slim = cart.map(({ itemId, selection, qty }) => ({ itemId, selection, qty }));
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch (err) {
      /* Archiviazione non disponibile (navigazione privata): il carrello resta solo in memoria. */
    }
  }

  /* ---------- Avvisi ---------- */

  let toastTimer = null;
  function notify(text, withCartLink) {
    const toast = $('[data-toast]');
    toast.innerHTML = `<span>${L.escapeHtml(text)}</span>${withCartLink ? '<button type="button" class="toast__btn" data-open-cart>Vedi ordine</button>' : ''}`;
    toast.hidden = false;
    toast.classList.remove('is-visible');
    void toast.offsetWidth; // riavvia la transizione
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      toastTimer = setTimeout(() => { toast.hidden = true; }, 250);
    }, TOAST_MS);
  }

  /* ---------- Carrello ---------- */

  function updateCartUi() {
    const count = L.cartCount(state.cart);
    const total = L.formatPrice(L.cartTotal(state.cart));
    const badge = $('[data-cart-count]');
    badge.textContent = String(count);
    badge.hidden = count === 0;
    $('[data-cartbar]').hidden = count === 0;
    $('[data-cartbar-count]').textContent = String(count);
    $('[data-cartbar-total]').textContent = total;
    $('[data-open-cart].m-cart-btn').setAttribute('aria-label', `Apri il carrello: ${count} prodotti, ${total}`);
  }

  function bumpCart() {
    $$('.m-cart-btn, .m-cartbar__btn').forEach((el) => {
      el.classList.remove('is-bumping');
      void el.offsetWidth;
      el.classList.add('is-bumping');
    });
  }

  const cartPanel = root.FFCCart.mount({
    dialog: $('[data-cart-dialog]'),
    menu,
    config,
    getCart: () => state.cart,
    setCart: (cart) => {
      state.cart = cart;
      persistCart(cart);
      updateCartUi();
      cartPanel.render();
    },
    openItem: (id) => openItem(id),
    notify: (text) => notify(text, false),
  });

  /* ---------- Scheda prodotto ---------- */

  function syncItemDialog() {
    const { item, selection, qty } = state;
    (item.options || []).forEach((group) => {
      const rule = L.groupRule(group);
      const count = L.groupCount(selection, group.id);
      const atMax = count >= rule.max;
      group.choices.forEach((choice) => {
        const picked = ((selection[group.id] || {})[choice.id]) || 0;
        const input = $(`input[data-group="${group.id}"][data-choice-id="${choice.id}"]`, itemDialog);
        if (input) {
          input.checked = picked > 0;
          input.disabled = !choice.available || (rule.kind === 'multi' && atMax && !picked);
        }
        const out = $(`[data-qty-for="${group.id}-${choice.id}"]`, itemDialog);
        if (out) {
          out.textContent = String(picked);
          out.closest('.choice').classList.toggle('is-picked', picked > 0);
          $('[data-step="-1"]', out.parentElement).disabled = picked === 0;
          $('[data-step="1"]', out.parentElement).disabled = !choice.available || atMax;
        }
      });
    });

    const errors = state.showErrors ? L.validateSelection(item, selection) : [];
    $$('[data-group-error]', itemDialog).forEach((el) => {
      const error = errors.find((e) => String(e.groupId) === el.getAttribute('data-group-error'));
      el.hidden = !error;
      el.textContent = error ? error.message : '';
      el.closest('.opt-group').classList.toggle('has-error', Boolean(error));
    });

    $('[data-item-qty]', itemDialog).textContent = String(qty);
    $('[data-qty-step="-1"]', itemDialog).disabled = qty <= 1;
    $('[data-qty-step="1"]', itemDialog).disabled = qty >= MAX_ITEM_QTY;
    $('[data-item-total]', itemDialog).textContent = L.formatPrice(L.unitPrice(item, selection) * qty);
  }

  function openItem(id) {
    const item = L.findItem(menu, id);
    if (!item) return;
    Object.assign(state, { item, selection: L.emptySelection(item), qty: 1, showErrors: false });
    itemDialog.innerHTML = R.itemDialog(item);
    syncItemDialog();
    if (!itemDialog.open) itemDialog.showModal();
    $('.sheet__body', itemDialog).scrollTop = 0;
  }

  function addCurrentItem() {
    const { item, selection, qty } = state;
    const errors = L.validateSelection(item, selection);
    if (errors.length) {
      state.showErrors = true;
      syncItemDialog();
      const box = $(`[data-group-box="${errors[0].groupId}"]`, itemDialog);
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = $('input:not([disabled]), button.stepper__btn:not([disabled])', box);
      if (firstInput) firstInput.focus({ preventScroll: true });
      return;
    }
    const cart = L.addToCart(state.cart, L.createLine(item, selection, qty));
    state.cart = cart;
    persistCart(cart);
    updateCartUi();
    itemDialog.close();
    bumpCart();
    notify(`${qty > 1 ? qty + '× ' : ''}${item.name} aggiunto all'ordine`, true);
  }

  itemDialog.addEventListener('change', (event) => {
    const input = event.target.closest('.choice__input');
    if (!input || !state.item) return;
    state.selection = L.toggleChoice(state.item, state.selection, Number(input.dataset.group), Number(input.dataset.choiceId));
    syncItemDialog();
  });

  itemDialog.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn || !state.item) return;
    if (btn.hasAttribute('data-step')) {
      state.selection = L.stepChoice(state.item, state.selection, Number(btn.dataset.group), Number(btn.dataset.choiceId), Number(btn.dataset.step));
      syncItemDialog();
    } else if (btn.hasAttribute('data-qty-step')) {
      state.qty = Math.min(MAX_ITEM_QTY, Math.max(1, state.qty + Number(btn.dataset.qtyStep)));
      syncItemDialog();
    } else if (btn.hasAttribute('data-add-item')) {
      addCurrentItem();
    }
  });

  /* ---------- Menu, navigazione categorie, orari ---------- */

  function renderMenu() {
    const bestSellers = menu.bestSellers || [];
    $('[data-category-nav]').innerHTML = R.categoryNav(menu.categories);
    menuRoot.innerHTML = menu.categories.map((c) => R.section(c, bestSellers)).join('');
  }

  function setupScrollSpy() {
    const track = $('[data-category-nav]');
    const links = new Map($$('[data-cat-link]').map((a) => [a.getAttribute('data-cat-link'), a]));
    const reduceMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observer = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((entry) => {
        links.forEach((a) => a.removeAttribute('aria-current'));
        const active = links.get(entry.target.getAttribute('data-section'));
        if (!active) return;
        active.setAttribute('aria-current', 'true');
        const left = active.offsetLeft - track.clientWidth / 2 + active.clientWidth / 2;
        track.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    $$('[data-section]').forEach((s) => observer.observe(s));
  }

  function renderStatus() {
    const pill = $('[data-open-status]');
    const now = L.romeNow(new Date());
    const status = L.openStatus(menu.business.hours, now);
    pill.classList.toggle('is-open', status.open);
    if (status.open) {
      pill.textContent = `Aperto ora · fino alle ${status.until}`;
    } else if (status.next) {
      const when = status.nextDay === now.day ? 'oggi'
        : status.nextDay === (now.day + 1) % 7 ? 'domani' : L.dayName(status.nextDay).toLowerCase();
      pill.textContent = `Chiuso · riapre ${when} alle ${status.next}`;
    } else {
      pill.textContent = 'Orari non disponibili';
    }
  }

  function renderFooter() {
    const { company, vat } = menu.business;
    $('[data-company]').textContent = [company, vat && `P.IVA ${vat}`].filter(Boolean).join(' · ');
    const [y, m, d] = String(menu.updatedAt || '').split('-');
    $('[data-updated]').textContent = d ? `${d}/${m}/${y}` : '';
  }

  function handleHash() {
    const hash = decodeURIComponent(root.location.hash.slice(1));
    const itemMatch = /^item-(\d+)$/.exec(hash);
    if (itemMatch) {
      openItem(Number(itemMatch[1]));
    } else if (hash) {
      const target = document.getElementById(hash);
      if (target && target.hasAttribute('data-section')) target.scrollIntoView();
    }
  }

  /* ---------- Eventi globali ---------- */

  document.addEventListener('click', (event) => {
    const card = event.target.closest('[data-item-id]');
    if (card) {
      openItem(Number(card.getAttribute('data-item-id')));
      return;
    }
    if (event.target.closest('[data-open-cart]')) {
      if (itemDialog.open) itemDialog.close();
      cartPanel.open();
      return;
    }
    if (event.target.closest('[data-open-allergens]')) {
      $('[data-allergen-dialog]').showModal();
      return;
    }
    const closer = event.target.closest('[data-close-dialog]');
    if (closer) {
      closer.closest('dialog').close();
      return;
    }
    // Clic sullo sfondo scuro fuori dal pannello
    if (event.target instanceof HTMLDialogElement && event.target.open) event.target.close();
  });

  root.addEventListener('hashchange', handleHash);

  state.cart = restoreCart();
  renderMenu();
  renderStatus();
  renderFooter();
  updateCartUi();
  setupScrollSpy();
  handleHash();
})(typeof self !== 'undefined' ? self : this);
