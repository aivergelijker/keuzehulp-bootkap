/* =====================================================================
   eSails Keuzehulp — LIVE (prijzen, voorraad, winkelwagen, tracking)
   Draait alleen in de browser, op esails.nl (same-origin).
   ===================================================================== */
(function (root) {
  'use strict';

  var CACHE_KEY = 'eskh_live_v1';
  var TTL = 10 * 60 * 1000; // 10 minuten
  var mem = {};
  try {
    var raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) { var o = JSON.parse(raw); if (o && o.t > Date.now() - TTL) mem = o.d || {}; }
  } catch (e) { /* geen storage: prima */ }
  function persist() { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: mem })); } catch (e) { } }

  /* Status van een variant uit Lightspeed product-JSON */
  function statusVan(stock) {
    if (!stock) return { code: 'onbekend' };
    var levertijd = stock.delivery && stock.delivery.title || '';
    if (stock.on_stock) return { code: 'voorraad', level: stock.level, levertijd: levertijd };
    if (stock.available) return { code: 'bestelling', levertijd: levertijd };
    return { code: 'uitverkocht', levertijd: levertijd };
  }

  function parseProduct(json) {
    var p = json && json.product;
    if (!p) return null;
    var out = {};
    if (p.variants && typeof p.variants === 'object') {
      Object.keys(p.variants).forEach(function (k) {
        var v = p.variants[k];
        out[String(k)] = { prijs: v.price && v.price.price_incl, status: statusVan(v.stock), titel: v.title };
      });
    }
    if (p.vid && !out[String(p.vid)]) {
      out[String(p.vid)] = { prijs: p.price && p.price.price_incl, status: statusVan(p.stock), titel: p.variant };
    }
    return out;
  }

  var inflight = {};
  function haalProduct(url) {
    if (inflight[url]) return inflight[url];
    var base = '/' + String(url).replace(/^\/+/, '');
    inflight[url] = fetch(base + (base.indexOf('?') < 0 ? '?' : '&') + 'format=json', { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var vs = parseProduct(j) || {};
        Object.keys(vs).forEach(function (vid) { mem[vid] = vs[vid]; });
        persist();
        return vs;
      })
      .catch(function () { return {}; })
      .then(function (v) { delete inflight[url]; return v; });
    return inflight[url];
  }

  /* Haal live info op voor een lijst {vid,url}. Max 3 tegelijk. */
  function verrijk(items) {
    var todo = [], seen = {};
    items.forEach(function (it) {
      if (!it || !it.url || mem[it.vid] || seen[it.url]) return;
      seen[it.url] = 1; todo.push(it.url);
    });
    var i = 0;
    function worker() {
      if (i >= todo.length) return Promise.resolve();
      var u = todo[i++];
      return haalProduct(u).then(worker);
    }
    return Promise.all([worker(), worker(), worker()]).then(function () { return mem; });
  }

  function info(vid) { return mem[String(vid)] || null; }

  /* ---------------- winkelwagen ---------------- */
  function voegToe(vid, qty) {
    var body = 'quantity=' + encodeURIComponent(qty);
    return fetch('/cart/add/' + encodeURIComponent(vid) + '/?quantity=' + encodeURIComponent(qty), {
      method: 'POST', credentials: 'same-origin', redirect: 'follow',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return true; });
  }

  /* Zoek in willekeurige cart-JSON naar {variant-id: aantal}. Lightspeed-
     thema's verschillen; we zoeken defensief naar objecten met een vid/id +
     quantity. Geeft null als de structuur niet herkend wordt. */
  function leesCart() {
    return fetch('/cart/?format=json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        var found = {}, any = false;
        (function walk(o, depth) {
          if (!o || typeof o !== 'object' || depth > 6) return;
          var vid = o.vid || o.variant_id || (o.variant && o.variant.id);
          var q = o.quantity != null ? o.quantity : o.qty;
          if (vid && q != null && !isNaN(q)) { found[String(vid)] = (found[String(vid)] || 0) + Number(q); any = true; }
          Object.keys(o).forEach(function (k) { walk(o[k], depth + 1); });
        })(j, 0);
        return any ? found : null;
      })
      .catch(function () { return null; });
  }

  /* Voegt regels één voor één toe (sequentieel, met retry) en controleert daarna. */
  function zetInWinkelwagen(regels, onProgress) {
    var res = { ok: [], fout: [], geverifieerd: false };
    var voor = null;
    return leesCart().then(function (c) { voor = c; }).then(function () {
      var i = 0;
      function volgende() {
        if (i >= regels.length) return Promise.resolve();
        var r = regels[i++];
        if (onProgress) onProgress(i, regels.length, r);
        return voegToe(r.vid, r.qty)
          .catch(function () { return new Promise(function (ok) { setTimeout(ok, 800); }).then(function () { return voegToe(r.vid, r.qty); }); })
          .then(function () { res.ok.push(r); }, function () { res.fout.push(r); })
          .then(volgende);
      }
      return volgende();
    }).then(function () {
      return leesCart();
    }).then(function (na) {
      if (na) {
        res.geverifieerd = true;
        res.ok = res.ok.filter(function (r) {
          var verschil = (na[r.vid] || 0) - ((voor && voor[r.vid]) || 0);
          if (verschil >= r.qty) return true;
          res.fout.push(r); return false;
        });
      }
      return res;
    });
  }

  /* ---------------- tracking (GTM dataLayer, GA4-formaat) ---------------- */
  function track(event, data) {
    try {
      root.dataLayer = root.dataLayer || [];
      var payload = { event: event };
      if (data && data.ecommerce) root.dataLayer.push({ ecommerce: null });
      for (var k in data) payload[k] = data[k];
      root.dataLayer.push(payload);
    } catch (e) { }
  }
  function ga4Items(regels) {
    return regels.map(function (r) {
      var l = info(r.vid);
      return { item_id: String(r.vid), item_name: r.naam, price: Math.round(((l && l.prijs != null) ? l.prijs : r.prijs) * 100) / 100, quantity: r.qty, item_category: r.groep || '' };
    });
  }

  root.EsailsLive = { verrijk: verrijk, info: info, zetInWinkelwagen: zetInWinkelwagen, track: track, ga4Items: ga4Items, _parseProduct: parseProduct };
})(typeof window !== 'undefined' ? window : this);
