/* =====================================================================
   eSails Keuzehulp — PAKKET
   Zet een project (één of meer geconfigureerde items) om in exacte
   winkelwagenregels. Puur: geen DOM, testbaar in Node.
   ===================================================================== */
(function (root, factory) {
  var api = factory(root.EsailsCore || (typeof require === 'function' ? require('./core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EsailsPakket = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ---------------- module/vorm-definities ---------------- */
  var MODULES = {
    bootkap: {
      naam: 'Bootkap & dekzeil',
      vormen: {
        buiskap: { naam: 'Buiskap / achtertent', model: 'buiskap', doeken: ['sunbrella_plus', 'sauleda_seastar', 'poly_marine'], bevestiging: ['loxx', 'druk', 'draai', 'ring'] },
        bimini:  { naam: 'Bimini / zonnedek', model: 'bimini', doeken: ['sunbrella_plus', 'sauleda_seastar', 'poly_marine'], bevestiging: ['loxx', 'druk', 'ring', 'klit'] },
        dekzeil: { naam: 'Dekzeil / winterkleed', model: 'plat', doeken: ['ferrari_705', 'mehler_8205', 'mehler_8940'], bevestiging: ['ring', 'tunnel', 'druk', 'loxx'] }
      }
    },
    afdekzeil: {
      naam: 'Afdekzeil op maat',
      vormen: {
        blok:    { naam: 'Hoes (blokvorm)', model: 'blok', doeken: ['ferrari_705', 'mehler_8205', 'mehler_8940', 'ferrari_602n'], bevestiging: ['tunnel', 'ring', 'klit'] },
        rond:    { naam: 'Ronde hoes', model: 'rond', doeken: ['ferrari_705', 'mehler_8205', 'mehler_8940', 'ferrari_602n'], bevestiging: ['tunnel', 'ring', 'klit'] },
        plat:    { naam: 'Plat zeil', model: 'plat', doeken: ['ferrari_705', 'mehler_8205', 'mehler_8940', 'ferrari_602n'], bevestiging: ['ring', 'tunnel', 'klit'] },
        jacuzzi: { naam: 'Jacuzzi / hottub', model: 'jacuzzi', doeken: ['ferrari_705', 'mehler_8205', 'mehler_8940'], bevestiging: ['tunnel', 'ring', 'loxx', 'klit'] }
      }
    },
    zonwering: {
      naam: 'Zonwering',
      vormen: {
        raam:   { naam: 'Voor een raam', model: 'zonwering', doeken: ['mehler_gaas', 'ferrari_362'], bevestiging: ['zuignap'] },
        balkon: { naam: 'Voor een balkon', model: 'zonwering', doeken: ['mehler_gaas', 'ferrari_362'], bevestiging: ['balkon', 'klit'] }
      }
    }
  };

  var BEVESTIGING = {
    loxx:    { naam: 'Loxx-systeem', afstand: 25 },
    druk:    { naam: 'Drukknopen', afstand: 25 },
    draai:   { naam: 'Draaisluitingen (tourniquets)', afstand: 30 },
    ring:    { naam: 'Zeilringen + elastisch koord', afstand: 35 },
    tunnel:  { naam: 'Tunnelzoom met koord', afstand: 0 },
    klit:    { naam: 'Klittenband', afstand: 0 },
    zuignap: { naam: 'Zuignappen + zeilringen', afstand: 50 },
    balkon:  { naam: 'Zeilringen + elastiek langs de railing', afstand: 50 }
  };

  var TUNNEL_ZOOM_CM = 8; // extra doek per rand voor een koordtunnel

  function vormDef(item) {
    var m = MODULES[item.module];
    return m && m.vormen[item.vorm];
  }

  /* doek + kleur opzoeken */
  function doekKleur(cat, item) {
    var d = cat.doeken[item.doek];
    if (!d) return null;
    var k = null;
    for (var i = 0; i < d.kleuren.length; i++) if (d.kleuren[i].vid === String(item.kleur)) k = d.kleuren[i];
    return k ? { doek: d, kleur: k } : null;
  }

  /* ---------------- berekening voor één item ---------------- */
  function berekenItem(item, cat) {
    var def = vormDef(item);
    if (!def) throw new Error('Onbekende vorm: ' + item.module + '/' + item.vorm);
    var maten = Object.assign({}, item.maten || {});
    var model = C.MODELLEN[def.model](maten);
    var aantal = Math.max(1, Math.round(item.aantal || 1));
    var dk = doekKleur(cat, item);
    var rol = dk ? dk.doek.rolCm : 150;
    var zoom = item.bevestiging === 'tunnel' ? C.R.zoomCm + TUNNEL_ZOOM_CM : C.R.zoomCm;
    var panels = model.panels.map(function (p) { return { naam: p.naam, w: p.w, h: p.h, qty: (p.qty || 1) * aantal }; });
    var plan = C.snijplan(panels, rol, { zoomCm: zoom });

    var opt = item.opt || {};
    var bev = BEVESTIGING[item.bevestiging] || {};
    var afstand = C.num(item.afstandCm || bev.afstand || 25, 10, 100);
    var randTot = model.randCm * aantal;
    var punten = 0;
    if (item.bevestiging === 'zuignap') {
      punten = (Math.ceil(model.breedte / afstand) + Math.ceil(model.hoogte / afstand)) * 2 * aantal;
    } else if (bev.afstand) {
      punten = (model.gesloten ? C.puntenRondom(model.randCm, afstand) : C.puntenLangs(model.randCm, afstand)) * aantal;
    }
    // stiklengte (m): alle paneelranden + zoom, voor garenverbruik
    var stikCm = panels.reduce(function (s, p) { return s + 2 * (p.w + p.h) * p.qty; }, 0) + plan.extraNaadCm;
    var naadCm = (model.naadCm || 0) * aantal + plan.extraNaadCm;

    return { def: def, model: model, plan: plan, aantal: aantal, dk: dk, punten: punten, afstand: afstand,
             randCm: randTot, stikCm: stikCm, naadCm: naadCm, opt: opt };
  }

  /* ---------------- regels opbouwen ---------------- */
  function Regels(cat) { this.cat = cat; this.list = []; }
  Regels.prototype.add = function (key, prod, qty, notitie, extra) {
    if (!prod) throw new Error('Product ontbreekt in catalogus: ' + key);
    qty = Math.ceil(qty - 1e-9);
    if (qty <= 0) return;
    if (prod.verpakking > 1) qty = Math.ceil(qty / prod.verpakking) * prod.verpakking; // bijv. DOT: per 10 verpakt
    var r = { key: key, vid: String(prod.vid), url: prod.url, naam: prod.naam, unit: prod.unit || 'st', prijs: prod.prijs, verpakking: prod.verpakking || 1,
              qty: qty, notitie: notitie || '', perOrder: !!prod.perOrder, tool: !!prod.tool, img: prod.img || null };
    if (extra) for (var k in extra) r[k] = extra[k];
    this.list.push(r);
  };
  Regels.prototype.p = function (key) {
    var p = this.cat.p[key];
    if (!p) throw new Error('Product ontbreekt in catalogus: ' + key);
    return p;
  };

  function regelsVoorItem(item, cat) {
    var b = berekenItem(item, cat);
    var R = new Regels(cat);
    var o = b.opt;
    var n = b.punten;
    var gereedschap = item.gereedschap !== false;

    /* doek */
    if (b.dk) {
      R.add('doek', { vid: b.dk.kleur.vid, url: b.dk.kleur.url, naam: b.dk.doek.naam + ' — ' + b.dk.kleur.naam, prijs: b.dk.kleur.prijs, unit: 'm', img: b.dk.kleur.img },
        b.plan.meters, 'Snijplan: ' + b.plan.stukken.length + ' stuk(ken) op een rol van ' + b.dk.doek.rolCm + ' cm breed, incl. zoom en snijmarge.', { groep: 'doek' });
    }

    /* verwerking */
    if (item.verwerking === 'lijmen') {
      var gram = C.lijmGram(b.naadCm + b.randCm); // naden + omgezette zoom
      if (gram <= 200) R.add('lijm', R.p('saba_250'), 1, 'Voor ±' + Math.round(gram) + ' g lijm (naden + zoom).', { groep: 'verwerking' });
      else R.add('lijm', R.p('saba_1l'), Math.ceil(gram / 900), 'Voor ±' + Math.round(gram) + ' g lijm (naden + zoom).', { groep: 'verwerking' });
      if (item.ontvetter !== false) R.add('ontvetter', R.p('griffon_cleaner'), 1, 'Ontvet de lijmnaden vooraf: essentieel voor een waterdichte hechting.', { groep: 'verwerking' });
    } else if (item.garen) {
      var garen = cat.garen[item.garen];
      if (garen) {
        var klossen = Math.max(1, Math.ceil((b.stikCm / 100) * 5 / 800)); // dubbele stiknaad, ~2,5x draad per naadmeter, 800 m per klos
        R.add('garen', garen, klossen, 'UV-bestendig garen, ±' + Math.round(b.stikCm / 100) + ' m stiknaad.', { groep: 'verwerking' });
      }
    }

    /* bevestiging */
    var bevNotitie = n + ' bevestigingspunten, om de ' + b.afstand + ' cm over ' + (b.randCm / 100).toFixed(1).replace('.', ',') + ' m rand.';
    switch (item.bevestiging) {
      case 'loxx': {
        var kop = { rvs: 'loxx_kop_rvs', kv: 'loxx_kop_kv', chroom: 'loxx_kop_chroom', zwart: 'loxx_kop_zwart' }[o.loxxKop || 'rvs'];
        R.add('loxx_kop', R.p(kop), n, bevNotitie, { groep: 'bevestiging' });
        var basis = o.loxxBasis || 'zelftapper';
        if (basis === 'zelftapper') R.add('loxx_basis', R.p(o.loxxKop === 'kv' ? 'loxx_zelftapper_kv' : 'loxx_zelftapper_rvs'), n, 'Wordt op de boot geschroefd; de kop klikt erop vast.', { groep: 'bevestiging' });
        if (basis === 'bout') {
          R.add('loxx_basis', R.p('loxx_bout_rvs'), n, 'Door een geboord gat, met moer erachter.', { groep: 'bevestiging' });
          R.add('loxx_moer', R.p('loxx_moer_rvs'), n, 'Eén moer per bout.', { groep: 'bevestiging' });
        }
        if (basis === 'doekdeel') R.add('loxx_basis', R.p('loxx_doekdeel_kv'), n, 'Voor doek-op-doek: de kop klikt in het doekdeel.', { groep: 'bevestiging' });
        R.add('loxx_sleutel', R.p('loxx_sleutel'), 1, 'Om de Loxx-koppen in het doek te monteren.', { groep: 'bevestiging' });
        if (gereedschap) R.add('loxx_holpijp', R.p('loxx_holpijp'), 1, 'Slaat het gat voor de kop in het doek.', { groep: 'gereedschap' });
        break;
      }
      case 'druk': {
        var merk = o.drukMerk || 'dot';
        R.add('druk_a', R.p('druk_' + merk + '_a'), n, 'Deel A (knop, in het doek). ' + bevNotitie, { groep: 'bevestiging' });
        R.add('druk_b', R.p('druk_' + merk + '_b'), n, 'Deel B (veer, in het doek).', { groep: 'bevestiging' });
        var c = 'druk_' + merk + '_c';
        if (merk === 'dot' && o.drukC && o.drukC !== 'parker') c = 'druk_dot_c_' + o.drukC;
        R.add('druk_c', R.p(c), n, 'Deel C (op de boot).', { groep: 'bevestiging' });
        if (gereedschap) {
          R.add('druk_holpijp', R.p('druk_holpijp'), 1, 'Slaat het gaatje voor deel A in het doek.', { groep: 'gereedschap' });
          R.add('druk_stempel', R.p('druk_stempel'), 1, 'Zet deel A en B vast.', { groep: 'gereedschap' });
          R.add('stansblok', R.p('stansblok'), 1, 'Ondergrond voor holpijp en stempel.', { groep: 'gereedschap' });
        }
        break;
      }
      case 'draai': {
        var dm = o.draaiMerk || 'prym';
        R.add('draai', R.p('draai_' + dm), n, 'Draaier (op de boot). ' + bevNotitie, { groep: 'bevestiging' });
        R.add('draai_kous', R.p('draai_' + dm + '_kous'), n, 'Bijpassende kous & ring (in het doek), zelfde maat als de draaier.', { groep: 'bevestiging' });
        if (gereedschap) {
          R.add('draai_holpijp', R.p('draai_' + dm + '_holpijp'), 1, 'Slaat het ovale gat voor de kous.', { groep: 'gereedschap' });
          R.add('draai_stempel', R.p('draai_' + dm + '_stempel'), 1, 'Zet kous en ring vast.', { groep: 'gereedschap' });
          R.add('stansblok', R.p('stansblok'), 1, 'Ondergrond voor holpijp en stempel.', { groep: 'gereedschap' });
        }
        break;
      }
      case 'ring':
      case 'balkon': {
        var din = item.bevestiging === 'balkon' ? 10 : (o.ringDin || 12);
        var mat = o.ringMat || 'rvs';
        R.add('ring', R.p('ring_' + din + '_' + mat), n, 'Zeilring DIN ' + din + ' in de rand. ' + bevNotitie, { groep: 'bevestiging' });
        var dikte = item.bevestiging === 'balkon' ? 6 : (o.koordDikte || 6);
        var kk = o.koordKleur || 'zwart';
        var factor = item.bevestiging === 'balkon' ? 1.15 : 1.5; // rijgen in zigzag vraagt meer koord
        R.add('koord', R.p('shock_' + dikte + '_' + kk), Math.ceil(b.randCm * factor / 100), 'Elastisch koord, incl. rijgmarge.', { groep: 'bevestiging' });
        var aanslag = item.bevestiging === 'balkon' ? 'koordhaak' : (o.aanslag || 'koordhaak');
        if (aanslag !== 'geen') {
          var aanslagNaam = { koordhaak: 'Haakt het koord vast.', musketon: 'Haakt het koord vast.', rondknop: 'Op de boot/het object; koord wordt erom geslagen.', noorse_knop: 'Op de boot; koord wordt erom geslagen.' }[aanslag];
          R.add('aanslag', R.p(aanslag), n, aanslagNaam, { groep: 'bevestiging' });
        }
        if (gereedschap) R.add('ring_set', R.p('ring_' + din + '_set'), 1, 'Holpijp + stempel in de maat van de zeilring.', { groep: 'gereedschap' });
        break;
      }
      case 'zuignap': {
        R.add('zuignap', R.p('zuignap'), n, n + ' zuignappen, om de ' + b.afstand + ' cm. Geen boren.', { groep: 'bevestiging' });
        R.add('ring', R.p('ring_10_rvs'), n, 'Eén zeilring per zuignap: voorkomt uitscheuren.', { groep: 'bevestiging' });
        if (gereedschap) R.add('ring_set', R.p('ring_10_set'), 1, 'Holpijp + stempel 10 mm voor de zeilringen.', { groep: 'gereedschap' });
        break;
      }
      case 'tunnel': {
        var td = o.koordDikte || 6, tk = o.koordKleur || 'zwart';
        R.add('koord', R.p('shock_' + td + '_' + tk), Math.ceil((b.randCm + 100 * b.aantal) / 100), 'Loopt door de tunnelzoom; strak aantrekken en vastzetten. Tunnel (+' + TUNNEL_ZOOM_CM + ' cm) is meegerekend in het doek.', { groep: 'bevestiging' });
        R.add('koordklem', R.p('koordklem'), 2 * b.aantal, 'Om de koordeinden af te werken.', { groep: 'bevestiging' });
        break;
      }
      case 'klit': {
        var w = o.klitBreedte === 50 ? 50 : 25;
        var m = Math.ceil(b.randCm / 100);
        R.add('klit_haak', R.p('klit_' + w + '_haak'), m, 'Harde kant, ' + m + ' m.', { groep: 'bevestiging' });
        R.add('klit_lus', R.p('klit_' + w + '_lus'), m, 'Zachte kant, ' + m + ' m.', { groep: 'bevestiging' });
        break;
      }
    }

    /* extra's */
    var x = item.extras || {};
    if (x.mallendoek) {
      var mm = Math.ceil(b.model.oppervlakM2 * b.aantal * 1.25 / (cat.p.mallendoek.rolCm / 100));
      R.add('mallendoek', R.p('mallendoek'), mm, 'Voor een mal van ±' + (b.model.oppervlakM2 * b.aantal).toFixed(1).replace('.', ',') + ' m², 300 cm breed.', { groep: 'extra' });
    }
    if (x.raamfolie && x.raamfolie.breedte > 0 && x.raamfolie.hoogte > 0) {
      var rf = x.raamfolie;
      var fplan = C.snijplan([{ naam: 'Raam', w: C.num(rf.breedte, 10, 500), h: C.num(rf.hoogte, 10, 200), qty: Math.max(1, rf.aantal || 1) * b.aantal }], cat.p.raamfolie.rolCm, { zoomCm: 3 });
      R.add('raamfolie', R.p(rf.soort === 'smoke' ? 'raamfolie_05' : 'raamfolie'), fplan.meters, (rf.aantal || 1) + '× raam ' + rf.breedte + ' × ' + rf.hoogte + ' cm, rol 137 cm.', { groep: 'extra' });
      if (rf.tape) R.add('tape', R.p('tape_' + rf.tape), 1, 'Om de raamfolie vóór het stikken op zijn plaats te houden.', { groep: 'extra' });
    }
    (x.ritsen || []).forEach(function (rz, i) {
      var r = cat.ritsen[rz.type] && cat.ritsen[rz.type][String(rz.lengte)];
      if (r) R.add('rits_' + rz.type + '_' + rz.lengte, r, (rz.aantal || 1) * b.aantal, 'Deelbare rits, ' + (rz.lengte / 100).toFixed(1).replace('.', ',') + ' m.', { groep: 'extra' });
    });
    if (x.trekband && x.trekband.sets > 0) {
      var s = x.trekband.sets * b.aantal;
      R.add('band', R.p('band_25_zwart'), s, '1 m band per trekbandje.', { groep: 'extra' });
      R.add('klemgesp', R.p('klemgesp'), s, 'Eén klemgesp per trekbandje.', { groep: 'extra' });
      if (x.trekband.beugel) R.add('beugel', R.p('beugel_' + x.trekband.beugel), s, 'Op de boot, voor het andere uiteinde.', { groep: 'extra' });
    }
    return { regels: R.list, berekening: b };
  }

  /* ---------------- volledig project ---------------- */
  function bouwPakket(project, cat) {
    var perItem = [];
    var map = {}, volgorde = [];
    (project.items || []).forEach(function (item, idx) {
      var r = regelsVoorItem(item, cat);
      perItem.push(r);
      r.regels.forEach(function (ln) {
        var m = map[ln.vid];
        if (!m) { m = map[ln.vid] = Object.assign({}, ln, { qty: 0, items: [] }); volgorde.push(ln.vid); }
        m.qty = ln.perOrder ? Math.max(m.qty, ln.qty) : m.qty + ln.qty;
        if (m.items.indexOf(idx) < 0) m.items.push(idx);
      });
    });
    (project.onderhoud || []).forEach(function (o) {
      var p = cat.p[o.key];
      if (!p || !(o.qty > 0)) return;
      if (!map[p.vid]) { map[p.vid] = { key: o.key, vid: String(p.vid), url: p.url, naam: p.naam, unit: p.unit, prijs: p.prijs, qty: 0, notitie: '', groep: 'onderhoud', items: [], img: p.img || null }; volgorde.push(String(p.vid)); }
      map[p.vid].qty = Math.max(map[p.vid].qty, o.qty);
    });
    var regels = volgorde.map(function (v) { return map[v]; });
    return { regels: regels, perItem: perItem, totaal: totaal(regels) };
  }

  function totaal(regels, prijzen) {
    return regels.reduce(function (s, r) {
      var p = prijzen && prijzen[r.vid] && prijzen[r.vid].prijs != null ? prijzen[r.vid].prijs : r.prijs;
      return s + p * r.qty;
    }, 0);
  }

  return { MODULES: MODULES, BEVESTIGING: BEVESTIGING, berekenItem: berekenItem, regelsVoorItem: regelsVoorItem, bouwPakket: bouwPakket, totaal: totaal, doekKleur: doekKleur };
});
