# Famous Fried Chicken: sito vetrina + menu

Due siti statici (HTML, CSS e JavaScript, senza build) con la grafica del brand:

| Pagina | File | Cosa fa |
| --- | --- | --- |
| Sito vetrina | `index.html` | Hero con foto e logo, specialità, salse, più ordinati, chi siamo, servizi, dove siamo. Ogni "Ordina ora" porta al menu. |
| Menu e ordini | `menu/index.html` | Lo stesso menu di Qromo (foto, prezzi, descrizioni, disponibilità, opzioni) con nuova grafica, carrello e invio dell'ordine. |

## Vederlo in locale

```bash
python3 -m http.server 4173
```

Poi apri http://localhost:4173. Funziona anche aprendo `index.html` con doppio clic.

## Aggiornare il menu da Qromo

Prezzi, prodotti, disponibilità e opzioni arrivano dal menu pubblico su `famousfriedchicken.qromo.it`.
Quando il locale cambia qualcosa su Qromo, rilancia:

```bash
python3 tools/build_menu_data.py
```

Lo script rigenera `assets/js/menu-data.js` e scarica in `assets/img/menu/` le foto dei prodotti nuovi.
Con `--refresh` riscarica anche quelle già presenti. Serve `cwebp` per convertire in WebP (`brew install webp`); senza, salva i JPG originali.

## Invio degli ordini

Il carrello del nuovo menu replica le regole di Qromo (scelte obbligatorie, extra, "senza", glassature, quantità).
Per completare l'ordine ci sono due modalità, scelte in `assets/js/order-config.js`:

- **Qromo** (predefinita, `whatsappNumber: ''`): il pulsante "Completa su Qromo" apre il checkout ufficiale con pagamento online.
- **WhatsApp**: imposta `whatsappNumber` (es. `'393331234567'`). Il cliente sceglie orario di ritiro e nome e l'ordine arriva già scritto in chat.

## Struttura

```
index.html              sito vetrina
menu/index.html         menu e carrello
assets/css/             brand.css (colori, font, bottoni), site.css, menu.css
assets/js/              menu-data.js (generato), menu-logic.js (regole, testate), menu-render.js,
                        menu-cart.js, menu-app.js, site.js, order-config.js
assets/img/brand/       logo scontornato, wordmark, mascotte, texture "carta da vassoio"
assets/img/photos/      foto dal servizio fotografico (WebP)
assets/fonts/           Archivo e Yellowtail ospitati in locale (niente chiamate a Google)
tools/                  import del menu da Qromo, generatore della texture
tests/                  test della logica: node --test tests/menu-logic.test.js
```

## Da confermare con il locale

- Orari: il sito usa gli orari di asporto impostati su Qromo (tutti i giorni 12:00–23:00).
- Testi Fidelity: il dettaglio del programma fedeltà non è pubblico, per ora il box rimanda alle storie Instagram.
- Privacy e cookie: il sito non usa cookie né servizi esterni; il carrello è salvato solo nel browser del cliente. Aggiungi comunque l'informativa privacy del locale prima della pubblicazione.
