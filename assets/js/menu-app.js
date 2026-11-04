/**
 * Avvio del menu: rendering delle categorie e orari.
 * Il menu è solo una vetrina (senza prezzi né schede prodotto): l'ordine avviene su Qromo.
 * Dipende da FFC_MENU (dati), FFCLogic e FFCRender.
 */
(function (root) {
  'use strict';

  const L = root.FFCLogic;
  const R = root.FFCRender;
  const menu = root.FFC_MENU;

  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));

  const menuRoot = $('[data-menu-root]');
  if (!menu || !Array.isArray(menu.categories)) {
    menuRoot.innerHTML = '<p class="m-noscript">Il menu non è disponibile in questo momento. Apri il <a href="https://famousfriedchicken.qromo.it/">menu su Qromo</a>.</p>';
    return;
  }

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
    if (hash) {
      const target = document.getElementById(hash);
      if (target && target.hasAttribute('data-section')) target.scrollIntoView();
    }
  }

  document.addEventListener('click', (event) => {
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

  renderMenu();
  renderStatus();
  renderFooter();
  setupScrollSpy();
  handleHash();
})(typeof self !== 'undefined' ? self : this);
