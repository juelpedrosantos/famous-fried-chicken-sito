const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/js/menu-logic.js');

const choice = (id, name, price = 0, available = true) => ({ id, name, price, spice: 0, available });

const burger = {
  id: 1,
  name: 'The Original',
  price: 590,
  options: [
    { id: 10, name: 'Più Pollo?', min: 0, max: 0, multi: false, choices: [choice(100, 'STAR', 200)] },
    { id: 11, name: 'SENZA', min: 0, max: 0, multi: false, choices: [choice(110, 'NO Insalata'), choice(111, 'NO Pomodoro')] },
  ],
};

const combo = {
  id: 2,
  name: 'Combo Menu',
  price: 1090,
  options: [
    { id: 20, name: 'Chicken Burgers', min: 1, max: 1, multi: false, choices: [choice(200, 'The Original'), choice(201, 'The Spicy', 200), choice(202, 'The Planted', 400, false)] },
    { id: 21, name: 'Tenders', min: 1, max: 0, multi: false, choices: [choice(210, 'Tenders 4 pezzi')] },
    { id: 22, name: 'Salse', min: 4, max: 4, multi: true, choices: [choice(220, 'Atomic'), choice(221, 'Ranch')] },
    { id: 23, name: 'Altri pezzi?', min: 1, max: 0, multi: false, choices: [choice(230, '6 pezzi'), choice(231, '10 pezzi', 400)] },
    { id: 24, name: 'Bibita', min: 0, max: 1, multi: false, choices: [choice(240, 'Coca Cola'), choice(241, 'Fanta')] },
  ],
};

const group = (item, id) => item.options.find((g) => g.id === id);

test('formatPrice renders euro cents the Italian way', () => {
  assert.equal(L.formatPrice(590), '€ 5,90');
  assert.equal(L.formatPrice(0), '€ 0,00');
  assert.equal(L.formatPrice(1290), '€ 12,90');
});

test('escapeHtml neutralises markup coming from the menu data', () => {
  assert.equal(L.escapeHtml('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
  assert.equal(L.escapeHtml(null), '');
});

test('minPrice ignores sold-out items', () => {
  assert.equal(L.minPrice([{ price: 390, available: false }, { price: 490, available: true }, { price: 590 }]), 490);
  assert.equal(L.minPrice([]), null);
});

test('romeNow converts to Rome time with Monday as day 0', () => {
  // 2026-11-02 is a Monday; 11:30 UTC is 12:30 in Rome (CET).
  assert.deepEqual(L.romeNow(new Date('2026-11-02T11:30:00Z')), { day: 0, minutes: 12 * 60 + 30 });
});

test('groupRule classifies option groups', () => {
  assert.deepEqual(L.groupRule(group(burger, 10)), { kind: 'multi', min: 0, max: Infinity, required: false });
  assert.equal(L.groupRule(group(combo, 20)).kind, 'single');
  assert.equal(L.groupRule(group(combo, 20)).required, true);
  assert.equal(L.groupRule(group(combo, 21)).kind, 'included');
  assert.deepEqual(L.groupRule(group(combo, 22)), { kind: 'quantity', min: 4, max: 4, required: true });
  assert.equal(L.groupRule(group(combo, 24)).kind, 'single');
  assert.equal(L.groupRule(group(combo, 24)).required, false);
});

test('groupRule treats "min 1 without max" on a plain list as a required single choice', () => {
  assert.deepEqual(L.groupRule(group(combo, 23)), { kind: 'single', min: 1, max: 1, required: true });
});

test('emptySelection pre-selects included groups only', () => {
  const sel = L.emptySelection(combo);
  assert.deepEqual(sel, { 21: { 210: 1 } });
});

test('toggleChoice on a single group replaces the previous choice without mutating', () => {
  const s0 = L.emptySelection(combo);
  const s1 = L.toggleChoice(combo, s0, 20, 200);
  const s2 = L.toggleChoice(combo, s1, 20, 201);
  assert.deepEqual(s1[20], { 200: 1 });
  assert.deepEqual(s2[20], { 201: 1 });
  assert.equal(s0[20], undefined);
});

test('toggleChoice keeps a required single choice selected but lets optional ones be cleared', () => {
  const required = L.toggleChoice(combo, L.toggleChoice(combo, {}, 20, 200), 20, 200);
  assert.deepEqual(required[20], { 200: 1 });
  const optional = L.toggleChoice(combo, L.toggleChoice(combo, {}, 24, 240), 24, 240);
  assert.deepEqual(optional[24], {});
});

test('toggleChoice ignores unavailable choices and included groups', () => {
  const sel = L.emptySelection(combo);
  assert.equal(L.toggleChoice(combo, sel, 20, 202), sel);
  assert.equal(L.toggleChoice(combo, sel, 21, 210), sel);
});

test('toggleChoice on a multi group adds and removes', () => {
  const s1 = L.toggleChoice(burger, {}, 11, 110);
  const s2 = L.toggleChoice(burger, s1, 11, 111);
  const s3 = L.toggleChoice(burger, s2, 11, 110);
  assert.deepEqual(s2[11], { 110: 1, 111: 1 });
  assert.deepEqual(s3[11], { 111: 1 });
});

test('stepChoice respects the group maximum and never goes negative', () => {
  let sel = {};
  for (let i = 0; i < 6; i += 1) sel = L.stepChoice(combo, sel, 22, 220, 1);
  assert.equal(L.groupCount(sel, 22), 4);
  sel = L.stepChoice(combo, sel, 22, 221, 1);
  assert.equal(L.groupCount(sel, 22), 4);
  sel = L.stepChoice(combo, sel, 22, 221, -1);
  assert.deepEqual(sel[22], { 220: 4 });
});

test('validateSelection lists the groups still missing choices', () => {
  const errors = L.validateSelection(combo, L.emptySelection(combo));
  assert.deepEqual(errors.map((e) => e.groupId), [20, 22, 23]);
  assert.equal(errors.find((e) => e.groupId === 22).message, 'Mancano 4 scelte');
  assert.equal(errors.find((e) => e.groupId === 20).message, 'Manca 1 scelta');
});

test('unitPrice adds the extras of every selected choice', () => {
  let sel = L.toggleChoice(burger, {}, 10, 100);
  sel = L.toggleChoice(burger, sel, 11, 110);
  assert.equal(L.unitPrice(burger, sel), 790);
});

test('describeSelection summarises picks, skipping included groups', () => {
  let sel = L.emptySelection(combo);
  sel = L.toggleChoice(combo, sel, 20, 201);
  sel = L.stepChoice(combo, sel, 22, 220, 1);
  sel = L.stepChoice(combo, sel, 22, 220, 1);
  assert.deepEqual(L.describeSelection(combo, sel), ['The Spicy', '2× Atomic']);
});

test('addToCart merges identical lines and keeps the original cart untouched', () => {
  const line = L.createLine(burger, L.toggleChoice(burger, {}, 10, 100), 1);
  const cart1 = L.addToCart([], line);
  const cart2 = L.addToCart(cart1, L.createLine(burger, L.toggleChoice(burger, {}, 10, 100), 2));
  assert.equal(cart1.length, 1);
  assert.equal(cart1[0].qty, 1);
  assert.equal(cart2.length, 1);
  assert.equal(cart2[0].qty, 3);
  assert.equal(L.cartTotal(cart2), 790 * 3);
  assert.equal(L.cartCount(cart2), 3);
});

test('addToCart keeps differently customised items on separate lines', () => {
  const plain = L.createLine(burger, {}, 1);
  const star = L.createLine(burger, L.toggleChoice(burger, {}, 10, 100), 1);
  assert.equal(L.addToCart(L.addToCart([], plain), star).length, 2);
});

test('changeQty updates and removes lines that reach zero', () => {
  const cart = L.addToCart([], L.createLine(burger, {}, 2));
  const key = cart[0].key;
  assert.equal(L.changeQty(cart, key, 1)[0].qty, 3);
  assert.deepEqual(L.changeQty(cart, key, -2), []);
  assert.equal(cart[0].qty, 2);
});

const hours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '12:00', close: '23:00' }));

test('openStatus reports open and closing time inside opening hours', () => {
  assert.deepEqual(L.openStatus(hours, { day: 2, minutes: 13 * 60 }), { open: true, until: '23:00' });
});

test('openStatus reports the next opening when closed', () => {
  assert.deepEqual(L.openStatus(hours, { day: 2, minutes: 9 * 60 }), { open: false, next: '12:00', nextDay: 2 });
  assert.deepEqual(L.openStatus(hours, { day: 6, minutes: 23 * 60 + 30 }), { open: false, next: '12:00', nextDay: 0 });
});

test('hoursSummary collapses identical days and names the others', () => {
  assert.deepEqual(L.hoursSummary(hours), [{ label: 'Tutti i giorni', time: '12:00 – 23:00' }]);
  const mixed = [{ day: 0, open: '18:00', close: '23:00' }, { day: 5, open: '12:00', close: '23:30' }];
  assert.deepEqual(L.hoursSummary(mixed), [
    { label: 'Lunedì', time: '18:00 – 23:00' },
    { label: 'Sabato', time: '12:00 – 23:30' },
  ]);
  assert.equal(L.dayName(6), 'Domenica');
});

test('pickupSlots lists today\'s slots after the preparation lead time', () => {
  const slots = L.pickupSlots(hours, { day: 1, minutes: 21 * 60 + 50 }, 30, 20);
  assert.deepEqual(slots, ['22:30']);
  assert.equal(L.pickupSlots(hours, { day: 1, minutes: 9 * 60 }, 30, 20)[0], '12:00');
  assert.deepEqual(L.pickupSlots(hours, { day: 1, minutes: 22 * 60 + 50 }, 30, 20), []);
});

test('buildOrderMessage lists lines, extras, total and pickup details', () => {
  const cart = L.addToCart([], L.createLine(burger, L.toggleChoice(burger, {}, 10, 100), 2));
  const text = L.buildOrderMessage(cart, { name: 'Giulia', pickup: '19:30', notes: 'Senza fretta' });
  assert.match(text, /2× The Original — € 15,80/);
  assert.match(text, /STAR/);
  assert.match(text, /Totale: € 15,80/);
  assert.match(text, /Ritiro: 19:30/);
  assert.match(text, /Nome: Giulia/);
  assert.match(text, /Note: Senza fretta/);
});

test('whatsappUrl keeps only digits in the number and encodes the text', () => {
  assert.equal(L.whatsappUrl('+39 333 123 4567', 'Ciao & grazie'), 'https://wa.me/393331234567?text=Ciao%20%26%20grazie');
});

test('suggestions come from pairings of cart items, skipping what is already in the cart', () => {
  const menu = {
    bestSellers: [3],
    categories: [{ id: 9, name: 'X', items: [
      { ...burger, available: true, pairsWith: [2, 4, 3] },
      { ...combo, available: true, pairsWith: [] },
      { id: 3, name: 'Coca', price: 300, available: true, options: [], pairsWith: [] },
      { id: 4, name: 'Fanta', price: 300, available: false, options: [], pairsWith: [] },
    ] }],
  };
  const cart = L.addToCart([], L.createLine(burger, {}, 1));
  assert.deepEqual(L.suggestions(menu, cart, 3).map((i) => i.id), [2, 3]);
});

test('closing at midnight is stored as 24:00 and shown as 00:00', () => {
  const late = [{ day: 4, open: '11:00', close: '24:00' }];
  assert.deepEqual(L.openStatus(late, { day: 4, minutes: 23 * 60 + 45 }), { open: true, until: '00:00' });
  assert.equal(L.pickupSlots(late, { day: 4, minutes: 23 * 60 }, 30, 20).at(-1), '23:30');
  assert.equal(L.displayTime('24:00'), '00:00');
});

test('showcaseItems keeps one product per kind, without piece counts, and only with a photo', () => {
  const items = [
    { id: 1, name: 'Tenders 4 pezzi', description: '', image: 'a.webp' },
    { id: 2, name: 'Tenders 6 pezzi', description: '', image: 'b.webp' },
    { id: 3, name: 'Nuggets', description: 'Bocconcini di pollo - 6 pezzi\n', image: 'c.webp' },
    { id: 4, name: 'Senza foto', description: '', image: null },
  ];
  assert.deepEqual(L.showcaseItems(items).map((i) => [i.id, i.name, i.description]), [
    [1, 'Tenders', ''],
    [3, 'Nuggets', 'Bocconcini di pollo'],
  ]);
});
