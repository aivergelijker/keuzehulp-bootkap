/* =====================================================================
   eSails Keuzehulp — BOUWTEKENING
   Maakt van een berekend item (P.berekenItem) een indicatieve
   bouwtekening: stukkenlijst, tekening per stuk met maten en
   bevestigingspunten, snijplan met maten en een werkvolgorde.
   Puur: geeft HTML/SVG-strings terug, geen DOM. Testbaar in Node.

   Let op: dit is een VOORBEELD van een mogelijke uitvoering, geen
   maatwerkontwerp. De disclaimer hoort altijd bij de tekening.
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EsailsBouwtekening = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DISCLAIMER = 'Deze bouwtekening is een voorbeeld van een mogelijke uitvoering, als indicatie. ' +
    'Het is geen maatwerkontwerp of advies. Meet altijd zelf na en maak bij twijfel eerst een mal. ' +
    'eSails is niet aansprakelijk voor het eindresultaat.';

  // panelen die bovenop liggen; bevestigers komen op de onderrand van de overige panelen
  var BOVEN = { 'Dak': 1, 'Bovenkant': 1, 'Bovenblad (rond)': 1, 'Bovenblad': 1 };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cm(n) { return String(Math.round(n)); }
  function nl(n, d) { return (Math.round(n * Math.pow(10, d || 1)) / Math.pow(10, d || 1)).toString().replace('.', ','); }

  /* ---------------- stukkenlijst ---------------- */
  function stukken(b) {
    var z = b.zoom || 0, nr = 0, snij = b.snijPanels || [];
    return b.model.panels.map(function (p) {
      nr++;
      var sp = snij.filter(function (x) { return (x.basis || x.naam) === p.naam; })[0] || {};
      var ex = sp.extraH || 0, delen = sp.delen || 1;
      var deelW = delen > 1 ? sp.w : p.w;
      var bn = (b.plan.stukken || []).filter(function (x) { return x.baan && x.naam.indexOf(p.naam + ' (baan') === 0; });
      var banen = bn.length ? { n: bn.length / ((p.qty || 1) * b.aantal), richting: bn[0].baanRichting, naadPos: bn[0].naadPos || [], breedte: bn[0].w } : null;
      return { nr: nr, naam: p.naam, noot: p.noot || null, qty: (p.qty || 1) * b.aantal, nettoW: p.w, nettoH: p.h, banen: banen,
               snijW: deelW + 2 * z, snijH: p.h + 2 * z + ex, tekenW: p.w + 2 * z, zoom: z, extraH: ex,
               delen: delen, deelNetto: deelW, rond: /rond\)/.test(p.naam) };
    });
  }

  /* ---------------- bevestiging per stuk ----------------
     Volgt C.puntenPlan: in elke hoek een punt, daartussen gelijk verdeeld.
     Enkel paneel met rondom-rand: punten op alle vier de zijden.
     Anders: op de onderrand van de panelen die de rand vormen (zijkanten,
     voorkant, rok); hoekpunten worden gedeeld door aangrenzende stukken. */
  function bevestigingPerStuk(b, lijst) {
    var per = {}, rand = b.model.rand || { zijden: [] }, plan = b.puntenPlan || { zijden: [] };
    lijst.forEach(function (s) {
      if (rand.rondom && lijst.length === 1) { per[s.nr] = { rondom: true, zijden: plan.zijden, n: plan.totaal || 0 }; return; }
      var hoort = rand.zijden.some(function (zz) { return zz.paneel === s.naam; });
      if (!hoort) return;
      var pz = plan.zijden.filter(function (zz) { return zz.paneel === s.naam; })[0] || null;
      var cirkel = rand.type === 'cirkel';
      per[s.nr] = { rondom: false, cirkel: cirkel, zijde: pz, n: pz ? (cirkel ? pz.vakken : pz.vakken + 1) : 0 };
    });
    return per;
  }

  function bevestigingTekst(bev) {
    if (!bev || !bev.n) return '';
    var zin = function (lbl, zz) { return lbl + ' (' + cm(zz.lengte) + ' cm): ' + zz.vakken + ' ' + (zz.vakken === 1 ? 'vak' : 'vakken') + ' van ' + nl(zz.tussen, 1) + ' cm, aftekenen op ' + zz.posities.join(' · ') + ' cm'; };
    if (bev.rondom) return zin('Boven en onder', bev.zijden[0]) + '<br>' + zin('Zijkanten', bev.zijden[1]);
    if (bev.cirkel) return 'Rondom: ' + bev.n + ' punten, om de ' + nl(bev.zijde.tussen, 1) + ' cm vanaf de naad (' + bev.zijde.posities.join(' · ') + ' cm)';
    return bev.zijde ? zin('Onderrand, ' + bev.n + ' punten', bev.zijde) : '';
  }

  /* ---------------- tekening van één stuk ---------------- */
  function stukSVG(s, bev, item, b, kleur) {
    var maxW = 260, maxH = 150, pad = 34;
    var tw = s.tekenW || s.snijW; // bij een rok uit delen tekenen we de hele strook
    var sc = Math.min(maxW / tw, maxH / s.snijH);
    var W = tw * sc, H = s.snijH * sc, z = s.zoom * sc, ex = (s.extraH || 0) * sc;
    var vw = Math.max(W + pad * 2, 270), vh = H + pad * 2 + 6;
    var x0 = (vw - W) / 2, y0 = pad;
    var o = '<svg class="eskh-bt-svg" width="' + cm(vw) + '" height="' + cm(vh) + '" viewBox="0 0 ' + cm(vw) + ' ' + cm(vh) + '" role="img" aria-label="' + esc(s.naam + ': ' + cm(s.nettoW) + ' bij ' + cm(s.nettoH) + ' cm') + '">';
    // snijmaat (gestippeld) en netto (doorgetrokken)
    o += '<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" fill="none" stroke="#9aa1ab" stroke-dasharray="4 3"/>';
    if (s.rond) {
      o += '<ellipse cx="' + (x0 + W / 2) + '" cy="' + (y0 + H / 2) + '" rx="' + (W / 2 - z) + '" ry="' + (H / 2 - z) + '" fill="' + kleur + '" fill-opacity=".35" stroke="#1f2937"/>';
    } else {
      o += '<rect x="' + (x0 + z) + '" y="' + (y0 + z) + '" width="' + (W - 2 * z) + '" height="' + (H - 2 * z - ex) + '" fill="' + kleur + '" fill-opacity=".35" stroke="#1f2937"/>';
    }
    // stiklijn van de zoom (enkel zeil rondom, gestikt): ±1 cm binnen de omgeslagen zoom
    var gestikt = item.module === 'zonwering' || item.verwerking !== 'lijmen';
    if (gestikt && bev && bev.rondom && !s.rond) {
      var si = Math.max(3, (s.zoom - 1) * sc);
      o += '<rect x="' + (x0 + z + si).toFixed(1) + '" y="' + (y0 + z + si).toFixed(1) + '" width="' + Math.max(1, W - 2 * z - 2 * si).toFixed(1) + '" height="' + Math.max(1, H - 2 * z - ex - 2 * si).toFixed(1) + '" fill="none" stroke="#2563eb" stroke-width="1" stroke-dasharray="2 2"/>';
    }
    // baannaden (stuk breder dan de rol)
    if (s.banen && s.banen.naadPos.length) {
      s.banen.naadPos.forEach(function (pos) {
        var q = pos * sc;
        o += s.banen.richting === 'w'
          ? '<line x1="' + (x0 + q).toFixed(1) + '" y1="' + (y0 + 2) + '" x2="' + (x0 + q).toFixed(1) + '" y2="' + (y0 + H - 2) + '" stroke="#1f2937" stroke-width="1.2" stroke-dasharray="3 2"/>'
          : '<line x1="' + (x0 + 2) + '" y1="' + (y0 + q).toFixed(1) + '" x2="' + (x0 + W - 2) + '" y2="' + (y0 + q).toFixed(1) + '" stroke="#1f2937" stroke-width="1.2" stroke-dasharray="3 2"/>';
      });
    }
    // deelnaden (rok uit delen)
    if (s.delen > 1) {
      for (var d = 1; d < s.delen; d++) {
        var nx = x0 + z + (W - 2 * z) * d / s.delen;
        o += '<line x1="' + nx.toFixed(1) + '" y1="' + (y0 + 2) + '" x2="' + nx.toFixed(1) + '" y2="' + (y0 + H - 2) + '" stroke="#1f2937" stroke-width="1.2" stroke-dasharray="3 2"/>';
      }
    }
    // bevestiging
    var accent = '#c2410c';
    if (bev) {
      var lijnRand = item.bevestiging === 'tunnel' || item.bevestiging === 'klit';
      var ix = x0 + z, iy = y0 + z, iw = W - 2 * z, ih = H - 2 * z - ex;
      var inset = Math.min(6, iw / 8, ih / 8);
      if (lijnRand) {
        var sw = 'stroke="' + accent + '" stroke-width="3" fill="none" stroke-linecap="round"';
        if (bev.rondom) o += s.rond ? '<ellipse cx="' + (x0 + W / 2) + '" cy="' + (y0 + H / 2) + '" rx="' + (iw / 2 - 2) + '" ry="' + (ih / 2 - 2) + '" ' + sw + '/>' : '<rect x="' + (ix + 2) + '" y="' + (iy + 2) + '" width="' + (iw - 4) + '" height="' + (ih - 4) + '" ' + sw + '/>';
        else o += '<line x1="' + ix + '" y1="' + (iy + ih - 2) + '" x2="' + (ix + iw) + '" y2="' + (iy + ih - 2) + '" ' + sw + '/>';
      } else if (bev.n > 0) {
        puntenOpRand(bev, ix + inset, iy + inset, iw - 2 * inset, ih - 2 * inset).forEach(function (pt) {
          o += '<circle cx="' + pt[0].toFixed(1) + '" cy="' + pt[1].toFixed(1) + '" r="2.6" fill="' + accent + '"/>';
        });
      }
    }
    // maatlijnen (netto) boven en links
    var ty = y0 - 14;
    o += maatlijn(x0 + z, ty, x0 + W - z, ty, cm(s.nettoW) + ' cm');
    var lx = x0 - 14;
    o += maatlijnV(lx, y0 + z, lx, y0 + H - z - ex, cm(s.nettoH) + ' cm');
    // label
    o += '<text x="' + (x0 + W / 2) + '" y="' + (y0 + H / 2 + 4) + '" font-size="12" font-weight="600" text-anchor="middle" fill="#111827">' + esc(s.nr + '. ' + s.naam) + (s.qty > 1 ? ' ×' + s.qty : '') + '</text>';
    o += '<text x="' + (x0 + W / 2) + '" y="' + (y0 + H + 16) + '" font-size="10" text-anchor="middle" fill="#555">' + (s.delen > 1 ? s.delen + ' delen, snijmaat per deel ' : 'Snijmaat ') + cm(s.snijW) + ' × ' + cm(s.snijH) + ' cm (incl. ' + cm(s.zoom) + ' cm zoom per rand' + (s.extraH ? ' + ' + cm(s.extraH) + ' cm tunnel onder' : '') + ')</text>';
    return o + '</svg>';
  }

  // punten op de netto rand: hoeken eerst, daartussen volgens het puntenplan
  function puntenOpRand(bev, x, y, w, h) {
    var pts = [];
    var f = function (zz, i) { return zz.posities[i] / zz.lengte; };
    if (bev.rondom) {
      var top = bev.zijden[0], rechts = bev.zijden[1], i;
      for (i = 0; i < top.vakken; i++) pts.push([x + w * f(top, i), y]);                 // boven, links → rechts
      for (i = 0; i < rechts.vakken; i++) pts.push([x + w, y + h * f(rechts, i)]);       // rechts, boven → onder
      for (i = 0; i < top.vakken; i++) pts.push([x + w - w * f(top, i), y + h]);         // onder, rechts → links
      for (i = 0; i < rechts.vakken; i++) pts.push([x, y + h - h * f(rechts, i)]);       // links, onder → boven
      return pts;
    }
    var zz = bev.zijde; if (!zz) return pts;
    var n = bev.cirkel ? zz.vakken : zz.vakken + 1;
    for (var k = 0; k < n; k++) pts.push([x + w * f(zz, k), y + h]);
    return pts;
  }

  function maatlijn(x1, y, x2, y2, label) {
    return '<g class="eskh-bt-maat" stroke="#374151" stroke-width="1">' +
      '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y2 + '"/>' +
      '<line x1="' + x1 + '" y1="' + (y - 4) + '" x2="' + x1 + '" y2="' + (y + 4) + '"/><line x1="' + x2 + '" y1="' + (y - 4) + '" x2="' + x2 + '" y2="' + (y + 4) + '"/></g>' +
      '<text x="' + ((x1 + x2) / 2) + '" y="' + (y - 5) + '" font-size="11" text-anchor="middle" fill="#111827">' + esc(label) + '</text>';
  }
  function maatlijnV(x, y1, x2, y2, label) {
    var my = (y1 + y2) / 2;
    return '<g class="eskh-bt-maat" stroke="#374151" stroke-width="1">' +
      '<line x1="' + x + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>' +
      '<line x1="' + (x - 4) + '" y1="' + y1 + '" x2="' + (x + 4) + '" y2="' + y1 + '"/><line x1="' + (x - 4) + '" y1="' + y2 + '" x2="' + (x + 4) + '" y2="' + y2 + '"/></g>' +
      '<text x="' + (x - 5) + '" y="' + my + '" font-size="11" text-anchor="middle" fill="#111827" transform="rotate(-90 ' + (x - 5) + ' ' + my + ')">' + esc(label) + '</text>';
  }

  function isLicht(hex) {
    var h = String(hex || '').replace('#', ''); if (h.length !== 6) return true;
    return (0.299 * parseInt(h.substr(0, 2), 16) + 0.587 * parseInt(h.substr(2, 2), 16) + 0.114 * parseInt(h.substr(4, 2), 16)) > 170;
  }

  /* ---------------- snijplan met maten ----------------
     plan: uitvoer van C.snijplan (evt. gecombineerd over items).
     opts.label(stuk) -> korte tekst in het stuk; opts.kleur */
  var clipNr = 0;
  function snijplanSVG(plan, opts) {
    opts = opts || {};
    var kleur = opts.kleur || '#c9ced6';
    var W = 340, sc = W / plan.rolCm, L = plan.lengteCm;
    var maxH = 520; if (L * sc > maxH) sc = maxH / L;
    var w = plan.rolCm * sc, h = L * sc, pad = 30;
    var VW = Math.max(w + pad + 60, 330), VH = h + pad + 28;
    var o = '<svg class="eskh-bt-svg eskh-bt-plan" width="' + cm(VW) + '" height="' + cm(VH) + '" viewBox="0 0 ' + cm(VW) + ' ' + cm(VH) + '" role="img" aria-label="Snijplan met maten">';
    var x0 = pad, y0 = pad;
    o += '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" fill="#f3f4f6" stroke="#9aa1ab" stroke-dasharray="4 3"/>';
    plan.stukken.forEach(function (p) {
      var x = x0 + p.x * sc, y = y0 + p.y * sc, pw = p.w * sc, ph = p.h * sc;
      o += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, pw - 1).toFixed(1) + '" height="' + Math.max(1, ph - 1).toFixed(1) + '" fill="' + kleur + '" fill-opacity=".8" stroke="#fff"/>';
      var tc = isLicht(kleur) ? '#111827' : '#fff';
      var cid = 'eskh-bt-c' + (++clipNr);
      o += '<clipPath id="' + cid + '"><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, pw - 2).toFixed(1) + '" height="' + Math.max(1, ph - 1).toFixed(1) + '"/></clipPath><g clip-path="url(#' + cid + ')">';
      var lab = opts.label ? opts.label(p) : p.naam.replace(/ \(baan.*\)/, '');
      var baanTxt = (/\(baan ([^)]*)\)/.exec(p.naam) || [])[1];
      if (baanTxt && pw > 34 && ph > 36) o += '<text x="' + (x + 4).toFixed(1) + '" y="' + (y + 35).toFixed(1) + '" font-size="8.5" fill="' + tc + '">baan ' + esc(baanTxt) + '</text>';
      if (pw > 34 && ph > 22) {
        o += '<text x="' + (x + 4).toFixed(1) + '" y="' + (y + 12).toFixed(1) + '" font-size="10" font-weight="600" fill="' + tc + '">' + esc(lab) + '</text>' +
             '<text x="' + (x + 4).toFixed(1) + '" y="' + (y + 24).toFixed(1) + '" font-size="9" fill="' + tc + '">' + cm(p.w) + '×' + cm(p.h) + '</text>';
      } else if (pw > 14 && ph > 12) {
        o += '<text x="' + (x + 2).toFixed(1) + '" y="' + (y + 10).toFixed(1) + '" font-size="8" fill="' + tc + '">' + esc(lab) + '</text>';
      }
      o += '</g>';
    });
    o += maatlijn(x0, y0 - 12, x0 + w, y0 - 12, 'Rolbreedte ' + plan.rolCm + ' cm');
    var lx = x0 + w + 14, my = y0 + h / 2;
    o += '<g stroke="#374151" stroke-width="1"><line x1="' + lx + '" y1="' + y0 + '" x2="' + lx + '" y2="' + (y0 + h) + '"/><line x1="' + (lx - 4) + '" y1="' + y0 + '" x2="' + (lx + 4) + '" y2="' + y0 + '"/><line x1="' + (lx - 4) + '" y1="' + (y0 + h) + '" x2="' + (lx + 4) + '" y2="' + (y0 + h) + '"/></g>' +
      '<text x="' + (lx + 14) + '" y="' + my + '" font-size="11" text-anchor="middle" fill="#111827" transform="rotate(90 ' + (lx + 14) + ' ' + my + ')">' + nl(L / 100, 2) + ' m</text>';
    o += '<text x="' + x0 + '" y="' + (y0 + h + 18) + '" font-size="11" fill="#555">' + nl(L / 100, 2) + ' m nodig → ' + plan.meters + ' m besteld' + (plan.meters * 100 - L >= 1 ? ' (' + cm(plan.meters * 100 - L) + ' cm over)' : '') + '</text>';
    return o + '</svg>';
  }

  /* tabel met positie van elk stuk op de rol */
  function snijlijstHTML(plan, label) {
    var h = '<table class="eskh-bt-tabel"><thead><tr><th>Stuk</th><th>Snijmaat</th><th>Positie op de rol</th></tr></thead><tbody>';
    plan.stukken.forEach(function (p) {
      h += '<tr><td>' + esc(label ? label(p) + ((/\(baan [^)]*\)/.exec(p.naam) || [''])[0] ? ' ' + /\(baan [^)]*\)/.exec(p.naam)[0] : '') : p.naam) + '</td><td>' + cm(p.w) + ' × ' + cm(p.h) + ' cm' + (p.gedraaid ? ' <small>(gedraaid)</small>' : '') +
        '</td><td>' + cm(p.x) + ' cm vanaf de zijkant, ' + cm(p.y) + ' cm vanaf het begin</td></tr>';
    });
    return h + '</tbody></table>';
  }

  /* ---------------- werkvolgorde ---------------- */
  var BEV_STAP = {
    loxx: function (b) { return 'Sla met de holpijp (9 mm) op de afgetekende punten (in elke hoek, daartussen gelijk verdeeld) een gat in de zoom en monteer de Loxx-koppen met de montagesleutel. Zet de onderdelen op de boot op dezelfde posities.'; },
    druk: function (b) { return 'Sla met de holpijp op de afgetekende punten (in elke hoek, daartussen gelijk verdeeld) een gaatje in de zoom en zet deel A en B met de stempel vast op het stansblok. Zet deel C op de boot op dezelfde posities.'; },
    draai: function (b) { return 'Sla met de ovale holpijp op de afgetekende punten (in elke hoek, daartussen gelijk verdeeld) een gat in de zoom en zet de kous en ring met de stempel vast. Monteer de draaiers op de boot op dezelfde posities.'; },
    ring: function (b) { return 'Sla met de holpijp op de afgetekende punten (in elke hoek, daartussen gelijk verdeeld) een gat in de zoom en zet de zeilringen met de stempel vast op het stansblok. Rijg het elastisch koord door de ringen en om de haken of knoppen.'; },
    balkon: function (b) { return 'Zet op de afgetekende punten (in elke hoek, daartussen gelijk verdeeld) een zeilring in de zoom en bind het doek met elastiek en koordhaken aan de spijlen of railing.'; },
    zuignap: function (b) { return 'Zet op de afgetekende punten (in elke hoek, daartussen gelijk verdeeld) een zeilring (10 mm) in de zoom en haak er een zuignap in. Druk de zuignappen op schoon, vetvrij glas.'; },
    tunnel: function () { return 'Rijg het koord door de tunnelzoom, trek het strak en werk de uiteinden af met de koordklemmen.'; },
    klit: function () { return 'Plak het zelfklevende klittenband op een schone, droge en vetvrije ondergrond: de ene kant op het doek, de andere op het object. Druk het goed aan en laat de lijmlaag hechten voor je het belast.'; }
  };

  function werkvolgorde(item, b) {
    var st = [], x = item.extras || {};
    var baan = b.plan.stukken.some(function (p) { return p.baan; });
    if (item.module === 'zonwering') st.push('Meet het glas of de railing nog een keer na voor je gaat snijden.');
    else st.push('Controleer alle maten op het object.' + (x.mallendoek ? ' Maak eerst een mal van het mallendoek en neem de maten daarvan over.' : ' Twijfel je over vorm of welving, maak dan eerst een mal.'));
    st.push('Teken de stukken af op de achterkant van het doek (bijvoorbeeld met een glaspotlood). Houd de snijmaat aan: dat is de netto maat plus ' + cm(b.zoom) + ' cm zoom per rand.');
    st.push('Snijd de stukken recht af volgens het snijplan.' + (baan ? ' Stukken die breder zijn dan de rol bestaan uit banen: laat die bij de naad ±4 cm overlappen.' : ''));
    if (b.model.panels.length > 1) st.push('Leg de stukken op het object, zet ze met spelden of tape vast en controleer de pasvorm voor je de naden maakt.');
    var rokModel = { dekzeil: 1, blok: 1, jacuzzi: 1 }[b.def && b.def.model];
    var gedeeld = stukken(b).some(function (x) { return x.delen > 1; });
    if (rokModel && gedeeld) st.push('Zet de delen van de lange rokstroken eerst aan elkaar (zie de deelnaden in de tekening), zodat elke rokstrook weer zijn volle lengte heeft.');
    if (rokModel) st.push('Maak eerst de rok: zet de rokstroken in de hoeken aan elkaar tot één rondlopende rand. Zet daarna de rok rondom aan het bovenblad, met de naad aan de binnenkant.');
    var naden = b.model.panels.length > 1 || baan;
    var vast = item.verwerking === 'lijmen' && item.module !== 'zonwering' ? 'lijm' : 'stik';
    if (naden) {
      if (item.verwerking === 'lijmen') st.push('Ontvet de lijmranden en verlijm de naden met Saba 70T PVC-lijm. Volg de verwerkingsinstructies op de verpakking.');
      else st.push('Stik de naden met UV-bestendig garen' + (item.garen ? ' (Coats Terko M36)' : '') + ', bij voorkeur met een dubbele stiknaad.');
    } else if (item.verwerking === 'lijmen' && item.module !== 'zonwering') {
      st.push('Ontvet de randen waar de zoom komt; lijm de zoom met Saba 70T PVC-lijm. Volg de verwerkingsinstructies op de verpakking.');
    }
    if (item.module === 'zonwering') st.push('Sla rondom een zoom van ' + cm(b.zoom) + ' cm om en stik hem vast met UV-bestendig garen' + (item.garen ? ' (Coats Terko M36)' : '') + ', zodat de zeilringen in twee lagen doek komen. Niet lijmen: lijm laat in de zon los.');
    else if (item.bevestiging === 'tunnel') st.push('Vouw de onderrand om tot een tunnelzoom (' + cm(b.zoom) + ' cm) en ' + vast + ' hem dicht. Laat een opening om het koord in te rijgen.');
    else st.push('Vouw de zoom rondom om (' + cm(b.zoom) + ' cm) en ' + vast + ' hem vast' + (vast === 'stik' && !naden ? ' met UV-bestendig garen' : '') + '.');
    if (x.raamfolie && x.raamfolie.breedte > 0) st.push('Snijd de ramen uit het doek, zet de raamfolie vast met dubbelzijdig tape en stik of lijm hem rondom.');
    if (x.ritsen && x.ritsen.length) st.push(item.vorm === 'buiskap'
      ? 'Zet de ritsen over de kap: elke rits loopt van de onderkant van een zijkant over het dak tot het midden, waar de twee ritsen samenkomen.'
      : 'Zet de ritsen in op de plek van de deur of het oprolbare deel.');
    if (BEV_STAP[item.bevestiging]) st.push(BEV_STAP[item.bevestiging](b));
    if (x.trekband && x.trekband.sets > 0) st.push('Zet de trekbandjes met klemgesp vast en span het doek gelijkmatig aan.');
    st.push('Pas het geheel en span het aan. Controleer na de eerste keer gebruik of alles nog strak zit.');
    return st;
  }

  /* ---------------- complete bouwtekening voor één item ---------------- */
  function html(item, b, opts) {
    opts = opts || {};
    var kleur = (b.dk && b.dk.kleur.hex) || '#c9ced6';
    var lijst = stukken(b);
    var bev = bevestigingPerStuk(b, lijst);
    var h = '<div class="eskh-bt">';
    h += '<p class="eskh-bt-disclaimer"><strong>Let op:</strong> ' + esc(DISCLAIMER) + '</p>';
    h += '<h5>Stukken</h5><table class="eskh-bt-tabel"><thead><tr><th>#</th><th>Stuk</th><th>Aantal</th><th>Netto maat</th><th>Snijmaat</th></tr></thead><tbody>';
    lijst.forEach(function (s) {
      h += '<tr><td>' + s.nr + '</td><td>' + esc(s.naam) + (s.noot ? '<br><small>' + esc(s.noot) + '</small>' : '') + '</td><td>' + s.qty + '</td><td>' + cm(s.nettoW) + ' × ' + cm(s.nettoH) + ' cm</td><td>' + (s.delen > 1 ? s.delen + ' delen van ' : '') + cm(s.snijW) + ' × ' + cm(s.snijH) + ' cm' + (s.banen && s.banen.n > 1 ? ' <small>(' + s.banen.n + ' banen)</small>' : '') + '</td></tr>';
    });
    h += '</tbody></table>';
    var bevTxt = '';
    var gedeeld = lijst.length > 1 && b.model.rand && b.model.rand.type !== 'cirkel';
    if (b.punten) bevTxt = b.punten + ' bevestigingspunten (rode stippen): één in elke hoek, daartussen gelijk verdeeld met maximaal ±' + b.afstand + ' cm.' +
      (gedeeld ? ' Een hoekpunt wordt gedeeld door de twee stukken die daar samenkomen.' : '') + ' Posities gemeten langs de afgewerkte rand, vanaf de hoek.' +
      ((item.module === 'zonwering' || item.verwerking !== 'lijmen') && b.model.rand && b.model.rand.rondom ? ' Blauwe stippellijn = stiklijn van de zoom.' : '');
    else if (item.bevestiging === 'tunnel') bevTxt = 'Tunnelzoom met koord langs de rode lijn.';
    else if (item.bevestiging === 'klit') bevTxt = 'Zelfklevend klittenband langs de rode lijn.';
    h += '<h5>Tekening per stuk</h5>' + (bevTxt ? '<p class="eskh-bt-note">' + esc(bevTxt) + ' Maten in cm; gestippeld = snijmaat, doorgetrokken = netto maat.</p>' : '');
    h += '<div class="eskh-bt-stukken">';
    lijst.forEach(function (s) {
      var cap = b.punten ? bevestigingTekst(bev[s.nr]) : '';
      if (s.banen && s.banen.n > 1) {
        var richt = s.banen.richting === 'w' ? 'vanaf de linkerkant' : 'vanaf de bovenkant';
        cap = 'Breder dan de rol: ' + s.banen.n + ' banen van ' + cm(s.banen.breedte) + ' cm breed (snijmaat), naad op ' +
          s.banen.naadPos.map(function (x) { return cm(x - s.zoom); }).join(' · ') + ' cm ' + richt + ' van de afgewerkte maat (stippellijn), 4 cm overlap.' + (cap ? '<br>' + cap : '');
      }
      if (s.delen > 1) {
        var naden = []; for (var d = 1; d < s.delen; d++) naden.push(cm(s.nettoW * d / s.delen));
        cap = 'Uit ' + s.delen + ' gelijke delen van ' + cm(s.deelNetto) + ' cm, deelnaden op ' + naden.join(' · ') + ' cm (stippellijn).' + (cap ? '<br>' + cap : '');
      }
      h += '<figure>' + stukSVG(s, bev[s.nr], item, b, kleur) + (cap ? '<figcaption>' + cap + '</figcaption>' : '') + '</figure>';
    });
    h += '</div>';
    if (opts.snijplan !== false) {
      h += '<h5>Snijplan</h5>' + snijplanSVG(b.plan, { kleur: kleur }) + snijlijstHTML(b.plan);
    }
    h += '<h5>Werkvolgorde</h5><ol class="eskh-bt-stappen">' + werkvolgorde(item, b).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    return h + '</div>';
  }

  return { DISCLAIMER: DISCLAIMER, stukken: stukken, bevestigingPerStuk: bevestigingPerStuk, stukSVG: stukSVG,
           snijplanSVG: snijplanSVG, snijlijstHTML: snijlijstHTML, werkvolgorde: werkvolgorde, html: html };
});
