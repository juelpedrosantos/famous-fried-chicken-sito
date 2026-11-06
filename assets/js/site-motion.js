/**
 * Animazioni del sito vetrina con GSAP + ScrollTrigger:
 * ingresso dell'hero, comparsa a cascata delle sezioni, leggera parallasse della foto,
 * nastro che accelera con la velocità di scroll (idea "ScrollVelocity" di React Bits).
 * Tutto dentro gsap.matchMedia: chi preferisce meno movimento vede i contenuti subito.
 * Se GSAP non si carica, i contenuti restano comunque visibili (classe .is-in).
 */
(function (root) {
  'use strict';

  const reveals = Array.from(document.querySelectorAll('.reveal'));
  const gsap = root.gsap;
  const ScrollTrigger = root.ScrollTrigger;

  if (!gsap || !ScrollTrigger) {
    reveals.forEach((el) => el.classList.add('is-in'));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('gsap-ready');

  function heroIntro() {
    return gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.hero__logo img', { autoAlpha: 0, scale: 0.86, rotation: -4, duration: 0.8 })
      .from('.hero__claim', { autoAlpha: 0, y: 16, duration: 0.6 }, '-=0.45')
      .from('.hero__sub', { autoAlpha: 0, y: 12, duration: 0.5 }, '-=0.35')
      .from('.hero__actions > *', { autoAlpha: 0, y: 14, duration: 0.45, stagger: 0.08 }, '-=0.3')
      .from('.hero__facts li', { autoAlpha: 0, y: 10, duration: 0.4, stagger: 0.06 }, '-=0.25');
  }

  function scrollReveals() {
    gsap.set(reveals, { autoAlpha: 0, y: 28 });
    ScrollTrigger.batch(reveals, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, {
        autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1, overwrite: true,
      }),
    });
  }

  function heroParallax() {
    gsap.to('.hero__bg', {
      yPercent: 12,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  /** Il nastro scorre sempre; scrollando accelera e segue il verso dello scroll, poi torna normale. */
  function tickerVelocity() {
    const track = document.querySelector('.ticker__track');
    if (!track) return;
    const loop = gsap.to(track, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
    const MAX_BOOST = 5;
    ScrollTrigger.create({
      onUpdate: (self) => {
        const boost = gsap.utils.clamp(-MAX_BOOST, MAX_BOOST, self.getVelocity() / 300);
        if (Math.abs(boost) < 1) return;
        gsap.to(loop, {
          timeScale: boost,
          duration: 0.2,
          overwrite: true,
          onComplete: () => gsap.to(loop, { timeScale: 1, duration: 1.2, ease: 'power2.out', overwrite: true }),
        });
      },
    });
  }

  const mm = gsap.matchMedia();
  mm.add({
    motion: '(prefers-reduced-motion: no-preference)',
    reduce: '(prefers-reduced-motion: reduce)',
    desktop: '(min-width: 900px)',
  }, (context) => {
    const { motion, reduce, desktop } = context.conditions;
    if (reduce) {
      gsap.set(reveals, { autoAlpha: 1, y: 0 });
      return;
    }
    if (motion) {
      heroIntro();
      scrollReveals();
      tickerVelocity();
      if (desktop) heroParallax();
    }
  });

  // Le foto si caricano man mano (lazy) e cambiano l'altezza della pagina:
  // ricalcola i punti di attivazione, una sola volta per raffica di caricamenti.
  const REFRESH_DELAY_MS = 200;
  let refreshTimer = null;
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), REFRESH_DELAY_MS);
  };
  root.addEventListener('load', scheduleRefresh);
  document.querySelectorAll('main img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', scheduleRefresh, { once: true });
  });
})(typeof self !== 'undefined' ? self : this);
