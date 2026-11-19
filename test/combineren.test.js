const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/pakket.js');
const BT = require('../src/bouwtekening.js');
const cat = require('../src/catalog.js');

const wit362 = cat.doeken.ferrari_362.kleuren[0].vid;
const raam = (b, h, extra) => Object.assign({ module: 'zonwering', vorm: 'raam', doek: 'ferrari_362', kleur: wit362, bevestiging: 'zuignap',
  verwerking: 'naaien', maten: { breedte: b, hoogte: h }, aantal: 1, opt: {}, extras: {}, gereedschap: true }, extra);
const doekRegels = pk => pk.regels.filter(r => r.groep === 'doek');

test('drie ramen in hetzelfde doek delen één snijplan (2 m i.p.v. 4 m)', () => {
  const items = [raam(157, 100), raam(67, 100), raam(57, 100)];
  const pk = P.bouwPakket({ items }, cat);
  const los = items.reduce((t, it) => t + P.berekenItem(it, cat).plan.meters, 0);
  const d = doekRegels(pk);
  assert.strictEqual(d.length, 1);
  assert.strictEqual(los, 4);
  assert.strictEqual(d[0].qty, 2);
  assert.match(d[0].notitie, /Gezamenlijk snijplan voor items 1, 2, 3/);
  assert.strictEqual(pk.snijplannen.length, 1);
  assert.deepStrictEqual(pk.snijplannen[0].items, [0, 1, 2]);
  assert.strictEqual(pk.snijplannen[0].plan.stukken.length, 3);
});

test('gecombineerd is nooit meer dan elk item apart', () => {
  const maten = [[40, 30], [120, 90], [250, 140], [300, 260], [57, 100], [200, 60]];
  for (let a = 0; a < maten.length; a++) for (let b = 0; b < maten.length; b++) {
    const items = [raam(...maten[a]), raam(...maten[b])];
    const los = items.reduce((t, it) => t + P.berekenItem(it, cat).plan.meters, 0);
    const qty = doekRegels(P.bouwPakket({ items }, cat))[0].qty;
    assert.ok(qty <= los, `${maten[a]} + ${maten[b]}: ${qty} > ${los}`);
  }
});

test('items met verschillend doek of kleur blijven gescheiden', () => {
  const gaas = cat.doeken.mehler_gaas.kleuren[0].vid;
  const pk = P.bouwPakket({ items: [raam(100, 100), raam(100, 100, { doek: 'mehler_gaas', kleur: gaas })] }, cat);
  assert.strictEqual(doekRegels(pk).length, 2);
  assert.strictEqual(pk.snijplannen.filter(g => g.soort === 'doek').length, 2);
});

test('tunnelzoom per item wordt meegenomen in het gezamenlijke plan', () => {
  const k = cat.doeken.ferrari_705.kleuren[0].vid;
  const hoes = bev => ({ module: 'afdekzeil', vorm: 'plat', doek: 'ferrari_705', kleur: k, bevestiging: bev, verwerking: 'lijmen',
    maten: { lengte: 100, breedte: 80, overhang: 0 }, aantal: 1, opt: {}, extras: {} });
  const pk = P.bouwPakket({ items: [hoes('tunnel'), hoes('ring')] }, cat);
  const st = pk.snijplannen[0].plan.stukken;
  const z = st.map(s => s.zoomCm).sort((a, b) => a - b);
  assert.deepStrictEqual(z, [5, 13]);
  st.forEach(s => assert.ok(Math.abs((s.w * s.h) - (s.nettoW + 2 * s.zoomCm) * (s.nettoH + 2 * s.zoomCm)) < 1e-6));
});

test('raamfolie wordt over items heen gecombineerd', () => {
  const sb = cat.doeken.sunbrella_plus.kleuren[0].vid;
  const kap = { module: 'bootkap', vorm: 'bimini', doek: 'sunbrella_plus', kleur: sb, bevestiging: 'ring', verwerking: 'naaien',
    maten: { lengte: 200, breedte: 180 }, aantal: 1, opt: {}, extras: { raamfolie: { breedte: 60, hoogte: 40, aantal: 1 } } };
  const items = [kap, JSON.parse(JSON.stringify(kap))];
  const pk = P.bouwPakket({ items }, cat);
  const folie = pk.regels.find(r => r.key === 'raamfolie');
  assert.strictEqual(folie.qty, 1); // 2 × (66 × 46) past samen in 1 m op 137 cm
});

test('klittenband is zelfklevend', () => {
  const ZELF = ['260555711', '260556996', '260556506', '260557218'];
  for (const w of [25, 50]) {
    const it = raam(100, 100, { vorm: 'balkon', bevestiging: 'klit', opt: { klitBreedte: w } });
    const kl = P.regelsVoorItem(it, cat).regels.filter(r => /^klit_/.test(r.key));
    assert.strictEqual(kl.length, 2);
    kl.forEach(r => { assert.ok(ZELF.includes(r.vid), r.vid); assert.match(r.naam, /zelfklevend/); });
  }
});

test('Loxx-montagesleutel valt weg als gereedschap uit staat', () => {
  const sb = cat.doeken.sunbrella_plus.kleuren[0].vid;
  const it = g => ({ module: 'bootkap', vorm: 'bimini', doek: 'sunbrella_plus', kleur: sb, bevestiging: 'loxx', verwerking: 'naaien',
    maten: { lengte: 200, breedte: 180 }, aantal: 1, opt: {}, extras: {}, gereedschap: g });
  const keys = g => P.regelsVoorItem(it(g), cat).regels.map(r => r.key);
  assert.ok(keys(true).includes('loxx_sleutel'));
  assert.ok(!keys(false).includes('loxx_sleutel'));
});

test('bouwtekening: alle panelen, disclaimer en punten kloppen voor elke vorm', () => {
  const M = { lengte: 300, breedte: 220, hoogte: 110, diameter: 80, radius: 30, overhang: 20 };
  for (const [module, m] of Object.entries(P.MODULES)) for (const [vorm, v] of Object.entries(m.vormen)) for (const bev of v.bevestiging) {
    const d = cat.doeken[v.doeken[0]];
    const it = { module, vorm, doek: v.doeken[0], kleur: d.kleuren[0].vid, bevestiging: bev, verwerking: 'naaien', maten: M, aantal: 1, opt: {}, extras: {} };
    const b = P.berekenItem(it, cat);
    const html = BT.html(it, b);
    assert.ok(html.includes('niet aansprakelijk'), 'disclaimer ' + vorm);
    const lijst = BT.stukken(b);
    assert.strictEqual(lijst.length, b.model.panels.length);
    assert.strictEqual((html.match(/<figure>/g) || []).length, lijst.length, 'een tekening per stuk ' + vorm);
    const per = BT.bevestigingPerStuk(b, lijst);
    if (b.punten) {
      assert.strictEqual(b.puntenPlan.totaal * b.aantal, b.punten, `${vorm}/${bev}: plan = bestelling`);
      // elk stuk op de rand heeft punten, en elke zijde begint en eindigt in een hoek
      Object.values(per).forEach(p => assert.ok(p.n >= 2, `${vorm}/${bev}: punten op stuk`));
      b.puntenPlan.zijden.forEach(zz => {
        assert.strictEqual(zz.posities[0], 0);
        if (b.puntenPlan.type !== 'cirkel') assert.strictEqual(zz.posities[zz.posities.length - 1], Math.round(zz.lengte));
        assert.ok(zz.tussen <= b.afstand * 1.1 + 1e-9, `${vorm}/${bev}: vak ${zz.tussen} > ${b.afstand}`);
      });
    }
    assert.ok(BT.werkvolgorde(it, b).length >= 4);
  }
});

test('bouwtekening voor een enkel raam: punten rondom, geen naden', () => {
  const it = raam(157, 100, { afstandCm: 40 });
  const b = P.berekenItem(it, cat);
  const per = BT.bevestigingPerStuk(b, BT.stukken(b));
  assert.strictEqual(per[1].rondom, true);
  assert.strictEqual(per[1].n, 14);
  assert.ok(!BT.werkvolgorde(it, b).some(s => /naden/.test(s)));
});

test('bevestigers: hoeken eerst, gelijk verdeeld (raam van 57 cm)', () => {
  const b = P.berekenItem(raam(57, 100, { afstandCm: 40 }), cat);
  const [boven, zij] = b.puntenPlan.zijden;
  assert.deepStrictEqual(boven.posities, [0, 29, 57]);   // 2 vakken van 28,5 cm
  assert.deepStrictEqual(zij.posities, [0, 33, 67, 100]); // 3 vakken van 33,3 cm
  assert.strictEqual(b.punten, 10);                       // 2×2 + 2×3 vakken rondom
  const svg = BT.html(raam(57, 100, { afstandCm: 40 }), b);
  assert.strictEqual((svg.match(/<circle /g) || []).length, 10);
});

test('bevestigers: open rand van een buiskap deelt de hoekpunten', () => {
  const sb = cat.doeken.sunbrella_plus.kleuren[0].vid;
  const it = { module: 'bootkap', vorm: 'buiskap', doek: 'sunbrella_plus', kleur: sb, bevestiging: 'druk', verwerking: 'naaien',
    maten: { lengte: 300, breedte: 220, hoogte: 110 }, aantal: 1, afstandCm: 25, opt: {}, extras: {} };
  const b = P.berekenItem(it, cat);
  const v = b.puntenPlan.zijden.map(zz => zz.vakken);
  assert.strictEqual(b.punten, v.reduce((a, c) => a + c, 0) + 1);
});

test('geen los stansblok als er al een zeilringset (met gratis stansblok) in het pakket zit', () => {
  const sb = cat.doeken.sunbrella_plus.kleuren[0].vid;
  const kap = bev => ({ module: 'bootkap', vorm: 'bimini', doek: 'sunbrella_plus', kleur: sb, bevestiging: bev, verwerking: 'naaien',
    maten: { lengte: 200, breedte: 180 }, aantal: 1, opt: {}, extras: {}, gereedschap: true });
  const keys = (items, onderhoud) => P.bouwPakket({ items, onderhoud }, cat).regels.map(r => r.key);
  assert.ok(keys([kap('druk')]).includes('stansblok'));                    // alleen drukknopen: wel los stansblok
  assert.ok(!keys([kap('druk'), kap('ring')]).includes('stansblok'));      // met zeilringset: niet
  assert.ok(keys([kap('druk'), kap('ring')], [{ key: 'stansblok', qty: 1 }]).includes('stansblok')); // zelf extra gekozen: wel
});
