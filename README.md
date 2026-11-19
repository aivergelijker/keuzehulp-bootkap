# eSails Keuzehulp (3-in-1)

Eén keuzehulp voor esails.nl met drie modules:

- **Bootkap & dekzeil**: buiskap/achtertent, bimini, dekzeil/winterkleed
- **Afdekzeil op maat**: loungeset, tuintafel, (kogel)bbq, buitenkeuken, jacuzzi, plat zeil
- **Zonwering**: raam (zuignappen) en balkon (elastiek)

Een klant kan meerdere items in één pakket zetten, bijvoorbeeld 3 ramen en een balkon, of een bank en een bbq. Gereedschap en "1× per order"-producten worden dan maar één keer besteld.

## Installatie op Lightspeed

1. Bouw het script met `npm install && npm run build` (geminified, ±35 kB gzip). Daarna staat alles in één bestand: `dist/esails-keuzehulp.js`.
2. Upload dat bestand naar de host waar je het nu ook hebt staan (Supabase storage).
3. Zet op de pagina:

```html
<div id="esails-keuzehulp"></div>
<script src="https://<jouw-host>/esails-keuzehulp.js" defer></script>
```

- Een module direct openen kan met `<div id="esails-keuzehulp" data-module="afdekzeil"></div>` of met `?keuzehulp=zonwering` in de URL.
- De oude mount-ID's (`esails-wizard-mount`, `esails-jacuzzi-mount`, `esails-zonwering-mount`) werken ook nog.
- De CSS zit in het script en is gescoped onder `.eskh`. De kleuren pas je aan via CSS-variabelen, bijvoorbeeld:

```css
#esails-keuzehulp { --eskh-primary:#0f1c3f; --eskh-cta:#e8a33d; --eskh-cta-text:#111; }
```

## Hoe het werkt

| Bestand | Rol |
|---|---|
| `src/core.js` | Rekenmodellen per vorm en een snijplan per rolbreedte. Dit is shelf-packing met kolommen, rotatie en de goedkoopste splitsrichting voor panelen die breder zijn dan de rol. Doek wordt altijd in hele meters besteld. |
| `src/pakket.js` | Zet de keuzes om in exacte winkelwagenregels (variant-ID + aantal). |
| `src/catalog.js` | **Gegenereerd** door `tools/build_catalog.py` uit een crawl van esails.nl. Het bevat alle doeken, kleuren, garen en onderdelen met variant-ID's. |
| `src/live.js` | Haalt live prijs en voorraad op via `/<product>.html?format=json`. Zet de regels één voor één in de winkelwagen via `POST /cart/add/<vid>/` en controleert daarna `/cart/?format=json`. Pusht ook GTM-events. |
| `src/ui.js` + `src/style.css` | De wizard zelf. |

- **Live prijzen:** de prijzen in de catalogus zijn alleen een vangnet. In de shop toont de tool altijd de actuele prijs incl. btw en de voorraadstatus (op voorraad / op bestelling / niet leverbaar).
- **Niet-leverbare producten** kun je niet selecteren en ze worden nooit in de winkelwagen gezet. Een product dat uit de shop verdwenen is (404 of variant weg) telt ook als niet leverbaar.
- **Prijsindicatie** staat vanaf de doekkeuze live in beeld, op mobiel als vaste balk bovenaan.
- **Staal bestellen:** bij Sunbrella en Sauleda kan de klant een staal van de gekozen kleur direct in de winkelwagen zetten.
- **Zonwering zonder voorraad:** zijn alle gaasdoeken uitverkocht, dan toont de modulekaart "Binnenkort weer leverbaar".
- **Toevoegen mislukt?** De klant ziet dan welke regels niet lukten, met een knop om het opnieuw te proberen.

### Tracking (GTM `dataLayer`)

- `keuzehulp_start`, `keuzehulp_module`, `keuzehulp_stap`, `keuzehulp_item_klaar` en `keuzehulp_overzicht`
- `add_to_cart` in GA4-ecommerceformaat, met `keuzehulp: true`
- `keuzehulp_cart_klaar`, `keuzehulp_cart_fout`, `keuzehulp_deel` en `keuzehulp_staal`

### Overig

- **Bewaren en delen:** de voortgang blijft 14 dagen bewaard in `localStorage`. "Kopieer link" maakt een deelbare link met het hele pakket.

## Catalogus bijwerken

```bash
python3 -I tools/crawl.py crawl            # leest esails.nl (alleen lezen, ±5 min, rustig tempo)
python3 -I tools/build_catalog.py crawl    # schrijft src/catalog.js
npm test && npm run build
```

- Productkeuzes staan in `SPEC` in `tools/build_catalog.py`. Pas die aan en draai de generator opnieuw.
- Stalen (Sunbrella Plus, Sauleda) worden per kleur automatisch gekoppeld op kleurnaam.
- Het overzicht om te controleren staat in `docs/PRODUCTKEUZES.md`.

## Testversie (zonder esails.nl)

`npm run build && npm run demo` maakt `dist/demo.html`: de complete tool met prijzen uit de catalogus en een nagebootste winkelwagen. Na "Alles in winkelwagen" zie je precies welke variant-ID's en aantallen besteld zouden worden.

## Testen

```bash
npm test                 # rekenkern + alle module/doek/bevestiging/optie-combinaties
npm run build
node test/e2e.js         # Chromium, 3 scenario's × desktop/mobiel, met nagebootste shop-API
```

De e2e-test controleert dat de winkelwagen exact gelijk is aan het pakket, dat live prijzen worden toegepast, dat niet-leverbare kleuren geblokkeerd zijn en dat er geen JS-fouten optreden.

`legacy/` bevat de vorige bootkap-wizard (v2) ter referentie.
