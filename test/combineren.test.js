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

test('Loxx-montagesleutel komt bij elke Loxx-bestelling, ook zonder gereedschap', () => {
  const sb = cat.doeken.sunbrella_plus.kleuren[0].vid;
  const it = g => ({ module: 'bootkap', vorm: 'bimini', doek: 'sunbrella_plus', kleur: sb, bevestiging: 'loxx', verwerking: 'naaien',
    maten: { lengte: 200, breedte: 180 }, aantal: 1, opt: {}, extras: {}, gereedschap: g });
  const keys = g => P.regelsVoorItem(it(g), cat).regels.map(r => r.key);
  assert.ok(keys(true).includes('loxx_sleutel'));
  assert.ok(keys(false).includes('loxx_sleutel'));
  assert.ok(!keys(false).includes('loxx_holpijp'));
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

test('balkon 290 × 100 cm: 3 m doek (100 cm hoogte past dwars op de rol, geen dubbele marge)', () => {
  for (const doek of ['mehler_gaas', 'ferrari_362']) {
    const it = raam(290, 100, { vorm: 'balkon', bevestiging: 'balkon', doek, kleur: cat.doeken[doek].kleuren[0].vid });
    const b = P.berekenItem(it, cat);
    assert.strictEqual(b.plan.lengteCm, 300, doek); // 290 + 2 × 5 cm zoom
    assert.strictEqual(b.plan.meters, 3, doek);
  }
});

test('tunnelzoom alleen aan de onderrand van een hoes, niet op de bovenkant', () => {
  const k = cat.doeken.ferrari_705.kleuren[0].vid;
  const it = { module: 'afdekzeil', vorm: 'blok', doek: 'ferrari_705', kleur: k, bevestiging: 'tunnel', verwerking: 'lijmen',
    maten: { lengte: 200, breedte: 90, hoogte: 75 }, aantal: 1, opt: {}, extras: {} };
  const b = P.berekenItem(it, cat);
  const st = BT.stukken(b);
  const boven = st.find(s => s.naam === 'Bovenkant'), zij = st.find(s => s.naam === 'Zijkant lang');
  assert.deepStrictEqual([boven.snijW, boven.snijH], [210, 100]);  // alleen 5 cm zoom
  assert.deepStrictEqual([zij.snijW, zij.snijH], [210, 93]);       // 75 + 2 × 5 + 8 cm tunnel
});

test('meterwaar wordt eerst over items opgeteld en dan afgerond (klittenband)', () => {
  // 3 balkons van 100 × 55 cm: rand 3,1 m per stuk -> samen 9,3 m -> 10 m (niet 3 × 4 = 12 m)
  const items = [1, 2, 3].map(() => raam(100, 55, { vorm: 'balkon', bevestiging: 'klit', opt: { klitBreedte: 25 } }));
  const pk = P.bouwPakket({ items }, cat);
  const haak = pk.regels.find(r => r.key === 'klit_haak');
  assert.strictEqual(haak.qty, 10);
  const los = P.regelsVoorItem(items[0], cat).regels.find(r => r.key === 'klit_haak');
  assert.strictEqual(los.qty, 4); // één item alleen: 3,1 m -> 4 m
});

test('dekzeil: bovenblad + vier rokstroken, bevestigers in de onderrand van de rok', () => {
  const k = cat.doeken.ferrari_705.kleuren[0].vid;
  const it = { module: 'bootkap', vorm: 'dekzeil', doek: 'ferrari_705', kleur: k, bevestiging: 'ring', verwerking: 'naaien',
    maten: { lengte: 700, breedte: 260, hoogte: 30 }, aantal: 1, opt: {}, extras: {} };
  const b = P.berekenItem(it, cat);
  assert.deepStrictEqual(b.model.panels.map(p => [p.naam, p.w, p.h, p.qty || 1]),
    [['Bovenblad', 700, 260, 1], ['Rok lang', 700, 30, 2], ['Rok kort', 260, 30, 2]]);
  assert.strictEqual(b.randCm, 2 * (700 + 260));            // onderrand van de rok
  assert.strictEqual(b.model.naadCm, 2 * (700 + 260) + 4 * 30); // rok aan bovenblad + 4 hoeknaden
  const per = BT.bevestigingPerStuk(b, BT.stukken(b));
  assert.ok(!per[1], 'geen bevestigers op het bovenblad');
  assert.ok(per[2].n >= 2 && per[3].n >= 2);
  assert.ok(BT.werkvolgorde(it, b).some(s => /rokstroken in de hoeken/.test(s)));
  // tunnel: alleen de rok krijgt de tunnel, niet het bovenblad
  const t = BT.stukken(P.berekenItem(Object.assign({}, it, { bevestiging: 'tunnel' }), cat));
  assert.strictEqual(t[0].snijH, 270);
  assert.strictEqual(t[1].snijH, 30 + 10 + 8);
});

test('zonwering: 5 cm zoom, gestikt met garen, nooit gelijmd', () => {
  const it = raam(120, 90, { verwerking: 'naaien', garen: 'wit' });
  const b = P.berekenItem(it, cat);
  assert.strictEqual(b.zoom, 5);
  const st = BT.stukken(b)[0];
  assert.deepStrictEqual([st.snijW, st.snijH], [130, 100]);
  const regels = P.regelsVoorItem(it, cat).regels;
  assert.ok(regels.some(r => r.key === 'garen'), 'garen in het pakket');
  const stappen = BT.werkvolgorde(it, b).join(' ');
  assert.match(stappen, /zoom van 5 cm om en stik hem vast/);
  assert.match(stappen, /Niet lijmen/);
  assert.match(BT.html(it, b), /stroke="#2563eb"/); // stiklijn in de tekening
  // gaasdoek heeft een bijpassend garen
  ['mehler_gaas', 'ferrari_362'].forEach(k => cat.doeken[k].kleuren.forEach(x => assert.ok(cat.garen[x.garen], k + ' ' + x.naam)));
});

test('dekzeil 700 × 260, rok 30: lange rokstroken uit delen scheelt doek (11 m i.p.v. 15 m)', () => {
  const k = cat.doeken.ferrari_705.kleuren[0].vid;
  const it = { module: 'bootkap', vorm: 'dekzeil', doek: 'ferrari_705', kleur: k, bevestiging: 'ring', verwerking: 'naaien',
    maten: { lengte: 700, breedte: 260, hoogte: 30 }, aantal: 1, opt: {}, extras: {} };
  const b = P.berekenItem(it, cat);
  assert.strictEqual(b.plan.meters, 11);
  const rok = BT.stukken(b).find(s => s.naam === 'Rok lang');
  assert.strictEqual(rok.delen, 3);
  assert.strictEqual(rok.qty, 2);
  assert.ok(rok.snijW <= cat.doeken.ferrari_705.rolCm);
  assert.ok(b.naadCm > b.model.naadCm, 'deelnaden tellen mee');
  assert.match(BT.html(it, b), /deelnaden op 233 · 467 cm/);
  assert.ok(BT.werkvolgorde(it, b).some(s => /delen van de lange rokstroken/.test(s)));
});

test('zonwering uit een ouder bewaard pakket (verwerking "geen") krijgt toch garen', () => {
  const regels = P.regelsVoorItem(raam(120, 90, { verwerking: 'geen', garen: null }), cat).regels;
  assert.ok(regels.some(r => r.key === 'garen'));
});

test('buiskap: dak breder dan de rol wordt in gelijke banen gesplitst, naad in de tekening', () => {
  const sb = cat.doeken.sunbrella_plus.kleuren[0].vid;
  const it = { module: 'bootkap', vorm: 'buiskap', doek: 'sunbrella_plus', kleur: sb, bevestiging: 'druk', verwerking: 'naaien', garen: 'zwart',
    maten: { lengte: 250, breedte: 220, hoogte: 110 }, aantal: 1, afstandCm: 25, opt: {}, extras: {} };
  const b = P.berekenItem(it, cat);
  const banen = b.plan.stukken.filter(s => s.baan);
  assert.strictEqual(banen.length, 2);
  assert.ok(Math.abs(banen[0].w - banen[1].w) < 1e-6, 'gelijke banen');
  assert.ok(banen.every(s => s.h === 285), 'banen in de lengte van het dak (275 + zoom)');
  assert.strictEqual(b.plan.meters, 14);
  const dak = BT.stukken(b).find(s => s.naam === 'Dak');
  assert.strictEqual(dak.banen.n, 2);
  assert.match(BT.html(it, b), /2 banen van 117 cm breed/);
});

test('buiskap: schuine voorkant (optioneel) en uitleg welving in de stukkenlijst', () => {
  const sb = cat.doeken.sunbrella_plus.kleuren[0].vid;
  const kap = maten => ({ module: 'bootkap', vorm: 'buiskap', doek: 'sunbrella_plus', kleur: sb, bevestiging: 'druk', verwerking: 'naaien', garen: 'zwart',
    maten, aantal: 1, afstandCm: 25, opt: {}, extras: {} });
  const recht = P.berekenItem(kap({ lengte: 250, breedte: 220, hoogte: 110 }), cat);
  const schuin = P.berekenItem(kap({ lengte: 250, breedte: 220, hoogte: 110, voorkantSchuin: true, voorkantLengte: 140 }), cat);
  const vk = b => b.model.panels.find(p => p.naam === 'Voorkant');
  assert.strictEqual(vk(recht).h, 110);
  assert.strictEqual(vk(schuin).h, 140);
  // korter dan de hoogte kan niet: dan blijft het de hoogte
  assert.strictEqual(vk(P.berekenItem(kap({ lengte: 250, breedte: 220, hoogte: 110, voorkantSchuin: true, voorkantLengte: 80 }), cat)).h, 110);
  // uit = rechte voorkant, ook als er nog een lengte bewaard staat
  assert.strictEqual(vk(P.berekenItem(kap({ lengte: 250, breedte: 220, hoogte: 110, voorkantSchuin: false, voorkantLengte: 140 }), cat)).h, 110);
  const html = BT.html(kap({ lengte: 250, breedte: 220, hoogte: 110 }), recht);
  assert.match(html, /10% extra lengte voor de welving van het dak/);
});

test('zonwering: "Geen garen nodig" wordt gerespecteerd', () => {
  const regels = P.regelsVoorItem(raam(120, 90, { verwerking: 'naaien', garen: null }), cat).regels;
  assert.ok(!regels.some(r => r.key === 'garen'));
});

test('balkonscherm: oogjes met elastisch koord of tie-wraps, geen klittenband', () => {
  assert.deepStrictEqual(P.MODULES.zonwering.vormen.balkon.bevestiging, ['balkon']);
  const it = o => raam(290, 100, { vorm: 'balkon', bevestiging: 'balkon', afstandCm: 50, opt: o });
  const koord = P.regelsVoorItem(it({}), cat).regels.map(r => r.key);
  assert.ok(koord.includes('ring') && koord.includes('koord') && koord.includes('koordklem'));
  assert.ok(!koord.includes('aanslag') && !koord.includes('tiewrap'));
  const tw = P.regelsVoorItem(it({ balkonVast: 'tiewrap' }), cat).regels;
  const n = tw.find(r => r.key === 'ring').qty;
  assert.strictEqual(tw.find(r => r.key === 'tiewrap').qty, Math.ceil(n / 10));
  assert.ok(!tw.some(r => r.key === 'koord'));
  const b = P.berekenItem(it({ balkonVast: 'tiewrap' }), cat);
  assert.ok(BT.werkvolgorde(it({ balkonVast: 'tiewrap' }), b).some(s => /tie-wrap per oogje/.test(s)));
});

test('Loxx-gereedschap: holpijp rond 9 mm (brede greep) + stansblok', () => {
  const sb = cat.doeken.sunbrella_plus.kleuren[0].vid;
  const it = { module: 'bootkap', vorm: 'bimini', doek: 'sunbrella_plus', kleur: sb, bevestiging: 'loxx', verwerking: 'naaien',
    maten: { lengte: 200, breedte: 180 }, aantal: 1, opt: {}, extras: {}, gereedschap: true };
  const regels = P.regelsVoorItem(it, cat).regels;
  assert.strictEqual(regels.find(r => r.key === 'loxx_holpijp').vid, '313343441');
  assert.ok(regels.some(r => r.key === 'stansblok'));
});

test('banen altijd in de lengte: dekzeil 8 × 3 m op rol 250 = 2 banen van 8,1 m', () => {
  const k = cat.doeken.mehler_8205.kleuren[0].vid;
  const it = { module: 'bootkap', vorm: 'dekzeil', doek: 'mehler_8205', kleur: k, bevestiging: 'ring', verwerking: 'naaien',
    maten: { lengte: 800, breedte: 300, hoogte: 30 }, aantal: 1, opt: {}, extras: {} };
  const banen = P.berekenItem(it, cat).plan.stukken.filter(s => s.baan);
  assert.strictEqual(banen.length, 2);
  assert.ok(banen.every(s => s.h === 810));
});

test('mallendoek: mal van alle stukken op 300 cm, zonder marge', () => {
  const k = cat.doeken.ferrari_705.kleuren[0].vid;
  const dz = maten => ({ module: 'bootkap', vorm: 'dekzeil', doek: 'ferrari_705', kleur: k, bevestiging: 'ring', verwerking: 'naaien',
    maten, aantal: 1, opt: {}, extras: { mallendoek: true } });
  const mal = it => P.regelsVoorItem(it, cat).regels.find(r => r.key === 'mallendoek');
  // boot van 3 m breed: het bovenblad past in één lengte van 8 m; de rokstroken komen erbij
  const m = mal(dz({ lengte: 800, breedte: 300, hoogte: 30 }));
  assert.ok(m.qty >= 8 && m.qty <= 16, 'mal ' + m.qty);
  assert.match(m.notitie, /alle stukken/);
  // twee items delen één malplan
  const pk = P.bouwPakket({ items: [dz({ lengte: 300, breedte: 120, hoogte: 20 }), dz({ lengte: 300, breedte: 120, hoogte: 20 })] }, cat);
  const los = mal(dz({ lengte: 300, breedte: 120, hoogte: 20 })).qty;
  assert.ok(pk.regels.find(r => r.key === 'mallendoek').qty <= 2 * los);
  assert.ok(pk.snijplannen.some(g => g.soort === 'mallendoek'));
});

test('snijplannen: geen overlap, binnen de rol, banen in de lengte (raster van maten)', () => {
  const M = [[150, 150, 70], [250, 220, 110], [400, 300, 150], [800, 300, 30], [1200, 400, 50], [2000, 800, 100]];
  for (const [mod, m] of Object.entries(P.MODULES)) for (const [vorm, v] of Object.entries(m.vormen)) for (const doek of v.doeken) for (const [l, b, h] of M) {
    const d = cat.doeken[doek];
    const it = { module: mod, vorm, doek, kleur: d.kleuren[0].vid, bevestiging: v.bevestiging[0], verwerking: 'naaien',
      maten: { lengte: l, breedte: b, hoogte: h, diameter: Math.min(l, 400), overhang: 20, radius: 30 }, aantal: 1, opt: {}, extras: {} };
    const plan = P.berekenItem(it, cat).plan, st = plan.stukken, lbl = `${vorm}/${doek} ${l}x${b}x${h}`;
    st.forEach((a, i) => {
      assert.ok(a.x >= -1e-6 && a.x + a.w <= plan.rolCm + 1e-6, lbl + ' binnen de rol');
      if (a.baan) assert.ok(a.h >= a.w - 1e-6, lbl + ' baan in de lengte');
      for (let j = i + 1; j < st.length; j++) { const c = st[j];
        assert.ok(!(a.x < c.x + c.w - 1e-6 && c.x < a.x + a.w - 1e-6 && a.y < c.y + c.h - 1e-6 && c.y < a.y + a.h - 1e-6), lbl + ' overlap'); }
    });
    assert.strictEqual(plan.meters, Math.ceil(plan.lengteCm / 100 - 1e-9), lbl + ' meters');
  }
});
