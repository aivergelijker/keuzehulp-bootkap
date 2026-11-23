/* =====================================================================
   eSails Keuzehulp — CORE (pure rekenlogica, geen DOM)
   ---------------------------------------------------------------------
   Draait zowel in de browser als in Node (tests). Alle maten in cm,
   alle doekhoeveelheden in hele strekkende meters (eSails verkoopt per
   hele meter).
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EsailsCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var R = {
    zoomCm: 5,          // naad/zoomtoeslag per rand
    naadOverlapCm: 4,   // overlap als een paneel uit meerdere banen bestaat
    snijMargeCm: 0      // geen extra marge: de zoom rondom elk stuk is al de speling
  };

  function ceil(n) { return Math.ceil(n - 1e-9); }
  function num(v, min, max) {
    var n = parseFloat(String(v).replace(',', '.'));
    if (!isFinite(n)) n = min;
    if (n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  }

  /* ---------------------------------------------------------------
     SNIJPLAN
     panels: [{ naam, w, h, qty }]  (netto maten in cm, zonder zoom)
     rolCm : doekbreedte
     Geeft { lengteCm, meters, stukken:[{naam,x,y,w,h}], banen } terug.
     Algoritme: panelen > rolbreedte worden in banen gesplitst (met
     naadoverlap), daarna shelf-packing (first-fit decreasing) met
     rotatie. Altijd >= ondergrens op oppervlakte.
     --------------------------------------------------------------- */
  function snijplan(panels, rolCm, opts) {
    opts = opts || {};
    var zoom = opts.zoomCm != null ? opts.zoomCm : R.zoomCm;
    var overlap = R.naadOverlapCm;
    var pieces = [];
    var naden = 0; // extra naadlengte in cm (voor lijm/garen)

    var nuttig = rolCm - overlap;
    /* Stukken maken. Panelen die in beide richtingen breder zijn dan de rol
       worden in banen gesplitst die langs de lange zijde lopen (minste naden).
       mode 'gelijk': alle banen even breed (naden symmetrisch);
       mode 'vol'   : volle rolbreedtes + een reststrook (laat soms ruimte over
                      waar andere stukken naast passen). We nemen het zuinigste;
                      bij gelijke lengte de symmetrische variant. */
    function moetSplitsen(p) {
      var z = p.zoomCm != null ? p.zoomCm : zoom;
      return Math.min(p.w + 2 * z, p.h + 2 * z + (p.extraH || 0)) > rolCm;
    }
    function maakStukken(modes) {
      var pieces = [], naden = 0;
      panels.forEach(function (p, pi) {
        var mode = (modes && modes[pi]) || 'gelijk';
        var q = p.qty || 1;
        var z = p.zoomCm != null ? p.zoomCm : zoom; // zoom per paneel (bijv. tunnelzoom per item)
        for (var k = 0; k < q; k++) {
          var w = p.w + 2 * z, h = p.h + 2 * z + (p.extraH || 0); // extraH: bijv. koordtunnel alleen aan de onderrand
          var meta = { item: p.item, nettoW: p.w, nettoH: p.h, zoomCm: z };
          if (Math.min(w, h) <= rolCm) {
            pieces.push(Object.assign({ naam: p.naam, w: w, h: h }, meta));
            continue;
          }
          // Banen altijd in de lengte: ze lopen langs de lange zijde van het stuk,
          // zodat er zo min mogelijk banen en naden zijn (ook als dwars minder doek zou kosten).
          var dwars = Math.min(w, h);               // maat die over de banen verdeeld wordt
          var lang = dwars === w ? h : w;
          var n = ceil((dwars - overlap) / nuttig);
          var breedtes = [], starts = [], i;
          if (mode === 'gelijk') {
            var bw = (dwars + (n - 1) * overlap) / n;
            for (i = 0; i < n; i++) { breedtes.push(bw); starts.push(i * (bw - overlap)); }
          } else {
            var rest = dwars - (n - 1) * nuttig;
            for (i = 0; i < n; i++) { breedtes.push(i < n - 1 ? rolCm : Math.max(rest, overlap * 2)); starts.push(i * nuttig); }
          }
          var naadPos = starts.slice(1).map(function (st) { return st + overlap / 2; }); // midden van de overlap, in snijmaat
          for (i = 0; i < n; i++) {
            pieces.push(Object.assign({ naam: p.naam + ' (baan ' + (i + 1) + '/' + n + ')', w: breedtes[i], h: lang, vast: true, baan: true,
              baanRichting: dwars === w ? 'w' : 'h', naadPos: naadPos }, meta));
          }
          naden += (n - 1) * lang;
        }
      });
      return { pieces: pieces, naden: naden };
    }

    // Per gesplitst paneel apart kiezen tussen gelijke banen en volle banen + reststrook
    // (alle combinaties bij maximaal 4 van zulke panelen), en per combinatie twee
    // inpasmethodes proberen: planken (shelf) en vrije ruimtes (MaxRects, vult gaten
    // naast grote stukken). Het kortste plan wint; bij gelijke lengte de eerste
    // (symmetrische banen, planken).
    var splitIdx = [];
    panels.forEach(function (p, pi) { if (moetSplitsen(p)) splitIdx.push(pi); });
    var combos = [];
    if (splitIdx.length <= 4) {
      for (var mask = 0; mask < (1 << splitIdx.length); mask++) {
        var modes = {};
        splitIdx.forEach(function (pi, k) { modes[pi] = (mask >> k) & 1 ? 'vol' : 'gelijk'; });
        combos.push(modes);
      }
    } else {
      combos.push({}, splitIdx.reduce(function (m, pi) { m[pi] = 'vol'; return m; }, {}));
    }
    var best = null, bestNaden = 0;
    combos.forEach(function (modes) {
      var st = maakStukken(modes);
      [0, 1, 2].forEach(function (strat) {
        var res = pakShelves(st.pieces, rolCm, strat);
        if (!best || res.y < best.y - 1e-9) { best = res; bestNaden = st.naden; }
      });
      [0, 1, 2, 3].forEach(function (orde) {
        var res = pakVrij(st.pieces, rolCm, orde);
        if (!best || res.y < best.y - 1e-9) { best = res; bestNaden = st.naden; }
      });
    });
    var naden = bestNaden;

    var lengte = best.y > 0 ? best.y + R.snijMargeCm : 0;
    return {
      lengteCm: lengte,
      meters: lengte > 0 ? ceil(lengte / 100) : 0,
      rolCm: rolCm,
      stukken: best.placed,
      extraNaadCm: naden
    };
  }

  /* Inpassen in vrije ruimtes (MaxRects, "laagste bovenrand eerst"):
     de rol is een strook van rolCm breed; elk stuk gaat op de plek waar zijn
     bovenkant zo laag mogelijk uitkomt (dus ook in een gat naast een groot paneel).
     orde 0: langste zijde, 1: oppervlak, 2: breedte, 3: hoogte (allemaal aflopend). */
  function pakVrij(src, rolCm, orde) {
    var pieces = src.slice();
    var sleutel = [
      function (p) { return Math.max(p.w, p.h); },
      function (p) { return p.w * p.h; },
      function (p) { return Math.min(p.w, p.h); },
      function (p) { return p.h; }
    ][orde];
    pieces.sort(function (a, b) { return sleutel(b) - sleutel(a) || b.w * b.h - a.w * a.h; });
    var BIG = 1e7, vrij = [{ x: 0, y: 0, w: rolCm, h: BIG }], placed = [], top = 0;
    pieces.forEach(function (s) {
      var opties = [[s.w, s.h]];
      if (!s.vast && s.w !== s.h) opties.push([s.h, s.w]);
      var keus = null;
      opties.forEach(function (o) {
        var w = o[0], h = o[1];
        if (w > rolCm + 1e-9) return;
        vrij.forEach(function (f) {
          if (w <= f.w + 1e-9 && h <= f.h + 1e-9) {
            var boven = f.y + h;
            if (!keus || boven < keus.boven - 1e-9 || (Math.abs(boven - keus.boven) < 1e-9 && (f.y < keus.y - 1e-9 || (Math.abs(f.y - keus.y) < 1e-9 && f.x < keus.x)))) {
              keus = { x: f.x, y: f.y, w: w, h: h, boven: boven };
            }
          }
        });
      });
      var r = keus;
      placed.push(stukVrij(s, r.x, r.y, r.w, r.h));
      top = Math.max(top, r.y + r.h);
      // vrije ruimtes opsplitsen rond het geplaatste stuk
      var nieuw = [];
      vrij.forEach(function (f) {
        if (r.x >= f.x + f.w - 1e-9 || r.x + r.w <= f.x + 1e-9 || r.y >= f.y + f.h - 1e-9 || r.y + r.h <= f.y + 1e-9) { nieuw.push(f); return; }
        if (r.x > f.x + 1e-9) nieuw.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
        if (r.x + r.w < f.x + f.w - 1e-9) nieuw.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
        if (r.y > f.y + 1e-9) nieuw.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
        if (r.y + r.h < f.y + f.h - 1e-9) nieuw.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
      });
      // ruimtes die helemaal in een andere liggen weghalen
      vrij = nieuw.filter(function (a, i) {
        return !nieuw.some(function (b, j) {
          return i !== j && a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 && a.x + a.w <= b.x + b.w + 1e-9 && a.y + a.h <= b.y + b.h + 1e-9 && (j < i || a.w * a.h < b.w * b.h);
        });
      });
    });
    return { y: top, placed: placed };
  }
  function stukVrij(s, x, y, w, h) {
    return { naam: s.naam, x: x, y: y, w: w, h: h, item: s.item, nettoW: s.nettoW, nettoH: s.nettoH, zoomCm: s.zoomCm, baan: !!s.baan,
             baanRichting: s.baanRichting, naadPos: s.naadPos,
             gedraaid: !s.baan && s.nettoW != null && Math.abs(w - 2 * s.zoomCm - s.nettoW) > 0.5 };
  }

  /* Shelf-packing met kolommen: elke plank (shelf) heeft de hoogte van
     zijn eerste stuk; daarbinnen worden stukken in kolommen gestapeld.
     strat 0: lange zijde dwars, sorteer op lengte
     strat 1: korte zijde dwars, sorteer op lengte
     strat 2: lange zijde dwars, sorteer op oppervlak */
  function pakShelves(src, rolCm, strat) {
    var pieces = src.map(function (s) {
      var w = s.w, h = s.h;
      if (!s.vast) {
        var big = Math.max(w, h), small = Math.min(w, h);
        if (strat !== 1 && big <= rolCm) { w = big; h = small; } else { w = small; h = big; }
      }
      return Object.assign({}, s, { w: w, h: h });
    });
    pieces.sort(strat === 2
      ? function (p, q) { return q.w * q.h - p.w * p.h; }
      : function (p, q) { return q.h - p.h || q.w - p.w; });

    var shelves = [], y = 0, placed = [];
    function plaats(s) {
      for (var i = 0; i < shelves.length; i++) {
        var sh = shelves[i];
        var opties = [[s.w, s.h]];
        if (!s.vast && s.w !== s.h) opties.push([s.h, s.w]);
        for (var o = 0; o < opties.length; o++) {
          var w = opties[o][0], h = opties[o][1];
          if (w > rolCm + 1e-9 || h > sh.h + 1e-9) continue;
          // bestaande kolom met restruimte eronder
          for (var c = 0; c < sh.cols.length; c++) {
            var col = sh.cols[c];
            if (w <= col.w + 1e-9 && col.used + h <= sh.h + 1e-9) {
              placed.push(stuk(s, col.x, sh.y + col.used, w, h));
              col.used += h; return;
            }
          }
          // nieuwe kolom naast de bestaande
          if (sh.usedW + w <= rolCm + 1e-9) {
            sh.cols.push({ x: sh.usedW, w: w, used: h });
            placed.push(stuk(s, sh.usedW, sh.y, w, h));
            sh.usedW += w; return;
          }
        }
      }
      var nieuw = { y: y, h: s.h, usedW: s.w, cols: [{ x: 0, w: s.w, used: s.h }] };
      shelves.push(nieuw);
      placed.push(stuk(s, 0, y, s.w, s.h));
      y += s.h;
    }
    function stuk(s, x, yy, w, h) {
      return { naam: s.naam, x: x, y: yy, w: w, h: h, item: s.item, nettoW: s.nettoW, nettoH: s.nettoH, zoomCm: s.zoomCm, baan: !!s.baan,
               baanRichting: s.baanRichting, naadPos: s.naadPos, gedraaid: !s.baan && s.nettoW != null && Math.abs(w - 2 * s.zoomCm - s.nettoW) > 0.5 };
    }
    pieces.forEach(plaats);
    return { y: y, placed: placed };
  }

  /* ---------------------------------------------------------------
     Bevestigingspunten langs een rand
     --------------------------------------------------------------- */
  function puntenLangs(randCm, afstandCm) {
    if (randCm <= 0) return 0;
    return ceil(randCm / afstandCm) + 1;
  }
  /* gesloten omtrek: geen extra eindpunt */
  function puntenRondom(omtrekCm, afstandCm) {
    if (omtrekCm <= 0) return 0;
    return Math.max(4, ceil(omtrekCm / afstandCm));
  }

  /* ---------------------------------------------------------------
     MODELLEN — elk model zet input om in:
       panels      : stukken doek (netto cm)
       randCm      : lengte van de rand waar bevestigers komen
       gesloten    : rand is rondlopend (omtrek)
       zoomCm      : totale zoomlengte (voor tunnel/klittenband/zoomband)
       oppervlakM2 : netto oppervlak (info + mallendoek)
     --------------------------------------------------------------- */
  /* ---------------------------------------------------------------
     BEVESTIGINGSPLAN — hoeken eerst
     Elke hoek krijgt een bevestiger. De ruimte tussen twee hoeken wordt
     in gelijke vakken verdeeld: net zoveel dat een vak niet (veel) groter
     wordt dan de gekozen afstand (max. 10% speling). Zo staan de punten
     recht op elke zijde en vanzelf symmetrisch.
       rand.type: 'lus'    gesloten rondom (hoeken gedeeld)
                  'lijn'   open rand (begin- en eindpunt extra)
                  'cirkel' rond, geen hoeken: gelijk verdeeld
     --------------------------------------------------------------- */
  var SPELING = 1.1;
  function z(lengte, paneel) { return { lengte: lengte, paneel: paneel }; }
  function rechthoek(w, h, paneel) {
    return { type: 'lus', rondom: true, zijden: [z(w, paneel), z(h, paneel), z(w, paneel), z(h, paneel)] };
  }
  function verdeelZijde(lengte, afstand) {
    var n = Math.max(1, ceil(lengte / (afstand * SPELING)));
    var pos = [];
    for (var i = 0; i <= n; i++) pos.push(Math.round(lengte * i / n));
    return { lengte: lengte, vakken: n, tussen: lengte / n, posities: pos };
  }
  function puntenPlan(rand, afstand) {
    if (!rand || !(afstand > 0)) return { totaal: 0, zijden: [] };
    if (rand.type === 'cirkel') {
      var omtrek = rand.zijden[0].lengte;
      var n = Math.max(4, ceil(omtrek / (afstand * SPELING)));
      var pos = []; for (var i = 0; i < n; i++) pos.push(Math.round(omtrek * i / n));
      return { type: 'cirkel', totaal: n, zijden: [{ paneel: rand.zijden[0].paneel, lengte: omtrek, vakken: n, tussen: omtrek / n, posities: pos }] };
    }
    var zijden = rand.zijden.map(function (zz) { var v = verdeelZijde(zz.lengte, afstand); v.paneel = zz.paneel; return v; });
    var vakken = zijden.reduce(function (t, v) { return t + v.vakken; }, 0);
    return { type: rand.type, rondom: !!rand.rondom, totaal: rand.type === 'lus' ? vakken : vakken + 1, zijden: zijden };
  }

  var MODELLEN = {
    /* Buiskap / achtertent: dak + 2 zijkanten + voorkant (+ achterkant) */
    buiskap: function (i) {
      var L = num(i.lengte, 50, 800), B = num(i.breedte, 50, 500), H = num(i.hoogte, 30, 250);
      var dak = L * 1.1; // welving over de beugels
      // Schuine voorkant (optioneel): de voorkant wordt gemeten langs de schuinte,
      // van dek tot dak. Zonder die maat rekenen we met een rechte voorkant (= hoogte).
      var V = i.voorkantSchuin ? Math.max(H, num(i.voorkantLengte || H, 30, 400)) : H;
      var panels = [
        { naam: 'Dak', w: dak, h: B, noot: 'Incl. 10% extra lengte voor de welving van het dak.' },
        { naam: 'Zijkant', w: L, h: H, qty: 2 },
        { naam: 'Voorkant', w: B, h: V, noot: V > H ? 'Hoogte langs de schuinte gemeten (' + Math.round(V) + ' cm).' : null }
      ];
      if (i.achterkant) panels.push({ naam: 'Achterkant', w: B, h: H });
      var rand = 2 * L + B + (i.achterkant ? B : 0);
      var zijden = [z(L, 'Zijkant'), z(B, 'Voorkant'), z(L, 'Zijkant')];
      if (i.achterkant) zijden.push(z(B, 'Achterkant'));
      return { panels: panels, randCm: rand, gesloten: false, zoomCm: rand, oppervlakM2: oppervlak(panels),
               rand: { type: i.achterkant ? 'lus' : 'lijn', zijden: zijden } };
    },
    /* Bimini / zonnedek: één dakpaneel */
    bimini: function (i) {
      var L = num(i.lengte, 50, 600), B = num(i.breedte, 50, 400);
      var panels = [{ naam: 'Bimini-dak', w: L * 1.1, h: B, noot: 'Incl. 10% extra lengte voor de welving van het dak.' }];
      var rand = 2 * (L * 1.1 + B);
      return { panels: panels, randCm: rand, gesloten: true, zoomCm: rand, oppervlakM2: oppervlak(panels), rand: rechthoek(L * 1.1, B, 'Bimini-dak') };
    },
    /* Plat zeil (dekzeil, winterkleed, plat afdekzeil) met overhang rondom */
    plat: function (i) {
      var L = num(i.lengte, 30, 2000), B = num(i.breedte, 30, 1000), o = num(i.overhang || 0, 0, 100);
      var w = L + 2 * o, h = B + 2 * o;
      var panels = [{ naam: 'Zeil', w: w, h: h }];
      var rand = 2 * (w + h);
      return { panels: panels, randCm: rand, gesloten: true, zoomCm: rand, oppervlakM2: oppervlak(panels), rand: rechthoek(w, h, 'Zeil') };
    },
    /* Dekzeil / winterkleed: bovenblad over de boot met een rok die over de
       rand naar beneden valt. Vier losse rokstroken, in de hoeken aan elkaar
       genaaid en daarna aan het bovenblad. Bevestigers in de onderrand van de rok. */
    dekzeil: function (i) {
      var L = num(i.lengte, 100, 2000), B = num(i.breedte, 50, 800), H = num(i.hoogte, 5, 150);
      var panels = [
        { naam: 'Bovenblad', w: L, h: B },
        { naam: 'Rok lang', w: L, h: H, qty: 2 },
        { naam: 'Rok kort', w: B, h: H, qty: 2 }
      ];
      var onder = 2 * (L + B);
      return { panels: panels, randCm: onder, gesloten: true, zoomCm: onder, naadCm: onder + 4 * H, oppervlakM2: oppervlak(panels),
               rand: { type: 'lus', zijden: [z(L, 'Rok lang'), z(B, 'Rok kort'), z(L, 'Rok lang'), z(B, 'Rok kort')] } };
    },
    /* Blokvormige hoes (bank, loungeset, tafel, kist) met rok tot hoogte H */
    blok: function (i) {
      var L = num(i.lengte, 20, 600), B = num(i.breedte, 20, 400), H = num(i.hoogte, 5, 250);
      var panels = [
        { naam: 'Bovenkant', w: L, h: B },
        { naam: 'Zijkant lang', w: L, h: H, qty: 2 },
        { naam: 'Zijkant kort', w: B, h: H, qty: 2 }
      ];
      var onder = 2 * (L + B);
      return { panels: panels, randCm: onder, gesloten: true, zoomCm: onder, naadCm: onder + 4 * H, oppervlakM2: oppervlak(panels),
               rand: { type: 'lus', zijden: [z(L, 'Zijkant lang'), z(B, 'Zijkant kort'), z(L, 'Zijkant lang'), z(B, 'Zijkant kort')] } };
    },
    /* Ronde hoes (bbq, ronde tafel, parasolvoet): rond bovenblad + strook */
    rond: function (i) {
      var D = num(i.diameter, 20, 400), H = num(i.hoogte, 5, 200);
      var omtrek = Math.PI * D;
      var panels = [
        { naam: 'Bovenblad (rond)', w: D, h: D },
        { naam: 'Rondom-strook', w: omtrek, h: H } // de zoom aan beide uiteinden is de naad
      ];
      return { panels: panels, randCm: omtrek, gesloten: true, zoomCm: omtrek, naadCm: omtrek + H, oppervlakM2: (Math.PI * D * D / 4 + omtrek * H) / 10000,
               rand: { type: 'cirkel', zijden: [z(omtrek, 'Rondom-strook')] } };
    },
    /* Jacuzzi / hottub: afgeronde hoeken + rok */
    jacuzzi: function (i) {
      var L = num(i.lengte, 100, 400), B = num(i.breedte, 100, 400), Rr = num(i.radius || 0, 0, 80), H = num(i.hoogte || 20, 5, 60);
      Rr = Math.min(Rr, L / 2, B / 2);
      var omtrek = 2 * (L + B) - 8 * Rr + 2 * Math.PI * Rr;
      var panels = [
        { naam: 'Bovenkant', w: L, h: B },
        { naam: 'Rok (per zijde)', w: omtrek / 4, h: H, qty: 4 } // de zoom aan de uiteinden is de naad
      ];
      var zijde = omtrek / 4;
      return { panels: panels, randCm: omtrek, gesloten: true, zoomCm: omtrek, naadCm: omtrek + 4 * H, oppervlakM2: ((L * B - 4 * Rr * Rr + Math.PI * Rr * Rr) + omtrek * H) / 10000,
               rand: { type: 'lus', zijden: [z(zijde, 'Rok (per zijde)'), z(zijde, 'Rok (per zijde)'), z(zijde, 'Rok (per zijde)'), z(zijde, 'Rok (per zijde)')] } };
    },
    /* Zonwering / schaduwdoek voor raam of balkon */
    zonwering: function (i) {
      var B = num(i.breedte, 20, 600), H = num(i.hoogte, 20, 400);
      var panels = [{ naam: 'Zonwering', w: B, h: H }];
      var rand = 2 * (B + H);
      return { panels: panels, randCm: rand, gesloten: true, zoomCm: rand, oppervlakM2: B * H / 10000, breedte: B, hoogte: H, rand: rechthoek(B, H, 'Zonwering') };
    }
  };

  function oppervlak(panels) {
    return panels.reduce(function (s, p) { return s + p.w * p.h * (p.qty || 1); }, 0) / 10000;
  }

  /* ---------------------------------------------------------------
     Hulpfuncties voor verbruik
     --------------------------------------------------------------- */
  function meters(cm, marge) { return cm <= 0 ? 0 : ceil((cm * (marge || 1)) / 100); }

  /* Saba lijm: ~350 g/m² over een naad van 4 cm breed */
  function lijmGram(naadCm) { return (naadCm * 4 / 10000) * 350; }

  function money(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ','); }

  return {
    R: R,
    num: num,
    snijplan: snijplan,
    MODELLEN: MODELLEN,
    puntenLangs: puntenLangs,
    puntenPlan: puntenPlan,
    puntenRondom: puntenRondom,
    meters: meters,
    lijmGram: lijmGram,
    money: money
  };
});
