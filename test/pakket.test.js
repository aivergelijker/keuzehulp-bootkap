const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const P = require('../src/pakket.js');
const cat = require('../src/catalog.js');

function alleVids() {
  const s = new Set();
  Object.values(cat.p).forEach(p => s.add(String(p.vid)));
  Object.values(cat.garen).forEach(p => s.add(String(p.vid)));
  Object.values(cat.doeken).forEach(d => d.kleuren.forEach(k => s.add(String(k.vid))));
  Object.values(cat.ritsen).forEach(r => Object.values(r).forEach(x => s.add(String(x.vid))));
  return s;
}
const VIDS = alleVids();

const OPTIES = {
  loxx: [{ loxxKop: 'rvs', loxxBasis: 'zelftapper' }, { loxxKop: 'kv', loxxBasis: 'zelftapper' }, { loxxKop: 'zwart', loxxBasis: 'bout' }, { loxxKop: 'chroom', loxxBasis: 'doekdeel' }],
  druk: ['ykk', 'dot', 'fasnap', 'prym'].map(m => ({ drukMerk: m })).concat(['bout', 'popnagel', 'raamclip', 'parker'].map(c => ({ drukMerk: 'dot', drukC: c }))),
  draai: [{ draaiMerk: 'prym' }, { draaiMerk: 'mh' }],
  ring: [10, 12, 16].flatMap(din => ['rvs', 'messing'].flatMap(mat => ['koordhaak', 'musketon', 'rondknop', 'noorse_knop', 'geen'].map(a => ({ ringDin: din, ringMat: mat, aanslag: a, koordDikte: 8, koordKleur: 'wit' })))),
  tunnel: [{ koordDikte: 6, koordKleur: 'zwart' }, { koordDikte: 8, koordKleur: 'wit' }],
  klit: [{ klitBreedte: 25 }, { klitBreedte: 50 }],
  zuignap: [{}],
  balkon: [{}]
};
const MATEN = { lengte: 300, breedte: 220, hoogte: 110, diameter: 80, radius: 30, overhang: 20 };

function* alleItems() {
  for (const [module, m] of Object.entries(P.MODULES)) {
    for (const [vorm, v] of Object.entries(m.vormen)) {
      for (const doek of v.doeken) {
        const d = cat.doeken[doek];
        assert.ok(d, `doek ${doek} bestaat`);
        assert.ok(d.kleuren.length > 0, `doek ${doek} heeft kleuren`);
        const kleur = d.kleuren[0];
        for (const bev of v.bevestiging) {
          for (const opt of OPTIES[bev]) {
            for (const verwerking of (d.soort === 'pvc' ? ['lijmen', 'naaien'] : ['naaien'])) {
              yield { module, vorm, doek, kleur: kleur.vid, bevestiging: bev, opt, verwerking, garen: kleur.garen || null,
                      maten: MATEN, aantal: 1, gereedschap: true };
            }
          }
        }
      }
    }
  }
}

test('elke combinatie levert geldige, gekoppelde regels op', () => {
  let n = 0;
  for (const item of alleItems()) {
    n++;
    const { regels } = P.regelsVoorItem(item, cat);
    const label = JSON.stringify([item.module, item.vorm, item.doek, item.bevestiging, item.opt, item.verwerking]);
    assert.ok(regels.length >= 2, 'minstens doek + bevestiging ' + label);
    const doek = regels.find(r => r.groep === 'doek');
    assert.ok(doek && doek.qty >= 1, 'doekregel ' + label);
    assert.ok(regels.some(r => r.groep === 'bevestiging'), 'bevestigingsregel ' + label);
    for (const r of regels) {
      assert.ok(VIDS.has(r.vid), `vid ${r.vid} (${r.naam}) staat in catalogus ${label}`);
      assert.ok(Number.isInteger(r.qty) && r.qty > 0, `heel aantal > 0 voor ${r.naam} ${label}`);
      assert.ok(typeof r.prijs === 'number' && r.prijs > 0, `prijs voor ${r.naam}`);
      assert.ok(r.url && /\.html$/.test(r.url), `url voor ${r.naam}`);
    }
    if (item.verwerking === 'lijmen') assert.ok(regels.some(r => r.key === 'lijm'), 'lijm bij lijmen ' + label);
    if (item.verwerking === 'naaien' && item.garen) assert.ok(regels.some(r => r.key === 'garen'), 'garen bij naaien ' + label);
  }
  assert.ok(n > 200, 'genoeg combinaties getest: ' + n);
});

test('bevestigingsonderdelen hebben gelijke aantallen per punt', () => {
  const base = { module: 'bootkap', vorm: 'buiskap', doek: 'sunbrella_plus', kleur: cat.doeken.sunbrella_plus.kleuren[0].vid, maten: MATEN, verwerking: 'naaien' };
  const druk = P.regelsVoorItem({ ...base, bevestiging: 'druk', opt: { drukMerk: 'dot' } }, cat).regels;
  const a = druk.find(r => r.key === 'druk_a').qty;
  assert.strictEqual(druk.find(r => r.key === 'druk_b').qty, a);
  assert.strictEqual(druk.find(r => r.key === 'druk_c').qty, a);
  // buiskap 300 x 220, max. 25 cm (+10% speling): hoeken vast, zijkant 300 -> 11 vakken, voorkant 220 -> 8 vakken,
  // open rand: 11 + 8 + 11 + 1 = 31 punten -> DOT per 10: 40
  assert.strictEqual(a, 40);
  const ykk = P.regelsVoorItem({ ...base, bevestiging: 'druk', opt: { drukMerk: 'ykk' } }, cat).regels;
  assert.strictEqual(ykk.find(r => r.key === 'druk_a').qty, 31, 'YKK niet afgerond');
  for (const c of ['bout', 'popnagel', 'raamclip', 'parker']) {
    const r = P.regelsVoorItem({ ...base, bevestiging: 'druk', opt: { drukMerk: 'dot', drukC: c } }, cat).regels;
    r.filter(x => /^druk_[abc]$/.test(x.key)).forEach(x => assert.strictEqual(x.qty % 10, 0, 'DOT ' + x.naam + ' per 10'));
  }
  const draai = P.regelsVoorItem({ ...base, bevestiging: 'draai', opt: { draaiMerk: 'mh' } }, cat).regels;
  assert.strictEqual(draai.find(r => r.key === 'draai').qty, draai.find(r => r.key === 'draai_kous').qty);
  assert.match(draai.find(r => r.key === 'draai_kous').naam, /17 × 11/, 'MH draaier krijgt MH kous 17x11');
  const loxx = P.regelsVoorItem({ ...base, bevestiging: 'loxx', opt: { loxxBasis: 'bout' } }, cat).regels;
  assert.strictEqual(loxx.find(r => r.key === 'loxx_moer').qty, loxx.find(r => r.key === 'loxx_kop').qty, 'moer per bout');
});

test('gereedschap en perOrder-producten maar één keer in het pakket', () => {
  const kleur = cat.doeken.mehler_gaas.kleuren[0].vid;
  const raam = { module: 'zonwering', vorm: 'raam', doek: 'mehler_gaas', kleur, bevestiging: 'zuignap', maten: { breedte: 120, hoogte: 100 }, gereedschap: true };
  const pk = P.bouwPakket({ items: [raam, raam, { ...raam, aantal: 3 }] }, cat);
  const set = pk.regels.find(r => r.key === 'ring_set');
  assert.strictEqual(set.qty, 1, 'één montageset voor alle ramen');
  const zuig = pk.regels.find(r => r.key === 'zuignap');
  // per raam 120x100 om de 50 cm: (3+2)*2 = 10; totaal 5 ramen = 50
  assert.strictEqual(zuig.qty, 50);
  assert.strictEqual(pk.regels.find(r => r.key === 'ring').qty, 50, 'zeilring per zuignap');
});

test('zonder gereedschap geen gereedschapsregels', () => {
  for (const item of alleItems()) {
    const { regels } = P.regelsVoorItem({ ...item, gereedschap: false }, cat);
    assert.ok(!regels.some(r => r.groep === 'gereedschap'), 'geen gereedschap ' + item.bevestiging);
  }
});

test('mallendoek: altijd per meter, ook bij grote oppervlakken', () => {
  const base = { module: 'bootkap', vorm: 'dekzeil', doek: 'ferrari_705', kleur: cat.doeken.ferrari_705.kleuren[0].vid, bevestiging: 'ring', verwerking: 'naaien' };
  const klein = P.regelsVoorItem({ ...base, maten: { lengte: 300, breedte: 200 }, extras: { mallendoek: true } }, cat).regels.find(r => r.key === 'mallendoek');
  assert.strictEqual(klein.unit, 'm');
  assert.strictEqual(klein.vid, String(cat.p.mallendoek.vid));
  const groot = P.regelsVoorItem({ ...base, maten: { lengte: 1200, breedte: 500, hoogte: 50 }, extras: { mallendoek: true } }, cat).regels.find(r => r.key === 'mallendoek');
  assert.strictEqual(groot.vid, String(cat.p.mallendoek.vid));
  assert.strictEqual(groot.unit, 'm');
  assert.ok(groot.qty > 31, 'grote mal: veel meters, geen rol');
  assert.ok(!Object.keys(cat.p).some(k => /mallendoek_rol/.test(k)), 'rol niet in catalogus');
});

test('raamfolie, ritsen en trekbandjes', () => {
  const base = { module: 'bootkap', vorm: 'buiskap', doek: 'sunbrella_plus', kleur: cat.doeken.sunbrella_plus.kleuren[0].vid, bevestiging: 'loxx', maten: MATEN, verwerking: 'naaien' };
  const lengte = Object.keys(cat.ritsen.spiraal)[2];
  const r = P.regelsVoorItem({ ...base, extras: {
    raamfolie: { breedte: 180, hoogte: 50, aantal: 2, tape: '9' },
    ritsen: [{ type: 'spiraal', lengte, aantal: 2 }],
    trekband: { sets: 4, beugel: 'rvs' } } }, cat).regels;
  const folie = r.find(x => x.key === 'raamfolie');
  // 2 ramen 186 x 56 op 137 breed: 56 dwars (2 naast elkaar = 112 <= 137) -> 186 + 10 marge = 196 cm -> 2 m
  assert.strictEqual(folie.qty, 2);
  assert.ok(r.find(x => x.key === 'tape'));
  assert.strictEqual(r.find(x => x.key.startsWith('rits_')).qty, 2);
  assert.strictEqual(r.find(x => x.key === 'band').qty, 4);
  assert.strictEqual(r.find(x => x.key === 'beugel').qty, 4);
});

test('doekmeters schalen met aantal en zijn altijd hele meters', () => {
  const base = { module: 'afdekzeil', vorm: 'blok', doek: 'ferrari_705', kleur: cat.doeken.ferrari_705.kleuren[0].vid, bevestiging: 'tunnel', verwerking: 'lijmen', maten: { lengte: 200, breedte: 90, hoogte: 70 } };
  const een = P.regelsVoorItem(base, cat).regels.find(r => r.groep === 'doek').qty;
  const drie = P.regelsVoorItem({ ...base, aantal: 3 }, cat).regels.find(r => r.groep === 'doek').qty;
  assert.ok(drie >= een && drie <= een * 3 + 1);
  assert.ok(Number.isInteger(een) && Number.isInteger(drie));
});

test('totaal = som van regels, live prijzen overschrijven fallback', () => {
  const item = [...alleItems()][0];
  const pk = P.bouwPakket({ items: [item] }, cat);
  const som = pk.regels.reduce((s, r) => s + r.prijs * r.qty, 0);
  assert.ok(Math.abs(pk.totaal - som) < 1e-9);
  const live = {}; pk.regels.forEach(r => { live[r.vid] = { prijs: 1 }; });
  assert.strictEqual(P.totaal(pk.regels, live), pk.regels.reduce((s, r) => s + r.qty, 0));
});
