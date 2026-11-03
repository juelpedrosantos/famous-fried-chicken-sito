/**
 * Carrello e checkout del menu: rendering del pannello, quantità, suggerimenti, invio ordine.
 * Espone window.FFCCart.mount(options); dipende da FFCLogic e FFCRender.
 */
(function (root) {
  'use strict';

  const L = root.FFCLogic;
  const { ICONS, img } = root.FFCRender;
  const esc = L.escapeHtml;
  const MAX_SUGGESTIONS = 3;
  const MAX_NAME_LENGTH = 60;
  const MAX_NOTES_LENGTH = 300;

  /**
   * @param {{
   *   dialog: HTMLDialogElement, menu: object, config: { whatsappNumber?: string, prepMinutes?: number },
   *   getCart: () => object[], setCart: (cart: object[]) => void,
   *   openItem: (id: number) => void, notify: (text: string) => void
   * }} options
   */
  function mount(options) {
    const { dialog, menu, config, getCart, setCart, openItem, notify } = options;
    const useWhatsapp = Boolean(String(config.whatsappNumber || '').replace(/\D/g, ''));
    let checkout = { name: '', pickup: '', notes: '' };
    let showErrors = false;

    function slots() {
      const now = L.romeNow(new Date());
      return L.pickupSlots(menu.business.hours, now, menu.business.pickupIntervalMinutes || 30, config.prepMinutes || 20);
    }

    function lineRow(line) {
      const item = L.findItem(menu, line.itemId);
      const key = esc(line.key);
      return `
        <li class="cart-line">
          ${img(item && item.image, '', 'cart-line__img')}
          <div class="cart-line__info">
            <p class="cart-line__name">${esc(line.name)}</p>
            ${line.summary.length ? `<p class="cart-line__summary">${esc(line.summary.join(', '))}</p>` : ''}
            <p class="cart-line__unit">${L.formatPrice(line.unitPrice)} cad.</p>
          </div>
          <div class="cart-line__side">
            <span class="stepper stepper--small">
              <button type="button" class="stepper__btn" data-line="${key}" data-delta="-1" data-focus-key="${key}:-1" aria-label="${line.qty === 1 ? 'Rimuovi' : 'Togli uno'}: ${esc(line.name)}">${line.qty === 1 ? ICONS.close : ICONS.minus}</button>
              <output class="stepper__value">${line.qty}</output>
              <button type="button" class="stepper__btn" data-line="${key}" data-delta="1" data-focus-key="${key}:1" aria-label="Aggiungi un altro: ${esc(line.name)}">${ICONS.plus}</button>
            </span>
            <strong class="cart-line__total">${L.formatPrice(line.unitPrice * line.qty)}</strong>
          </div>
        </li>`;
    }

    function suggestionsBlock(cart) {
      const items = L.suggestions(menu, cart, MAX_SUGGESTIONS);
      if (!items.length) return '';
      return `
        <section class="cart-suggest" aria-labelledby="cart-suggest-title">
          <h3 id="cart-suggest-title" class="cart-block-title">Ci sta bene anche</h3>
          <ul class="cart-suggest__list" role="list">
            ${items.map((i) => `
              <li><button type="button" class="suggest-card" data-suggest="${i.id}" data-focus-key="suggest:${i.id}">
                ${img(i.image, '', 'suggest-card__img')}
                <span class="suggest-card__name">${esc(i.name)}</span>
                <span class="suggest-card__price">${L.formatPrice(i.price)}</span>
              </button></li>`).join('')}
          </ul>
        </section>`;
    }

    function checkoutBlock() {
      const address = esc(menu.business.address.street + ', ' + menu.business.address.city);
      if (!useWhatsapp) {
        return `
          <section class="checkout" aria-labelledby="checkout-title">
            <h3 id="checkout-title" class="cart-block-title">Ritiro in negozio</h3>
            <p class="checkout__where">${address}</p>
            <p class="checkout__note">Il pagamento online e la conferma dell'ordine avvengono sulla piattaforma ufficiale Qromo, che si apre in una nuova scheda.</p>
          </section>`;
      }
      const available = slots();
      const err = (field) => (showErrors && !checkout[field] ? ' aria-invalid="true"' : '');
      const slotOptions = available.map((s) => `<option value="${s}"${s === checkout.pickup ? ' selected' : ''}>${s}</option>`).join('');
      return `
        <section class="checkout" aria-labelledby="checkout-title">
          <h3 id="checkout-title" class="cart-block-title">Ritiro in negozio</h3>
          <p class="checkout__where">${address}</p>
          ${available.length ? `
          <label class="field"><span class="field__label">Orario di ritiro</span>
            <select class="field__input" data-checkout="pickup" data-focus-key="f:pickup"${err('pickup')}>
              <option value="">Scegli un orario</option>${slotOptions}
            </select></label>` : '<p class="checkout__closed">Per oggi gli ordini da asporto sono chiusi. Puoi preparare l\'ordine e inviarlo durante l\'orario di apertura.</p>'}
          <label class="field"><span class="field__label">Nome per il ritiro</span>
            <input class="field__input" type="text" autocomplete="given-name" maxlength="${MAX_NAME_LENGTH}" data-checkout="name" data-focus-key="f:name" value="${esc(checkout.name)}"${err('name')}></label>
          <label class="field"><span class="field__label">Note (facoltative)</span>
            <textarea class="field__input" rows="2" maxlength="${MAX_NOTES_LENGTH}" data-checkout="notes" data-focus-key="f:notes">${esc(checkout.notes)}</textarea></label>
          ${showErrors ? '<p class="checkout__error" role="alert">Inserisci il nome e scegli l\'orario di ritiro.</p>' : ''}
        </section>`;
    }

    function emptyState() {
      return `
        <div class="cart-empty">
          <img src="../assets/img/brand/mascot.png" alt="" width="120" height="120">
          <p class="display cart-empty__title">Il vassoio è vuoto</p>
          <p>Scegli qualcosa di croccante dal menu.</p>
          <button class="btn btn--yellow" type="button" data-close-dialog>Sfoglia il menu</button>
        </div>`;
    }

    function render() {
      const cart = getCart();
      const focusKey = document.activeElement && dialog.contains(document.activeElement)
        ? document.activeElement.getAttribute('data-focus-key') : null;
      const canSend = !useWhatsapp || slots().length > 0;
      const head = `
        <div class="sheet__head">
          <h2 id="cart-dialog-title" class="display sheet__title">Il tuo ordine</h2>
          <button class="icon-btn" type="button" data-close-dialog aria-label="Chiudi">${ICONS.close}</button>
        </div>`;
      if (!cart.length) {
        dialog.innerHTML = head + `<div class="sheet__body">${emptyState()}</div>`;
        return;
      }
      dialog.innerHTML = head + `
        <div class="sheet__body">
          <ul class="cart-lines" role="list">${cart.map(lineRow).join('')}</ul>
          <button class="link-btn cart-clear" type="button" data-clear-cart>Svuota il carrello</button>
          ${suggestionsBlock(cart)}
          ${checkoutBlock()}
        </div>
        <div class="sheet__foot cart-foot">
          <p class="cart-foot__total"><span>Totale</span> <strong>${L.formatPrice(L.cartTotal(cart))}</strong></p>
          <button class="btn cart-foot__cta" type="button" data-send-order${canSend ? '' : ' disabled'}>
            ${useWhatsapp ? 'Invia su WhatsApp' : 'Completa su Qromo'}
          </button>
        </div>`;
      if (focusKey) {
        const target = dialog.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
        if (target) target.focus();
      }
    }

    /** Un orario scelto prima può non essere più valido (tempo di preparazione superato). */
    function dropStalePickup() {
      if (checkout.pickup && !slots().includes(checkout.pickup)) {
        checkout = { ...checkout, pickup: '' };
      }
    }

    function sendOrder() {
      const cart = getCart();
      if (!cart.length) return;
      if (!useWhatsapp) {
        root.open(menu.business.orderUrl, '_blank', 'noopener');
        return;
      }
      dropStalePickup();
      if (!checkout.name.trim() || !checkout.pickup) {
        showErrors = true;
        render();
        return;
      }
      const text = L.buildOrderMessage(cart, {
        name: checkout.name.trim(), pickup: checkout.pickup, notes: checkout.notes.trim(),
      });
      root.open(L.whatsappUrl(config.whatsappNumber, text), '_blank', 'noopener');
      dialog.close();
      notify('Ordine pronto su WhatsApp: invialo e attendi la conferma del locale.');
    }

    dialog.addEventListener('click', (event) => {
      const t = event.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-line')) {
        setCart(L.changeQty(getCart(), t.getAttribute('data-line'), Number(t.getAttribute('data-delta'))));
      } else if (t.hasAttribute('data-suggest')) {
        dialog.close();
        openItem(Number(t.getAttribute('data-suggest')));
      } else if (t.hasAttribute('data-clear-cart')) {
        setCart([]);
      } else if (t.hasAttribute('data-send-order')) {
        sendOrder();
      }
    });

    dialog.addEventListener('input', (event) => {
      const field = event.target.getAttribute('data-checkout');
      if (!field) return;
      checkout = { ...checkout, [field]: event.target.value };
    });

    return {
      render,
      open() {
        showErrors = false;
        dropStalePickup();
        render();
        if (!dialog.open) dialog.showModal();
      },
    };
  }

  root.FFCCart = { mount };
})(typeof self !== 'undefined' ? self : this);
