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
        <div class="thermo__img thermo__media" data-thermo-media role="img" aria-label="Termometro del piccante Famous">
          <video class="thermo__video" data-thermo-video muted playsinline preload="metadata" width="680" height="1276"
            poster="assets/img/brand/termometro-statico.webp" aria-hidden="true">
            <source src="assets/video/termometro-v2.mp4" type="video/mp4">
          </video>
          <canvas class="thermo__canvas" data-thermo-canvas width="680" height="1276" aria-hidden="true"></canvas>
        </div>
        <ol class="thermo__list" aria-label="Salse dalla più piccante alla più delicata">
          ${sauces.map((s, i) => `<li style="--heat:${(i / last).toFixed(3)}">${L.escapeHtml(s.name)}</li>`).join('')}
        </ol>
      </div>`;
    const count = `${cat.items.filter((i) => i.available).length} salse dip`;
    $$('[data-sauce-count], [data-sauce-pill]').forEach((el) => { el.textContent = count; });
  }

  /**
   * "I più amati": prodotti scelti dal locale. La foto arriva dal menu Qromo (per id);
   * nome e descrizione sono quelli da mostrare in vetrina, senza numero di pezzi.
   */
  const FAVOURITES = [
    { id: 828474, name: 'Wings', description: 'Ali di pollo croccanti, glassate con la salsa che preferisci.' },
    { id: 820881, name: 'Bacon Royal', description: 'Bun brioche, pollo fritto croccante, american cheese, bacon e salsa crispy.' },
    { id: 828528, name: 'Tenders glassati Spicy', description: 'Filetti di pollo croccanti con la nostra glassatura Spicy.' },
    { id: 820896, name: 'Patatine Cheddar e Bacon', description: 'Patatine fritte con cheddar fuso homemade e bacon croccante.' },
  ];

  function fillBestSellers() {
    const list = $('[data-best-sellers]');
    if (!list) return;
    list.innerHTML = FAVOURITES.map((fav) => {
      const item = L.findItem(menu, fav.id);
      const image = item && item.image;
      return `
      <li class="reveal">
        <article class="best-card">
          <span class="best-card__media">
            ${image ? `<img src="${L.escapeHtml(image)}" alt="${L.escapeHtml(fav.name)}" width="640" height="640" loading="lazy">` : ''}
          </span>
          <span class="best-card__body">
            <span class="best-card__name">${L.escapeHtml(fav.name)}</span>
            <span class="best-card__desc">${L.escapeHtml(fav.description)}</span>
          </span>
        </article>
      </li>`;
    }).join('');
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

  /**
   * Termometro animato: parte quando è visibile, poi ripete solo il finale con il pollo in fiamme.
   * Ogni browser e ogni schermo colora i video in modo un po' diverso dal resto della pagina, e il fondo blu
   * del video formava un riquadro. Per questo il video viene ridisegnato su un canvas (colorato come la pagina)
   * correggendo il blu del fondo perché sia identico a quello della sezione.
   * Se qualcosa non va, resta visibile il video normale.
   */
  const THERMO_LOOP_FROM_S = 5;
  const THERMO_SPEED = 1.5; // il video originale è un po' lento
  const THERMO_SAMPLE = { x: 12, y: 12, size: 24 }; // angolo del video che contiene solo il fondo blu
  const THERMO_MAX_DRIFT = 24; // oltre questa differenza la misura non è il fondo (fotogramma vuoto o non pronto)

  function parseRgb(css) {
    const m = String(css).match(/\d+(\.\d+)?/g);
    return m && m.length >= 3 ? m.slice(0, 3).map(Number) : null;
  }

  function averageRgb(data) {
    const sum = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) { sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2]; }
    const n = data.length / 4;
    return sum.map((v) => v / n);
  }

  /** Correzione per canale: prima moltiplica (se il video è più chiaro), poi somma (se è più scuro). */
  function colorFix(sampled, target) {
    const mul = sampled.map((v, k) => (v > 0 ? Math.min(1, target[k] / v) : 1));
    const add = sampled.map((v, k) => Math.max(0, target[k] - v * mul[k]));
    return { mul, add };
  }

  function drawCorrected(ctx, video, fix, w, h) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(video, 0, 0, w, h);
    if (fix.mul.some((m) => m < 1)) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${fix.mul.map((m) => Math.round(m * 255)).join(',')})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (fix.add.some((a) => a > 0.5)) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgb(${fix.add.map((a) => Math.round(a)).join(',')})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function mirrorOnCanvas(video, canvas, media) {
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    const target = parseRgb(getComputedStyle(media).backgroundColor);
    if (!ctx || !target) return;
    const w = canvas.width;
    const h = canvas.height;
    let fix = null;
    let visible = true;

    const frame = () => {
      if (visible && video.readyState >= 2) {
        try {
          if (!fix) {
            ctx.drawImage(video, 0, 0, w, h);
            const { x, y, size } = THERMO_SAMPLE;
            const sampled = averageRgb(ctx.getImageData(x, y, size, size).data);
            // Si calibra solo su un fotogramma vero: il fondo letto deve essere vicino al blu della sezione.
            if (sampled.every((v, k) => Math.abs(v - target[k]) <= THERMO_MAX_DRIFT)) {
              fix = colorFix(sampled, target);
              media.classList.add('is-canvas');
            }
          }
          if (fix) drawCorrected(ctx, video, fix, w, h);
        } catch (err) {
          // Canvas non disponibile (es. restrizioni del browser): resta il video normale.
          media.classList.remove('is-canvas');
          console.warn('Termometro: uso il video senza correzione del colore', err);
          return;
        }
      }
      if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(frame);
      else root.requestAnimationFrame(frame);
    };

    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(media);
    frame();
  }

  function setupThermoVideo() {
    const video = $('[data-thermo-video]');
    const canvas = $('[data-thermo-canvas]');
    const media = $('[data-thermo-media]');
    if (!video || !canvas || !media) return;
    if (root.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // resta il fotogramma finale
    video.defaultPlaybackRate = THERMO_SPEED;
    video.playbackRate = THERMO_SPEED;
    video.addEventListener('ended', () => {
      video.currentTime = THERMO_LOOP_FROM_S;
      video.play().catch(() => {});
    });
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      video.play().then(() => mirrorOnCanvas(video, canvas, media)).catch(() => {});
      observer.disconnect();
    }, { threshold: 0.4 });
    observer.observe(media);
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
  setupThermoVideo();
  setupPromo();
})(typeof self !== 'undefined' ? self : this);
