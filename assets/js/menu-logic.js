/**
 * Logica pura del menu Famous Fried Chicken: prezzi, opzioni, carrello, orari, messaggio d'ordine.
 * Nessun accesso al DOM: funziona nel browser (window.FFCLogic) e in Node per i test.
 * Ogni funzione restituisce nuovi oggetti, senza modificare quelli ricevuti.
 *
 * @typedef {{ id: number, name: string, price: number, spice?: number, available: boolean }} Choice
 * @typedef {{ id: number, name: string, min: number, max: number, multi: boolean, choices: Choice[] }} OptionGroup
 * @typedef {{ id: number, name: string, price: number, available?: boolean, options: OptionGroup[], pairsWith?: number[] }} Item
 * @typedef {Object<string, Object<string, number>>} Selection  groupId -> choiceId -> quantità
 * @typedef {{ kind: 'included'|'single'|'multi'|'quantity', min: number, max: number, required: boolean }} GroupRule
 * @typedef {{ key: string, itemId: number, name: string, selection: Selection, summary: string[], unitPrice: number, qty: number }} CartLine
 * @typedef {{ day: number, open: string, close: string }} OpeningHours  day: 0 = lunedì … 6 = domenica (come Qromo)
 * @typedef {{ day: number, minutes: number }} Moment  minuti dalla mezzanotte, ora di Roma
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.FFCLogic = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_NAMES_IT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const DAYS_IN_WEEK = 7;
  const MINUTES_PER_HOUR = 60;

  /** @param {number} cents @returns {string} */
  function formatPrice(cents) {
    return '€ ' + (cents / 100).toFixed(2).replace('.', ',');
  }

  /** @param {unknown} value @returns {string} */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Traduce i vincoli Qromo (min, max, multi) in un tipo di controllo.
   * max = 0 significa "senza limite"; "min 1 senza max" su una lista semplice
   * nel menu originale si comporta come scelta singola obbligatoria.
   * @param {OptionGroup} group @returns {GroupRule}
   */
  function groupRule(group) {
    const min = group.min || 0;
    const max = group.max || 0;
    if (!group.multi && min > 0 && min >= group.choices.length) {
      return { kind: 'included', min, max: group.choices.length, required: false };
    }
    if (group.multi) {
      return { kind: 'quantity', min, max: max || Infinity, required: min > 0 };
    }
    if (max === 1 || (min === 1 && max === 0)) {
      return { kind: 'single', min, max: 1, required: min > 0 };
    }
    return { kind: 'multi', min, max: max || Infinity, required: min > 0 };
  }

  /** @param {Item} item @param {number} groupId @returns {OptionGroup|undefined} */
  function findGroup(item, groupId) {
    return (item.options || []).find((g) => String(g.id) === String(groupId));
  }

  /** @param {Selection} selection @param {number} groupId @returns {number} */
  function groupCount(selection, groupId) {
    const picks = selection[groupId] || {};
    return Object.values(picks).reduce((sum, qty) => sum + qty, 0);
  }

  /** @param {Item} item @returns {Selection} */
  function emptySelection(item) {
    return (item.options || []).reduce((sel, group) => {
      if (groupRule(group).kind !== 'included') return sel;
      const picks = Object.fromEntries(group.choices.map((c) => [c.id, 1]));
      return { ...sel, [group.id]: picks };
    }, {});
  }

  function withGroup(selection, groupId, picks) {
    return { ...selection, [groupId]: picks };
  }

  function withoutKey(obj, key) {
    const { [key]: _removed, ...rest } = obj;
    return rest;
  }

  /** @param {Item} item @param {Selection} selection @param {number} groupId @param {number} choiceId @returns {Selection} */
  function toggleChoice(item, selection, groupId, choiceId) {
    const group = findGroup(item, groupId);
    const target = group && group.choices.find((c) => String(c.id) === String(choiceId));
    if (!group || !target || !target.available) return selection;
    const rule = groupRule(group);
    const picks = selection[groupId] || {};
    const isPicked = Boolean(picks[choiceId]);

    if (rule.kind === 'included' || rule.kind === 'quantity') return selection;
    if (rule.kind === 'single') {
      if (!isPicked) return withGroup(selection, groupId, { [choiceId]: 1 });
      return rule.required ? selection : withGroup(selection, groupId, {});
    }
    if (isPicked) return withGroup(selection, groupId, withoutKey(picks, choiceId));
    if (groupCount(selection, groupId) >= rule.max) return selection;
    return withGroup(selection, groupId, { ...picks, [choiceId]: 1 });
  }

  /** @param {Item} item @param {Selection} selection @param {number} groupId @param {number} choiceId @param {number} delta @returns {Selection} */
  function stepChoice(item, selection, groupId, choiceId, delta) {
    const group = findGroup(item, groupId);
    const target = group && group.choices.find((c) => String(c.id) === String(choiceId));
    if (!group || !target || !target.available || groupRule(group).kind !== 'quantity') return selection;
    const picks = selection[groupId] || {};
    const current = picks[choiceId] || 0;
    const next = Math.max(0, current + delta);
    if (delta > 0 && groupCount(selection, groupId) + delta > groupRule(group).max) return selection;
    if (next === current) return selection;
    const nextPicks = next === 0 ? withoutKey(picks, choiceId) : { ...picks, [choiceId]: next };
    return withGroup(selection, groupId, nextPicks);
  }

  /** @param {Item} item @param {Selection} selection @returns {{ groupId: number, message: string }[]} */
  function validateSelection(item, selection) {
    return (item.options || []).flatMap((group) => {
      const rule = groupRule(group);
      if (!rule.required || rule.kind === 'included') return [];
      if (!group.choices.some((c) => c.available)) {
        return [{ groupId: group.id, message: 'Opzioni esaurite' }];
      }
      const missing = rule.min - groupCount(selection, group.id);
      if (missing <= 0) return [];
      const message = missing === 1 ? 'Manca 1 scelta' : `Mancano ${missing} scelte`;
      return [{ groupId: group.id, message }];
    });
  }

  function eachPick(item, selection, fn) {
    (item.options || []).forEach((group) => {
      const picks = selection[group.id] || {};
      group.choices.forEach((choice) => {
        const qty = picks[choice.id] || 0;
        if (qty > 0) fn(group, choice, qty);
      });
    });
  }

  /** @param {Item} item @param {Selection} selection @returns {number} */
  function unitPrice(item, selection) {
    let total = item.price;
    eachPick(item, selection, (_group, choice, qty) => {
      total += (choice.price || 0) * qty;
    });
    return total;
  }

  /** @param {Item} item @param {Selection} selection @returns {string[]} */
  function describeSelection(item, selection) {
    const lines = [];
    eachPick(item, selection, (group, choice, qty) => {
      if (groupRule(group).kind === 'included') return;
      lines.push(qty > 1 ? `${qty}× ${choice.name}` : choice.name);
    });
    return lines;
  }

  function selectionKey(item, selection) {
    const parts = [];
    eachPick(item, selection, (group, choice, qty) => parts.push(`${group.id}:${choice.id}x${qty}`));
    return `${item.id}|${parts.sort().join(',')}`;
  }

  /** @param {Item} item @param {Selection} selection @param {number} qty @returns {CartLine} */
  function createLine(item, selection, qty) {
    return {
      key: selectionKey(item, selection),
      itemId: item.id,
      name: item.name,
      selection,
      summary: describeSelection(item, selection),
      unitPrice: unitPrice(item, selection),
      qty,
    };
  }

  /** @param {CartLine[]} cart @param {CartLine} line @returns {CartLine[]} */
  function addToCart(cart, line) {
    const exists = cart.some((l) => l.key === line.key);
    if (!exists) return [...cart, line];
    return cart.map((l) => (l.key === line.key ? { ...l, qty: l.qty + line.qty } : l));
  }

  /** @param {CartLine[]} cart @param {string} key @param {number} delta @returns {CartLine[]} */
  function changeQty(cart, key, delta) {
    return cart
      .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
      .filter((l) => l.qty > 0);
  }

  /** @param {CartLine[]} cart @returns {number} */
  function cartTotal(cart) {
    return cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  }

  /** @param {CartLine[]} cart @returns {number} */
  function cartCount(cart) {
    return cart.reduce((sum, l) => sum + l.qty, 0);
  }

  /** @param {{ categories: { items: Item[] }[] }} menu @returns {Item[]} */
  function allItems(menu) {
    return menu.categories.flatMap((c) => c.items);
  }

  /** @param {{ categories: { items: Item[] }[] }} menu @param {number} id @returns {Item|undefined} */
  function findItem(menu, id) {
    return allItems(menu).find((i) => String(i.id) === String(id));
  }

  /** Prezzo più basso tra i prodotti disponibili (per le etichette "da € …"). */
  function minPrice(items) {
    const prices = items.filter((i) => i.available !== false).map((i) => i.price);
    return prices.length ? Math.min(...prices) : null;
  }

  /** @returns {Item[]} prodotti abbinati a quelli nel carrello, poi i più venduti */
  function suggestions(menu, cart, limit) {
    const inCart = new Set(cart.map((l) => String(l.itemId)));
    const paired = cart.flatMap((l) => (findItem(menu, l.itemId) || {}).pairsWith || []);
    const candidates = [...paired, ...(menu.bestSellers || [])];
    const seen = new Set();
    const result = [];
    candidates.forEach((id) => {
      const key = String(id);
      if (seen.has(key) || inCart.has(key)) return;
      seen.add(key);
      const item = findItem(menu, id);
      if (item && item.available) result.push(item);
    });
    return result.slice(0, limit);
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * MINUTES_PER_HOUR + m;
  }

  function toHHMM(minutes) {
    const h = Math.floor(minutes / MINUTES_PER_HOUR);
    const m = minutes % MINUTES_PER_HOUR;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Giorno (0 = lunedì) e minuti correnti nel fuso di Roma. @param {Date} date @returns {Moment} */
  function romeNow(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => (parts.find((p) => p.type === type) || {}).value;
    return { day: WEEKDAYS_EN.indexOf(get('weekday')), minutes: Number(get('hour')) * MINUTES_PER_HOUR + Number(get('minute')) };
  }

  /**
   * @param {OpeningHours[]} hours @param {Moment} now
   * @returns {{ open: true, until: string } | { open: false, next: string|null, nextDay: number|null }}
   */
  function openStatus(hours, now) {
    const today = hours.find((h) => h.day === now.day);
    if (today && now.minutes >= toMinutes(today.open) && now.minutes < toMinutes(today.close)) {
      return { open: true, until: displayTime(today.close) };
    }
    if (today && now.minutes < toMinutes(today.open)) {
      return { open: false, next: today.open, nextDay: today.day };
    }
    for (let offset = 1; offset <= DAYS_IN_WEEK; offset += 1) {
      const day = (now.day + offset) % DAYS_IN_WEEK;
      const slot = hours.find((h) => h.day === day);
      if (slot) return { open: false, next: slot.open, nextDay: day };
    }
    return { open: false, next: null, nextDay: null };
  }

  /** "24:00" (chiusura a mezzanotte) si legge "00:00". */
  function displayTime(hhmm) {
    return hhmm === '24:00' ? '00:00' : hhmm;
  }

  /** @param {number} day 0 = lunedì @returns {string} */
  function dayName(day) {
    return DAY_NAMES_IT[day] || '';
  }

  /** Orari leggibili: "Tutti i giorni" se coincidono su 7 giorni, altrimenti giorno per giorno. */
  function hoursSummary(hours) {
    const time = (h) => `${displayTime(h.open)} – ${displayTime(h.close)}`;
    const sorted = [...hours].sort((a, b) => a.day - b.day);
    const sameEveryDay = sorted.length === DAYS_IN_WEEK && sorted.every((h) => time(h) === time(sorted[0]));
    if (sameEveryDay) return [{ label: 'Tutti i giorni', time: time(sorted[0]) }];
    return sorted.map((h) => ({ label: dayName(h.day), time: time(h) }));
  }

  /** Orari di ritiro di oggi, a intervalli regolari, dopo il tempo di preparazione. @returns {string[]} */
  function pickupSlots(hours, now, interval, leadMinutes) {
    const today = hours.find((h) => h.day === now.day);
    if (!today) return [];
    const earliest = Math.max(toMinutes(today.open), now.minutes + leadMinutes);
    const close = toMinutes(today.close);
    const slots = [];
    for (let t = Math.ceil(earliest / interval) * interval; t < close; t += interval) {
      slots.push(toHHMM(t));
    }
    return slots;
  }

  /** @param {CartLine[]} cart @param {{ name?: string, pickup?: string, notes?: string }} details @returns {string} */
  function buildOrderMessage(cart, details) {
    const lines = ['Ciao Famous Fried Chicken! Vorrei ordinare da asporto:', ''];
    cart.forEach((l) => {
      lines.push(`${l.qty}× ${l.name} — ${formatPrice(l.unitPrice * l.qty)}`);
      if (l.summary.length) lines.push(`   · ${l.summary.join(', ')}`);
    });
    lines.push('', `Totale: ${formatPrice(cartTotal(cart))}`);
    if (details.pickup) lines.push(`Ritiro: ${details.pickup}`);
    if (details.name) lines.push(`Nome: ${details.name}`);
    if (details.notes) lines.push(`Note: ${details.notes}`);
    return lines.join('\n');
  }

  /** @param {string} number @param {string} text @returns {string} */
  function whatsappUrl(number, text) {
    return `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  }

  return {
    formatPrice, escapeHtml, groupRule, groupCount, emptySelection, toggleChoice, stepChoice,
    validateSelection, unitPrice, describeSelection, createLine, addToCart, changeQty, cartTotal,
    cartCount, allItems, findItem, minPrice, suggestions, romeNow, openStatus, displayTime, dayName, hoursSummary, pickupSlots,
    buildOrderMessage, whatsappUrl,
  };
});
