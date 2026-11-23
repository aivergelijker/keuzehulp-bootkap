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
        dekzeil: { naam: 'Dekzeil / winterkleed', model: 'dekzeil', doeken: ['ferrari_705', 'mehler_8205', 'mehler_8940'], bevestiging: ['ring', 'tunnel', 'druk', 'loxx'] }
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
        balkon: { naam: 'Voor een balkon', model: 'zonwering', doeken: ['mehler_gaas', 'ferrari_362'], bevestiging: ['balkon'] } // buiten: geen klittenband
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
    balkon:  { naam: 'Oogjes + koord of tie-wraps aan de reling', afstand: 50 }
  };

  var TUNNEL_ZOOM_CM = 8; // extra doek per rand voor een koordtunnel
  var SPLITSBAAR = { dekzeil: 1, blok: 1, jacuzzi: 1, rond: 1 }; // modellen met een rok die uit delen mag bestaan

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
    // Koordtunnel: bij een enkel zeil rondom (alle randen), anders alleen aan de
    // onderrand van de stukken die de rand vormen (zijkanten, rok, strook).
    var tunnel = item.bevestiging === 'tunnel';
    var rondom = model.rand && model.rand.rondom;
    var zoom = tunnel && rondom ? C.R.zoomCm + TUNNEL_ZOOM_CM : C.R.zoomCm;
    var randPanelen = (model.rand && model.rand.zijden || []).map(function (zz) { return zz.paneel; });
    var panels = model.panels.map(function (p) {
      var extraH = tunnel && !rondom && randPanelen.indexOf(p.naam) >= 0 ? TUNNEL_ZOOM_CM : 0;
      return { naam: p.naam, w: p.w, h: p.h, qty: (p.qty || 1) * aantal, zoomCm: zoom, extraH: extraH };
    });
    var plan = C.snijplan(panels, rol, { zoomCm: zoom });

    // Rokstroken (dekzeil, hoes, jacuzzi, ronde hoes) die langer zijn dan de
    // rolbreedte mogen uit gelijke delen bestaan, zodat ze dwars op de rol
    // passen. Alleen als dat minstens 1 m doek scheelt. Elke deelnaad gebruikt
    // de zoom van beide delen; de extra naden tellen mee voor garen/lijm.
    var splitNaadCm = 0;
    if (SPLITSBAAR[def.model]) {
      var nuttig = rol - 2 * zoom;
      var alt = panels.map(function (p) {
        var hoog = p.h + 2 * zoom + (p.extraH || 0);
        if (randPanelen.indexOf(p.naam) < 0 || p.w + 2 * zoom <= rol || hoog > rol || nuttig <= 0) return p;
        var k = Math.ceil(p.w / nuttig - 1e-9);
        return Object.assign({}, p, { naam: p.naam + ' (deel van ' + k + ')', basis: p.naam, delen: k, w: p.w / k, qty: p.qty * k });
      });
      if (alt.some(function (p) { return p.delen; })) {
        var altPlan = C.snijplan(alt, rol, { zoomCm: zoom });
        if (altPlan.meters <= plan.meters - 1) {
          panels = alt; plan = altPlan;
          panels.forEach(function (p) { if (p.delen) splitNaadCm += (p.delen - 1) * p.h * (p.qty / p.delen); });
        }
      }
    }

    var opt = item.opt || {};
    var bev = BEVESTIGING[item.bevestiging] || {};
    var afstand = C.num(item.afstandCm || bev.afstand || 25, 10, 100);
    var randTot = model.randCm * aantal;
    // bevestigers: in elke hoek één, daartussen gelijk verdeeld (zie C.puntenPlan)
    var puntenPlan = bev.afstand ? C.puntenPlan(model.rand, afstand) : { totaal: 0, zijden: [] };
    var punten = puntenPlan.totaal * aantal;
    // stiklengte (m): alle paneelranden + zoom, voor garenverbruik
    var stikCm = panels.reduce(function (s, p) { return s + 2 * (p.w + p.h) * p.qty; }, 0) + plan.extraNaadCm;
    var naadCm = (model.naadCm || 0) * aantal + plan.extraNaadCm + splitNaadCm;

    return { def: def, model: model, plan: plan, aantal: aantal, dk: dk, punten: punten, puntenPlan: puntenPlan, afstand: afstand, zoom: zoom, snijPanels: panels,
             randCm: randTot, stikCm: stikCm, naadCm: naadCm, opt: opt };
  }

  /* ---------------- regels opbouwen ---------------- */
  function Regels(cat) { this.cat = cat; this.list = []; }
  Regels.prototype.add = function (key, prod, qty, notitie, extra) {
    if (!prod) throw new Error('Product ontbreekt in catalogus: ' + key);
    // Meterwaar (koord, klittenband, mallendoek): exacte lengte bewaren, zodat
    // bouwPakket eerst over alle items optelt en pas daarna afrondt.
    var exact = (prod.unit === 'm' && extra && extra.groep !== 'doek') ? qty : null;
    qty = Math.ceil(qty - 1e-9);
    if (qty <= 0) return;
    if (prod.verpakking > 1) qty = Math.ceil(qty / prod.verpakking) * prod.verpakking; // bijv. DOT: per 10 verpakt
    var r = { key: key, vid: String(prod.vid), url: prod.url, naam: prod.naam, unit: prod.unit || 'st', prijs: prod.prijs, verpakking: prod.verpakking || 1,
              qty: qty, notitie: notitie || '', perOrder: !!prod.perOrder, tool: !!prod.tool, img: prod.img || null };
    if (exact != null) r.exact = exact;
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
        b.plan.meters, 'Snijplan: ' + b.plan.stukken.length + ' stuk(ken) op een rol van ' + b.dk.doek.rolCm + ' cm breed, incl. zoom.', { groep: 'doek' });
    }

    /* verwerking */
    if (item.verwerking === 'lijmen') {
      var gram = C.lijmGram(b.naadCm + b.randCm); // naden + omgezette zoom
      if (gram <= 200) R.add('lijm', R.p('saba_250'), 1, 'Voor ±' + Math.round(gram) + ' g lijm (naden + zoom).', { groep: 'verwerking' });
      else R.add('lijm', R.p('saba_1l'), Math.ceil(gram / 900), 'Voor ±' + Math.round(gram) + ' g lijm (naden + zoom).', { groep: 'verwerking' });
      if (item.ontvetter !== false) R.add('ontvetter', R.p('griffon_cleaner'), 1, 'Ontvet de lijmnaden vooraf: essentieel voor een waterdichte hechting.', { groep: 'verwerking' });
    } else if (item.garen || (item.module === 'zonwering' && item.verwerking !== 'naaien' && b.dk && b.dk.kleur.garen)) {
      // zonwering wordt altijd gestikt: een ouder bewaard pakket (nog zonder stap Verwerking) krijgt het
      // bijpassende garen; kiest de klant zelf "Geen garen nodig", dan respecteren we dat
      var garen = cat.garen[item.garen || b.dk.kleur.garen];
      if (garen) {
        var klossen = Math.max(1, Math.ceil((b.stikCm / 100) * 5 / 800)); // dubbele stiknaad, ~2,5x draad per naadmeter, 800 m per klos
        R.add('garen', garen, klossen, 'UV-bestendig garen, ±' + Math.round(b.stikCm / 100) + ' m stiknaad.', { groep: 'verwerking' });
      }
    }

    /* bevestiging */
    var bevNotitie = n + ' bevestigingspunten: één in elke hoek, daartussen gelijk verdeeld (max. ±' + b.afstand + ' cm) over ' + (b.randCm / 100).toFixed(1).replace('.', ',') + ' m rand.';
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
        // De montagesleutel krijgt de klant bij elke Loxx-bestelling erbij, ook zonder gereedschap.
        R.add('loxx_sleutel', R.p('loxx_sleutel'), 1, 'Hoort bij elke Loxx-bestelling: om de koppen in het doek te monteren.', { groep: 'bevestiging' });
        if (gereedschap) {
          R.add('loxx_holpijp', R.p('loxx_holpijp'), 1, 'Slaat het gat (9 mm) voor de kop in het doek.', { groep: 'gereedschap' });
          R.add('stansblok', R.p('stansblok'), 1, 'Ondergrond voor de holpijp.', { groep: 'gereedschap' });
        }
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
      case 'balkon': {
        // Oogjes (zeilringen DIN 10) in de zoom; aan de reling/balustrade met elastisch koord of tie-wraps.
        R.add('ring', R.p('ring_10_' + (o.ringMat || 'rvs')), n, 'Oogje (zeilring DIN 10) in de zoom. ' + bevNotitie, { groep: 'bevestiging' });
        if (o.balkonVast === 'tiewrap') {
          R.add('tiewrap', R.p('tiewrap'), Math.ceil(n / 10), n + ' tie-wraps: één per oogje, om de reling (zakjes van 10).', { groep: 'bevestiging' });
        } else {
          R.add('koord', R.p('shock_6_' + (o.koordKleur || 'zwart')), b.randCm * 1.5 / 100, 'Elastisch koord: door de oogjes en om de reling rijgen, incl. rijgmarge.', { groep: 'bevestiging' });
          R.add('koordklem', R.p('koordklem'), 2 * b.aantal, 'Om de koordeinden af te werken.', { groep: 'bevestiging' });
        }
        if (gereedschap) R.add('ring_set', R.p('ring_10_set'), 1, 'Holpijp + stempel 10 mm voor de oogjes.', { groep: 'gereedschap' });
        break;
      }
      case 'ring': {
        var din = o.ringDin || 12;
        var mat = o.ringMat || 'rvs';
        R.add('ring', R.p('ring_' + din + '_' + mat), n, 'Zeilring DIN ' + din + ' in de rand. ' + bevNotitie, { groep: 'bevestiging' });
        var dikte = o.koordDikte || 6;
        var kk = o.koordKleur || 'zwart';
        var factor = 1.5; // rijgen in zigzag vraagt meer koord
        R.add('koord', R.p('shock_' + dikte + '_' + kk), b.randCm * factor / 100, 'Elastisch koord, incl. rijgmarge.', { groep: 'bevestiging' });
        var aanslag = o.aanslag || 'koordhaak';
        if (aanslag !== 'geen') {
          var aanslagNaam = { koordhaak: 'Haakt het koord vast.', musketon: 'Haakt het koord vast.', rondknop: 'Op de boot/het object; koord wordt erom geslagen.', noorse_knop: 'Op de boot; koord wordt erom geslagen.' }[aanslag];
          R.add('aanslag', R.p(aanslag), n, aanslagNaam, { groep: 'bevestiging' });
        }
        if (gereedschap) R.add('ring_set', R.p('ring_' + din + '_set'), 1, 'Holpijp + stempel in de maat van de zeilring.', { groep: 'gereedschap' });
        break;
      }
      case 'zuignap': {
        R.add('zuignap', R.p('zuignap'), n, n + ' zuignappen: één in elke hoek, daartussen gelijk verdeeld. Geen boren.', { groep: 'bevestiging' });
        R.add('ring', R.p('ring_10_rvs'), n, 'Eén zeilring per zuignap: voorkomt uitscheuren.', { groep: 'bevestiging' });
        if (gereedschap) R.add('ring_set', R.p('ring_10_set'), 1, 'Holpijp + stempel 10 mm voor de zeilringen.', { groep: 'gereedschap' });
        break;
      }
      case 'tunnel': {
        var td = o.koordDikte || 6, tk = o.koordKleur || 'zwart';
        R.add('koord', R.p('shock_' + td + '_' + tk), (b.randCm + 100 * b.aantal) / 100, 'Loopt door de tunnelzoom; strak aantrekken en vastzetten. Tunnel (+' + TUNNEL_ZOOM_CM + ' cm) is meegerekend in het doek.', { groep: 'bevestiging' });
        R.add('koordklem', R.p('koordklem'), 2 * b.aantal, 'Om de koordeinden af te werken.', { groep: 'bevestiging' });
        break;
      }
      case 'klit': {
        var w = o.klitBreedte === 50 ? 50 : 25;
        var m = b.randCm / 100, mTxt = (Math.round(m * 10) / 10).toString().replace('.', ',');
        R.add('klit_haak', R.p('klit_' + w + '_haak'), m, 'Zelfklevend, harde kant, ' + mTxt + ' m. Plak op een schone, vetvrije ondergrond.', { groep: 'bevestiging' });
        R.add('klit_lus', R.p('klit_' + w + '_lus'), m, 'Zelfklevend, zachte kant, ' + mTxt + ' m.', { groep: 'bevestiging' });
        break;
      }
    }

    /* extra's */
    var x = item.extras || {};
    if (x.mallendoek) {
      // Mal van alle stukken (dezelfde als het doek, incl. rokdelen), netto maat zonder zoom,
      // op de rol mallendoek van 300 cm: een boot van 3 m breed past zo in één lengte.
      var malPlan = C.snijplan(malPanelen(b), cat.p.mallendoek.rolCm, { zoomCm: 0 });
      R.add('mallendoek', R.p('mallendoek'), malPlan.meters, 'Mal van alle stukken (' + malPlan.stukken.length + ' stuk' + (malPlan.stukken.length === 1 ? '' : 'ken') + ') op een rol van ' + cat.p.mallendoek.rolCm + ' cm breed.', { groep: 'extra' });
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

  /* Mal-stukken: dezelfde stukken als het doek, netto (zonder zoom of tunnel). */
  function malPanelen(b) {
    return b.snijPanels.map(function (p) { return { naam: p.naam, w: p.w, h: p.h, qty: p.qty, zoomCm: 0, extraH: 0 }; });
  }

  /* ---------------- volledig project ---------------- */
  function bouwPakket(project, cat) {
    var perItem = [];
    var map = {}, volgorde = [];
    (project.items || []).forEach(function (item, idx) {
      var r = regelsVoorItem(item, cat);
      r.item = item;
      perItem.push(r);
      r.regels.forEach(function (ln) {
        var m = map[ln.vid];
        if (!m) { m = map[ln.vid] = Object.assign({}, ln, { qty: 0, items: [] }); if (ln.exact != null) m.exact = 0; volgorde.push(ln.vid); }
        if (ln.exact != null && m.exact != null) { m.exact += ln.exact; m.qty = Math.ceil(m.exact - 1e-9); }
        else m.qty = ln.perOrder ? Math.max(m.qty, ln.qty) : m.qty + ln.qty;
        if (m.items.indexOf(idx) < 0) m.items.push(idx);
      });
    });
    // Een set "Holpijp & stempel" voor zeilringen bevat al een gratis stansblok:
    // dan geen los stansblok meer bestellen voor drukknopen of tourniquets.
    var sb = cat.p.stansblok && String(cat.p.stansblok.vid);
    var setVids = Object.keys(cat.p).filter(function (k) { return /^ring_\d+_set$/.test(k); }).map(function (k) { return String(cat.p[k].vid); });
    var heeftSet = volgorde.some(function (v) { return setVids.indexOf(v) >= 0; });
    if (heeftSet && sb && map[sb]) { delete map[sb]; volgorde.splice(volgorde.indexOf(sb), 1); }
    (project.onderhoud || []).forEach(function (o) {
      var p = cat.p[o.key];
      if (!p || !(o.qty > 0)) return;
      if (!map[p.vid]) { map[p.vid] = { key: o.key, vid: String(p.vid), url: p.url, naam: p.naam, unit: p.unit, prijs: p.prijs, qty: 0, notitie: '', groep: 'onderhoud', items: [], img: p.img || null }; volgorde.push(String(p.vid)); }
      map[p.vid].qty = Math.max(map[p.vid].qty, o.qty);
    });
    var snijplannen = combineerDoek(perItem, map, cat);
    var regels = volgorde.map(function (v) { return map[v]; });
    return { regels: regels, perItem: perItem, snijplannen: snijplannen, totaal: totaal(regels) };
  }

  /* Items met hetzelfde doek (en dezelfde kleur) delen één snijplan: kleine
     stukken van verschillende items passen dan naast elkaar op de rol, in
     plaats van dat elk item apart naar hele meters wordt afgerond. Hetzelfde
     geldt voor raamfolie. */
  function combineerDoek(perItem, map, cat) {
    var groepen = {}, lijst = [];
    function groep(vid, info) {
      if (!groepen[vid]) { groepen[vid] = Object.assign({ vid: vid, items: [], panels: [], los: 0 }, info); lijst.push(groepen[vid]); }
      return groepen[vid];
    }
    perItem.forEach(function (r, idx) {
      var b = r.berekening;
      if (b.dk) {
        var g = groep(String(b.dk.kleur.vid), { soort: 'doek', dk: b.dk, rolCm: b.dk.doek.rolCm, naam: b.dk.doek.naam + ' — ' + b.dk.kleur.naam });
        g.items.push(idx); g.los += b.plan.meters;
        b.snijPanels.forEach(function (p) { g.panels.push(Object.assign({}, p, { item: idx })); });
      }
      var ml = r.regels.filter(function (ln) { return ln.key === 'mallendoek'; })[0];
      if (ml) {
        var gm = groep(String(ml.vid), { soort: 'mallendoek', rolCm: cat.p.mallendoek.rolCm, naam: ml.naam });
        gm.items.push(idx); gm.los += ml.qty;
        malPanelen(b).forEach(function (p) { gm.panels.push(Object.assign(p, { item: idx })); });
      }
      var fr = r.regels.filter(function (ln) { return ln.key === 'raamfolie'; })[0];
      var rf = r.item.extras && r.item.extras.raamfolie;
      if (fr && rf) {
        var gf = groep(String(fr.vid), { soort: 'raamfolie', rolCm: cat.p.raamfolie.rolCm, naam: fr.naam });
        gf.items.push(idx); gf.los += fr.qty;
        gf.panels.push({ naam: 'Raamfolie', w: C.num(rf.breedte, 10, 500), h: C.num(rf.hoogte, 10, 200), qty: Math.max(1, rf.aantal || 1) * b.aantal, zoomCm: 3, item: idx });
      }
    });
    lijst.forEach(function (g) {
      g.plan = C.snijplan(g.panels, g.rolCm, {});
      var m = map[g.vid];
      if (!m) return;
      m.qty = g.plan.meters;
      if (g.items.length > 1) {
        m.notitie = 'Gezamenlijk snijplan voor items ' + g.items.map(function (i) { return i + 1; }).join(', ') + ': ' + g.plan.stukken.length +
          ' stukken op een rol van ' + g.rolCm + ' cm breed, incl. zoom.' + (g.los > g.plan.meters ? ' Dat scheelt ' + (g.los - g.plan.meters) + ' m t.o.v. elk item apart.' : '');
      }
    });
    return lijst;
  }

  function totaal(regels, prijzen) {
    return regels.reduce(function (s, r) {
      var p = prijzen && prijzen[r.vid] && prijzen[r.vid].prijs != null ? prijzen[r.vid].prijs : r.prijs;
      return s + p * r.qty;
    }, 0);
  }

  return { MODULES: MODULES, BEVESTIGING: BEVESTIGING, berekenItem: berekenItem, regelsVoorItem: regelsVoorItem, bouwPakket: bouwPakket, totaal: totaal, doekKleur: doekKleur };
});
