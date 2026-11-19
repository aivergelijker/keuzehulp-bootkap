/* End-to-end test in Chromium met nagebootste Lightspeed-endpoints.
   Gebruik: node test/e2e.js [--shots <map>]
   - /<product>.html?format=json  -> prijs/voorraad uit src/catalog.js (live-simulatie, 1 product uitverkocht)
   - POST /cart/add/<vid>/         -> wordt gelogd en in een nep-cart gezet
   - /cart/?format=json            -> nep-cart                                      */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const cat = require('../src/catalog.js');

const bundle = fs.readFileSync(path.join(__dirname, '..', 'dist', 'esails-keuzehulp.js'), 'utf8');
const shotsIdx = process.argv.indexOf('--shots');
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// url -> varianten
const byUrl = {};
function reg(p) { if (!p || !p.url) return; (byUrl[p.url] = byUrl[p.url] || {})[p.vid] = p; }
Object.values(cat.p).forEach(reg); Object.values(cat.garen).forEach(reg);
Object.values(cat.doeken).forEach(d => d.kleuren.forEach(reg));
Object.values(cat.ritsen).forEach(r => Object.values(r).forEach(reg));
const UITVERKOCHT = new Set([String(cat.doeken.sunbrella_plus.kleuren[1].vid)]);

async function run() {
  const browser = await chromium.launch();
  const resultaten = [];
  for (const scenario of SCENARIOS) {
    for (const vp of [{ w: 1280, h: 900, naam: 'desktop' }, { w: 390, h: 844, naam: 'mobiel' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      const cart = {}; const posts = []; const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
      await page.route('**/*', async route => {
        const u = new URL(route.request().url());
        if (u.pathname === '/keuzehulp/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>t</title></head><body style="margin:0;font-family:Arial"><div id="esails-keuzehulp"></div><script>${bundle}</script></body></html>` });
        const m = /^\/cart\/add\/(\d+)\/$/.exec(u.pathname);
        if (m && route.request().method() === 'POST') {
          const q = Number(new URLSearchParams(route.request().postData() || '').get('quantity'));
          posts.push({ vid: m[1], q }); cart[m[1]] = (cart[m[1]] || 0) + q;
          return route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' });
        }
        if (u.pathname === '/cart/' && u.searchParams.get('format') === 'json')
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ page: { cart: { products: Object.entries(cart).map(([vid, quantity]) => ({ id: 1, vid: Number(vid), quantity })) } } }) });
        if (u.pathname === '/cart/') return route.fulfill({ contentType: 'text/html', body: '<h1>cart</h1>' });
        const url = u.pathname.replace(/^\//, '');
        if (u.searchParams.get('format') === 'json' && byUrl[url]) {
          const vs = byUrl[url]; const variants = {};
          Object.values(vs).forEach(p => { const out = UITVERKOCHT.has(String(p.vid)); variants[p.vid] = { id: Number(p.vid), title: 'x', price: { price_incl: Math.round(p.prijs * 1.1 * 100) / 100 }, stock: { available: !out, on_stock: !out, level: out ? 0 : 50, delivery: { title: '' } } }; });
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ product: { variants } }) });
        }
        if (/webshopapp/.test(u.host)) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 404, body: '' });
      });
      await page.goto('http://shop.test/keuzehulp/');
      const t0 = Date.now();
      try {
        await scenario.stappen(page, SHOTS ? n => page.screenshot({ path: path.join(SHOTS, `${scenario.naam}-${vp.naam}-${n}.png`), fullPage: true }) : async () => {});
        // overzicht
        await page.waitForSelector('.eskh-board');
        await page.waitForTimeout(300);
        const pk = await page.evaluate(() => window.EsailsKeuzehulp._pakket());
        const totaalUI = await page.textContent('.eskh-total strong');
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${scenario.naam}-${vp.naam}-overzicht.png`), fullPage: true });
        scenario.check && scenario.check(pk);
        // live prijs (x1.1) moet in het totaal zitten
        const verwacht = pk.regels.filter(r => r.qty > 0).reduce((s, r) => s + r.qty * r.prijsLive, 0);
        assert.strictEqual(totaalUI.replace(/\s/g, ''), ('€' + verwacht.toFixed(2).replace('.', ',')), 'totaal in UI');
        assert.ok(pk.regels.every(r => Math.abs(r.prijsLive - Math.round(r.prijs * 1.1 * 100) / 100) < 0.001), 'live prijzen toegepast');
        await page.click('[data-act="cart"]');
        await page.waitForURL('**/cart/', { timeout: 15000 });
        const verwachtCart = {};
        pk.regels.filter(r => r.qty > 0 && !UITVERKOCHT.has(r.vid)).forEach(r => { verwachtCart[r.vid] = r.qty; });
        assert.deepStrictEqual(cart, verwachtCart, 'winkelwagen = pakket');
        assert.strictEqual(errors.length, 0, 'geen JS-fouten: ' + errors.join(' | '));
        resultaten.push(`ok   ${scenario.naam} (${vp.naam}) — ${posts.length} regels in cart, ${totaalUI}, ${Date.now() - t0} ms`);
      } catch (e) {
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${scenario.naam}-${vp.naam}-FOUT.png`), fullPage: true });
        resultaten.push(`FOUT ${scenario.naam} (${vp.naam}) — ${e.message}\n     js-fouten: ${errors.join(' | ')}`);
      }
      await page.close();
    }
  }
  await browser.close();
  console.log(resultaten.join('\n'));
  if (resultaten.some(r => r.startsWith('FOUT'))) process.exit(1);
}

const klik = (page, sel) => page.click(sel);
const volgende = page => page.click('[data-act="volgende"]');
async function zetMaat(page, key, v) { const el = page.locator(`input[type=number][data-maat="${key}"]`); await el.fill(String(v)); await el.press('Enter'); }

const SCENARIOS = [
  {
    naam: 'bootkap-buiskap',
    stappen: async (page, shot) => {
      await shot('1-module');
      await klik(page, '[data-set="module"][data-val="bootkap"]');
      await klik(page, '[data-set="vorm"][data-val="buiskap"]');
      await zetMaat(page, 'lengte', 260); await zetMaat(page, 'breedte', 230); await zetMaat(page, 'hoogte', 115);
      await klik(page, '[data-toggle="maten.achterkant"]');
      await shot('3-maten');
      await volgende(page);
      await klik(page, '[data-set="doek"][data-val="sunbrella_plus"]');
      await page.waitForTimeout(200);
      // uitverkochte kleur mag niet selecteerbaar zijn
      await page.click(`[data-kleur="${cat.doeken.sunbrella_plus.kleuren[1].vid}"]`, { force: true });
      assert.ok(await page.isVisible('.eskh-melding'), 'melding bij uitverkochte kleur');
      await klik(page, `[data-kleur="${cat.doeken.sunbrella_plus.kleuren.find(k => /Captain Navy/.test(k.naam)).vid}"]`);
      await shot('4-doek');
      await volgende(page);
      await shot('5-verwerking');
      await volgende(page);
      await klik(page, '[data-toggle="extras.raamfolie"]');
      await page.fill('[data-path="extras.raamfolie.breedte"]', '180'); await page.press('[data-path="extras.raamfolie.breedte"]', 'Enter');
      await page.fill('[data-path="extras.raamfolie.hoogte"]', '45'); await page.press('[data-path="extras.raamfolie.hoogte"]', 'Enter');
      await klik(page, '[data-toggle="extras.ritsen"]');
      // volgende moet blokkeren zolang ritslengte ontbreekt
      await page.click('[data-act="volgende"]', { force: true });
      assert.ok(await page.isVisible('.eskh-melding'), 'validatie rits');
      await klik(page, '[data-path-set="extras.ritsen.0.lengte"][data-val="200"]');
      await shot('6-extras');
      await volgende(page);
      await klik(page, '[data-set="bevestiging"][data-val="loxx"]');
      await klik(page, '[data-path-set="opt.loxxBasis"][data-val="bout"]');
      await shot('7-bevestiging');
      await volgende(page);
    },
    check: pk => {
      const keys = pk.regels.map(r => r.key);
      ['doek', 'garen', 'raamfolie', 'tape', 'loxx_kop', 'loxx_basis', 'loxx_moer', 'loxx_sleutel', 'loxx_holpijp'].forEach(k => assert.ok(keys.includes(k), 'regel ' + k));
      assert.ok(keys.some(k => k.startsWith('rits_')), 'rits');
    }
  },
  {
    naam: 'afdekzeil-loungeset-plus-bbq',
    stappen: async (page, shot) => {
      await klik(page, '[data-set="module"][data-val="afdekzeil"]');
      await shot('2-object');
      await klik(page, '[data-object="loungeset"]');
      await zetMaat(page, 'lengte', 240);
      await volgende(page);
      await klik(page, '[data-set="doek"][data-val="ferrari_705"]');
      await klik(page, `[data-kleur="${cat.doeken.ferrari_705.kleuren.find(k => /Antraciet/.test(k.naam)).vid}"]`);
      await volgende(page);
      await klik(page, '[data-set="verwerking"][data-val="lijmen"]');
      await volgende(page);
      await klik(page, '[data-set="bevestiging"][data-val="tunnel"]');
      await volgende(page);
      await page.waitForSelector('.eskh-board');
      // tweede item: bbq rond
      await klik(page, '[data-act="nieuw"]');
      await klik(page, '[data-set="module"][data-val="afdekzeil"]');
      await klik(page, '[data-object="bbq_rond"]');
      await volgende(page);
      await klik(page, '[data-set="doek"][data-val="ferrari_705"]');
      await klik(page, `[data-kleur="${cat.doeken.ferrari_705.kleuren.find(k => /Zwart/.test(k.naam)).vid}"]`);
      await volgende(page);
      await klik(page, '[data-set="verwerking"][data-val="naaien"]');
      await volgende(page);
      await klik(page, '[data-set="bevestiging"][data-val="ring"]');
      await volgende(page);
      await page.waitForSelector('.eskh-board');
      await klik(page, '[data-onderhoud="glaspotlood"]');
    },
    check: pk => {
      assert.strictEqual(pk.perItem.length, 2);
      const keys = pk.regels.map(r => r.key);
      ['lijm', 'ontvetter', 'koord', 'koordklem', 'ring', 'aanslag', 'ring_set', 'garen', 'glaspotlood'].forEach(k => assert.ok(keys.includes(k), 'regel ' + k));
      assert.strictEqual(pk.regels.filter(r => r.groep === 'doek').length, 2, 'twee doekkleuren');
    }
  },
  {
    naam: 'zonwering-3-ramen-en-balkon',
    stappen: async (page, shot) => {
      await klik(page, '[data-set="module"][data-val="zonwering"]');
      await klik(page, '[data-set="vorm"][data-val="raam"]');
      await zetMaat(page, 'breedte', 140); await zetMaat(page, 'hoogte', 120);
      await klik(page, '[data-step="aantal"][data-d="1"]'); await klik(page, '[data-step="aantal"][data-d="1"]');
      await volgende(page);
      await klik(page, '[data-set="doek"][data-val="mehler_gaas"]');
      await klik(page, `[data-kleur="${cat.doeken.mehler_gaas.kleuren[0].vid}"]`);
      await volgende(page);
      await klik(page, '[data-set="bevestiging"][data-val="zuignap"]');
      await volgende(page);
      await page.waitForSelector('.eskh-board');
      await klik(page, '[data-act="nieuw"]');
      await klik(page, '[data-set="module"][data-val="zonwering"]');
      await klik(page, '[data-set="vorm"][data-val="balkon"]');
      await zetMaat(page, 'breedte', 380); await zetMaat(page, 'hoogte', 95);
      await volgende(page);
      await klik(page, '[data-set="doek"][data-val="mehler_gaas"]');
      await klik(page, `[data-kleur="${cat.doeken.mehler_gaas.kleuren[1].vid}"]`);
      await volgende(page);
      await klik(page, '[data-set="bevestiging"][data-val="balkon"]');
      await volgende(page);
      await page.waitForSelector('.eskh-board');
      // handmatig aantal aanpassen
      await klik(page, `[data-step="qty:${cat.p.zuignap.vid}"][data-d="1"]`);
    },
    check: pk => {
      const set = pk.regels.find(r => r.key === 'ring_set');
      assert.strictEqual(set.qty, 1, 'één montageset');
      const zuig = pk.regels.find(r => r.key === 'zuignap');
      assert.strictEqual(zuig.qty, zuig.berekend + 1, 'handmatige aanpassing');
      assert.strictEqual(zuig.berekend, (3 + 3) * 2 * 3, 'zuignappen 3 ramen');
    }
  }
];

run().catch(e => { console.error(e); process.exit(1); });
