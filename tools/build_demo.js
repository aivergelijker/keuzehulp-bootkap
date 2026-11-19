#!/usr/bin/env node
/* Bouwt dist/demo.html: de keuzehulp los te testen, zonder esails.nl.
   - Prijzen/voorraad: uit src/catalog.js (+ optioneel status.json van een crawl)
   - Winkelwagen: nagebootst; na "Alles in winkelwagen" zie je exact wat er besteld zou worden.
   Gebruik: node tools/build_demo.js [pad/naar/status.json]   (na npm run build) */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const bundle = fs.readFileSync(path.join(root, 'dist', 'esails-keuzehulp.js'), 'utf8');
const cat = require(path.join(root, 'src', 'catalog.js'));
let status = {};
if (process.argv[2] && fs.existsSync(process.argv[2])) status = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).status || {};

// niet-leverbare variant-ID's volgens de crawl
const uit = [];
Object.entries(status).forEach(([k, ok]) => {
  if (ok) return;
  if (k.startsWith('doek:')) uit.push(k.slice(5));
  else if (cat.p[k]) uit.push(String(cat.p[k].vid));
});

const demo = `
(function () {
  var UIT = ${JSON.stringify(uit)};
  var cart = {};
  function byUrl() {
    var c = window.EsailsCatalog, m = {};
    function reg(p) { if (p && p.url) (m[p.url] = m[p.url] || {})[p.vid] = p; }
    Object.keys(c.p).forEach(function (k) { reg(c.p[k]); });
    Object.keys(c.garen).forEach(function (k) { reg(c.garen[k]); });
    Object.keys(c.doeken).forEach(function (k) { c.doeken[k].kleuren.forEach(function (x) { reg(x); if (x.staal) reg(x.staal); }); });
    Object.keys(c.ritsen).forEach(function (t) { Object.keys(c.ritsen[t]).forEach(function (l) { reg(c.ritsen[t][l]); }); });
    return m;
  }
  function json(o, st) { return Promise.resolve(new Response(JSON.stringify(o), { status: st || 200, headers: { 'Content-Type': 'application/json' } })); }
  var echt = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opt) {
    var u = String(url);
    if (/^https?:/.test(u) && echt) return echt(url, opt);
    var pad = u.split('?')[0].replace(/^\\//, '');
    var m = /^cart\\/add\\/(\\d+)\\/$/.exec(pad);
    if (m) {
      var q = Number(new URLSearchParams((opt && opt.body) || '').get('quantity')) || 1;
      cart[m[1]] = (cart[m[1]] || 0) + q;
      return new Promise(function (ok) { setTimeout(function () { ok(new Response('ok', { status: 200 })); }, 80); });
    }
    if (pad === 'cart/') return json({ page: { cart: { products: Object.keys(cart).map(function (v) { return { vid: Number(v), quantity: cart[v] }; }) } } });
    var vs = byUrl()[pad];
    if (!vs) return json({}, 404);
    var variants = {};
    Object.keys(vs).forEach(function (vid) {
      var weg = UIT.indexOf(String(vid)) >= 0;
      variants[vid] = { id: Number(vid), title: '', price: { price_incl: vs[vid].prijs }, stock: { available: !weg, on_stock: !weg, level: weg ? 0 : 25, delivery: { title: weg ? 'Momenteel niet leverbaar' : 'Op voorraad' } } };
    });
    return new Promise(function (ok) { setTimeout(function () { ok(new Response(JSON.stringify({ product: { variants: variants } }), { status: 200, headers: { 'Content-Type': 'application/json' } })); }, 120); });
  };
  window.ESKH_DEMO = {
    klaar: function (regels) {
      var c = window.EsailsCatalog, naam = {};
      regels.forEach(function (r) { naam[r.vid] = r; });
      var tot = 0, rows = Object.keys(cart).map(function (v) {
        var r = naam[v] || {}, p = (r.prijsLive != null ? r.prijsLive : r.prijs) || 0; tot += p * cart[v];
        return '<tr><td>' + (r.naam || ('Staal / product ' + v)) + '</td><td>' + v + '</td><td style="text-align:right">' + cart[v] + '</td><td style="text-align:right">€ ' + (p * cart[v]).toFixed(2).replace('.', ',') + '</td></tr>';
      }).join('');
      var el = document.getElementById('demo-cart');
      el.innerHTML = '<h2>Gesimuleerde winkelwagen</h2><p>Dit zou de tool op esails.nl in de winkelwagen zetten (POST /cart/add/&lt;variant-ID&gt;/):</p>' +
        '<table><thead><tr><th>Product</th><th>Variant-ID</th><th>Aantal</th><th>Prijs</th></tr></thead><tbody>' + rows + '</tbody>' +
        '<tfoot><tr><td colspan="3"><strong>Totaal</strong></td><td style="text-align:right"><strong>€ ' + tot.toFixed(2).replace('.', ',') + '</strong></td></tr></tfoot></table>' +
        '<button type="button" onclick="location.reload()">Opnieuw testen</button>';
      el.hidden = false; el.scrollIntoView({ behavior: 'smooth' });
    }
  };
})();`;

const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>eSails Keuzehulp – testversie</title>
<style>
:root{color-scheme:light}
body{margin:0;background:#f3f4f6;font-family:"Fira Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#16181d}
.demo-bar{background:#fff4e0;border-bottom:1px solid #f1d39b;padding:10px 16px;font-size:13.5px;line-height:1.45}
.demo-bar strong{color:#5c3b00}
#demo-cart{max-width:960px;margin:0 auto 40px;padding:20px 24px;background:#fff;border:1px solid #e3e5e9;border-radius:10px;box-sizing:border-box}
#demo-cart table{width:100%;border-collapse:collapse;font-size:14px;margin:12px 0}
#demo-cart th,#demo-cart td{border-bottom:1px solid #e3e5e9;padding:7px 6px;text-align:left}
#demo-cart button{padding:10px 18px;border-radius:8px;border:0;background:#0f1c3f;color:#fff;font:inherit;cursor:pointer}
@media(max-width:720px){#demo-cart{margin:0 0 30px;border-radius:0;padding:16px}#demo-cart td:nth-child(2),#demo-cart th:nth-child(2){display:none}}
</style></head>
<body>
<div class="demo-bar"><strong>Testversie.</strong> Prijzen en voorraad komen uit de catalogus van ${cat.versie} (niet live). De winkelwagen wordt nagebootst: na “Alles in winkelwagen” zie je onderaan precies wat er besteld zou worden. Je voortgang blijft bewaard in deze browser.</div>
<div id="esails-keuzehulp"></div>
<div id="demo-cart" hidden></div>
<script>${demo}</script>
<script>${bundle}</script>
</body></html>`;

fs.writeFileSync(path.join(root, 'dist', 'demo.html'), html);
console.log('dist/demo.html', (html.length / 1024).toFixed(1) + ' kB, ' + uit.length + ' niet-leverbare varianten gesimuleerd');
