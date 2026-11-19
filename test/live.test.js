const test = require('node:test');
const assert = require('node:assert');
const LIVE = require('../src/live.js').EsailsLive;
const cat = require('../src/catalog.js');

function mockFetch(routes) {
  global.fetch = async (url) => {
    const r = routes[url.split('?')[0]];
    if (r === 'netwerk') throw new Error('offline');
    if (typeof r === 'number') return { ok: false, status: r, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => r };
  };
}

test('404 -> product niet leverbaar, geen fallbackprijs', async () => {
  LIVE._reset();
  mockFetch({ '/weg.html': 404 });
  await LIVE.verrijk([{ vid: '111', url: 'weg.html' }]);
  assert.strictEqual(LIVE.info('111').status.code, 'uitverkocht');
  assert.strictEqual(LIVE.info('111').prijs, null);
});

test('variant ontbreekt in product-JSON -> niet leverbaar; bestaande variant krijgt live prijs', async () => {
  LIVE._reset();
  mockFetch({ '/p.html': { product: { vid: 1, variants: { '222': { title: 'x', price: { price_incl: 9.5 }, stock: { available: true, on_stock: true, level: 3 } } } } } });
  await LIVE.verrijk([{ vid: '222', url: 'p.html' }, { vid: '333', url: 'p.html' }]);
  assert.strictEqual(LIVE.info('222').prijs, 9.5);
  assert.strictEqual(LIVE.info('222').status.code, 'voorraad');
  assert.strictEqual(LIVE.info('333').status.code, 'uitverkocht');
});

test('netwerkfout -> geen oordeel (catalogusprijs blijft gelden)', async () => {
  LIVE._reset();
  mockFetch({ '/x.html': 'netwerk', '/y.html': 500 });
  await LIVE.verrijk([{ vid: '444', url: 'x.html' }, { vid: '555', url: 'y.html' }]);
  assert.strictEqual(LIVE.info('444'), null);
  assert.strictEqual(LIVE.info('555'), null);
});

test('op bestelling vs voorraad', async () => {
  LIVE._reset();
  mockFetch({ '/b.html': { product: { vid: 666, price: { price_incl: 1 }, stock: { available: true, on_stock: false, delivery: { title: 'Bel' } } } } });
  await LIVE.verrijk([{ vid: '666', url: 'b.html' }]);
  assert.strictEqual(LIVE.info('666').status.code, 'bestelling');
});

test('stalen zijn per kleur gekoppeld, uniek en goedkoop', () => {
  for (const key of ['sunbrella_plus', 'sauleda_seastar']) {
    const k = cat.doeken[key].kleuren.filter(x => x.staal);
    assert.ok(k.length > 0, key + ' heeft stalen');
    const vids = k.map(x => x.staal.vid);
    assert.strictEqual(new Set(vids).size, vids.length, 'elk staal maar aan één kleur');
    k.forEach(x => { assert.ok(x.staal.prijs < 5); assert.ok(/sample/i.test(x.staal.url)); });
  }
});
