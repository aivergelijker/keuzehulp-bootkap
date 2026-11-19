const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');

test('snijplan: paneel past in rolbreedte -> één baan', () => {
  const r = C.snijplan([{ naam: 'Zeil', w: 200, h: 100 }], 152);
  // 210 x 110 -> 110 dwars past niet... 210>152, 110<=152 -> 110 dwars, 210 lang
  assert.strictEqual(r.stukken.length, 1);
  assert.strictEqual(r.lengteCm, 210 + C.R.snijMargeCm);
  assert.strictEqual(r.meters, 3);
});

test('snijplan: lange zijde dwars als die past (bespaart doek)', () => {
  const r = C.snijplan([{ naam: 'Zeil', w: 240, h: 100 }], 270);
  // 250 dwars, 110 lang
  assert.strictEqual(r.stukken[0].w, 250);
  assert.strictEqual(r.lengteCm, 110 + C.R.snijMargeCm);
  assert.strictEqual(r.meters, 2);
});

test('snijplan: paneel breder dan rol in beide richtingen wordt in banen gesplitst', () => {
  const r = C.snijplan([{ naam: 'Dekzeil', w: 600, h: 300 }], 152);
  // 610 x 310 op 152: 3 banen x 610 = 1830 of 5 banen x 310 = 1550 -> kies 5 x 310
  assert.strictEqual(r.stukken.length, 5);
  assert.ok(r.extraNaadCm > 0);
  assert.strictEqual(r.lengteCm, 5 * 310 + C.R.snijMargeCm);
  assert.strictEqual(r.meters, 16);
});

test('snijplan: nooit minder doek dan het oppervlak', () => {
  const rollen = [137, 150, 152, 153, 204, 250, 270, 300];
  for (const rol of rollen) {
    for (let w = 30; w <= 700; w += 37) {
      for (let h = 30; h <= 500; h += 41) {
        const panels = [{ naam: 'A', w, h }, { naam: 'B', w: h / 2, h: w / 3, qty: 2 }];
        const r = C.snijplan(panels, rol);
        const area = r.stukken.reduce((s, p) => s + p.w * p.h, 0);
        assert.ok(r.lengteCm * rol >= area - 1e-6, `rol ${rol} ${w}x${h}`);
        for (const s of r.stukken) assert.ok(s.w <= rol + 1e-9 && s.x + s.w <= rol + 1e-9, 'stuk past op rol');
        assert.strictEqual(r.meters, Math.ceil(r.lengteCm / 100 - 1e-9));
      }
    }
  }
});

test('snijplan: stukken overlappen elkaar niet', () => {
  const sets = [[C.MODELLEN.blok({ lengte: 200, breedte: 90, hoogte: 70 }).panels, 270], [C.MODELLEN.buiskap({ lengte: 250, breedte: 220, hoogte: 110, achterkant: true }).panels, 152],
    [C.MODELLEN.rond({ diameter: 60, hoogte: 90 }).panels, 204], [C.MODELLEN.blok({ lengte: 120, breedte: 60, hoogte: 40 }).panels.map(p => ({ ...p, qty: (p.qty || 1) * 4 })), 150]];
  for (const [panels, rol] of sets) {
  const r = C.snijplan(panels, rol);
  const s = r.stukken;
  for (const p of s) assert.ok(p.x + p.w <= rol + 1e-9 && p.y + p.h <= r.lengteCm + 1e-9, 'binnen de rol');
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    const a = s[i], b = s[j];
    const overlap = a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
    assert.ok(!overlap, `${a.naam} overlapt ${b.naam}`);
  }
  }
});

test('bevestigingspunten', () => {
  assert.strictEqual(C.puntenLangs(100, 25), 5);
  assert.strictEqual(C.puntenLangs(0, 25), 0);
  assert.strictEqual(C.puntenRondom(400, 50), 8);
  assert.strictEqual(C.puntenRondom(50, 50), 4);
});

test('modellen geven consistente randen en panelen', () => {
  const b = C.MODELLEN.buiskap({ lengte: 250, breedte: 220, hoogte: 120 });
  assert.strictEqual(b.panels.length, 3);
  assert.strictEqual(b.randCm, 2 * 250 + 220);
  const b2 = C.MODELLEN.buiskap({ lengte: 250, breedte: 220, hoogte: 120, achterkant: true });
  assert.strictEqual(b2.randCm, 2 * 250 + 2 * 220);
  const j = C.MODELLEN.jacuzzi({ lengte: 200, breedte: 200, radius: 0, hoogte: 20 });
  assert.strictEqual(Math.round(j.randCm), 800);
  const rnd = C.MODELLEN.rond({ diameter: 60, hoogte: 80 });
  assert.ok(Math.abs(rnd.randCm - Math.PI * 60) < 1e-9);
});

test('invoer wordt begrensd (geen NaN, geen negatief)', () => {
  const p = C.MODELLEN.plat({ lengte: 'abc', breedte: -5 });
  assert.ok(p.panels[0].w >= 30 && p.panels[0].h >= 30);
  assert.strictEqual(C.num('12,5', 0), 12.5);
});
