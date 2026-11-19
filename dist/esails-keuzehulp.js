/*! eSails Keuzehulp v3.0.0 \u2014 gebouwd 2026-11-19T15:24:19.020Z \u2014 bron: src/ (niet in dit bestand wijzigen) */
;
/* =====================================================================
   eSails Keuzehulp \u2014 CORE (pure rekenlogica, geen DOM)
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
    snijMargeCm: 10     // marge op de totale rollengte (rechtsnijden)
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
    panels.forEach(function (p) {
      var q = p.qty || 1;
      for (var k = 0; k < q; k++) {
        var w = p.w + 2 * zoom, h = p.h + 2 * zoom;
        if (Math.min(w, h) <= rolCm) {
          pieces.push({ naam: p.naam, w: w, h: h });
        } else {
          // breder dan de rol in beide richtingen: splits in banen. Kies de
          // richting die de minste rollengte kost (n banen x baanlengte).
          var nW = ceil((w - overlap) / nuttig), nH = ceil((h - overlap) / nuttig);
          var dwars = (nW * h <= nH * w) ? w : h;     // maat die over de banen verdeeld wordt
          var lang = dwars === w ? h : w;
          var n = dwars === w ? nW : nH;
          var rest = dwars - (n - 1) * nuttig;
          for (var i = 0; i < n; i++) {
            pieces.push({ naam: p.naam + ' (baan ' + (i + 1) + '/' + n + ')', w: i < n - 1 ? rolCm : Math.max(rest, overlap * 2), h: lang, vast: true });
          }
          naden += (n - 1) * lang;
        }
      }
    });

    // Probeer meerdere volgordes/ori\u00ebntaties en neem het kortste plan.
    var best = null;
    [0, 1, 2].forEach(function (strat) {
      var res = pakShelves(pieces, rolCm, strat);
      if (!best || res.y < best.y) best = res;
    });

    var lengte = best.y > 0 ? best.y + R.snijMargeCm : 0;
    return {
      lengteCm: lengte,
      meters: lengte > 0 ? ceil(lengte / 100) : 0,
      rolCm: rolCm,
      stukken: best.placed,
      extraNaadCm: naden
    };
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
      return { naam: s.naam, w: w, h: h, vast: s.vast };
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
              placed.push({ naam: s.naam, x: col.x, y: sh.y + col.used, w: w, h: h });
              col.used += h; return;
            }
          }
          // nieuwe kolom naast de bestaande
          if (sh.usedW + w <= rolCm + 1e-9) {
            sh.cols.push({ x: sh.usedW, w: w, used: h });
            placed.push({ naam: s.naam, x: sh.usedW, y: sh.y, w: w, h: h });
            sh.usedW += w; return;
          }
        }
      }
      var nieuw = { y: y, h: s.h, usedW: s.w, cols: [{ x: 0, w: s.w, used: s.h }] };
      shelves.push(nieuw);
      placed.push({ naam: s.naam, x: 0, y: y, w: s.w, h: s.h });
      y += s.h;
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
     MODELLEN \u2014 elk model zet input om in:
       panels      : stukken doek (netto cm)
       randCm      : lengte van de rand waar bevestigers komen
       gesloten    : rand is rondlopend (omtrek)
       zoomCm      : totale zoomlengte (voor tunnel/klittenband/zoomband)
       oppervlakM2 : netto oppervlak (info + mallendoek)
     --------------------------------------------------------------- */
  var MODELLEN = {
    /* Buiskap / achtertent: dak + 2 zijkanten + voorkant (+ achterkant) */
    buiskap: function (i) {
      var L = num(i.lengte, 50, 800), B = num(i.breedte, 50, 500), H = num(i.hoogte, 30, 250);
      var dak = L * 1.1; // welving over de beugels
      var panels = [
        { naam: 'Dak', w: dak, h: B },
        { naam: 'Zijkant', w: L, h: H, qty: 2 },
        { naam: 'Voorkant', w: B, h: H }
      ];
      if (i.achterkant) panels.push({ naam: 'Achterkant', w: B, h: H });
      var rand = 2 * L + B + (i.achterkant ? B : 0);
      return { panels: panels, randCm: rand, gesloten: false, zoomCm: rand, oppervlakM2: oppervlak(panels) };
    },
    /* Bimini / zonnedek: \u00e9\u00e9n dakpaneel */
    bimini: function (i) {
      var L = num(i.lengte, 50, 600), B = num(i.breedte, 50, 400);
      var panels = [{ naam: 'Bimini-dak', w: L * 1.1, h: B }];
      var rand = 2 * (L * 1.1 + B);
      return { panels: panels, randCm: rand, gesloten: true, zoomCm: rand, oppervlakM2: oppervlak(panels) };
    },
    /* Plat zeil (dekzeil, winterkleed, plat afdekzeil) met overhang rondom */
    plat: function (i) {
      var L = num(i.lengte, 30, 2000), B = num(i.breedte, 30, 1000), o = num(i.overhang || 0, 0, 100);
      var w = L + 2 * o, h = B + 2 * o;
      var panels = [{ naam: 'Zeil', w: w, h: h }];
      var rand = 2 * (w + h);
      return { panels: panels, randCm: rand, gesloten: true, zoomCm: rand, oppervlakM2: oppervlak(panels) };
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
      return { panels: panels, randCm: onder, gesloten: true, zoomCm: onder, naadCm: onder + 4 * H, oppervlakM2: oppervlak(panels) };
    },
    /* Ronde hoes (bbq, ronde tafel, parasolvoet): rond bovenblad + strook */
    rond: function (i) {
      var D = num(i.diameter, 20, 400), H = num(i.hoogte, 5, 200);
      var omtrek = Math.PI * D;
      var panels = [
        { naam: 'Bovenblad (rond)', w: D, h: D },
        { naam: 'Rondom-strook', w: omtrek + 4, h: H }
      ];
      return { panels: panels, randCm: omtrek, gesloten: true, zoomCm: omtrek, naadCm: omtrek + H, oppervlakM2: (Math.PI * D * D / 4 + omtrek * H) / 10000 };
    },
    /* Jacuzzi / hottub: afgeronde hoeken + rok */
    jacuzzi: function (i) {
      var L = num(i.lengte, 100, 400), B = num(i.breedte, 100, 400), Rr = num(i.radius || 0, 0, 80), H = num(i.hoogte || 20, 5, 60);
      Rr = Math.min(Rr, L / 2, B / 2);
      var omtrek = 2 * (L + B) - 8 * Rr + 2 * Math.PI * Rr;
      var panels = [
        { naam: 'Bovenkant', w: L, h: B },
        { naam: 'Rok (per zijde)', w: omtrek / 4 + 4, h: H, qty: 4 }
      ];
      return { panels: panels, randCm: omtrek, gesloten: true, zoomCm: omtrek, naadCm: omtrek + 4 * H, oppervlakM2: ((L * B - 4 * Rr * Rr + Math.PI * Rr * Rr) + omtrek * H) / 10000 };
    },
    /* Zonwering / schaduwdoek voor raam of balkon */
    zonwering: function (i) {
      var B = num(i.breedte, 20, 600), H = num(i.hoogte, 20, 400);
      var panels = [{ naam: 'Zonwering', w: B, h: H }];
      var rand = 2 * (B + H);
      return { panels: panels, randCm: rand, gesloten: true, zoomCm: rand, oppervlakM2: B * H / 10000, breedte: B, hoogte: H };
    }
  };

  function oppervlak(panels) {
    return panels.reduce(function (s, p) { return s + p.w * p.h * (p.qty || 1); }, 0) / 10000;
  }

  /* ---------------------------------------------------------------
     Hulpfuncties voor verbruik
     --------------------------------------------------------------- */
  function meters(cm, marge) { return cm <= 0 ? 0 : ceil((cm * (marge || 1)) / 100); }

  /* Saba lijm: ~350 g/m\u00b2 over een naad van 4 cm breed */
  function lijmGram(naadCm) { return (naadCm * 4 / 10000) * 350; }

  function money(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ','); }

  return {
    R: R,
    num: num,
    snijplan: snijplan,
    MODELLEN: MODELLEN,
    puntenLangs: puntenLangs,
    puntenRondom: puntenRondom,
    meters: meters,
    lijmGram: lijmGram,
    money: money
  };
});

;
/* AUTOMATISCH GEGENEREERD door tools/build_catalog.py \u2014 niet met de hand wijzigen.
   Prijzen zijn alleen fallback: de tool haalt live prijs + voorraad op uit de shop. */
(function (root, factory) {
  var c = factory();
  if (typeof module === "object" && module.exports) module.exports = c;
  else root.EsailsCatalog = c;
})(typeof self !== "undefined" ? self : this, function () {
  return {"versie":"2026-11-19","imgBase":"https://cdn.webshopapp.com/shops/317184/files/","doeken":{"sunbrella_plus":{"naam":"Sunbrella Plus","merk":"Sunbrella","soort":"acryl","rolCm":152,"gewicht":"320 g/m\u00b2","badge":"Meest gekozen","oms":"Premium maritiem acryl. Ademend (voorkomt schimmel), extreem UV- en kleurvast, 10 jaar garantie.","kleuren":[{"vid":"292542083","url":"sunbrella-plus-arctic-blue-p023-320-gr-m2-152-cm.html","naam":"Arctic Blue","prijs":36.95,"hex":"#24508f","img":445495744,"garen":"marine_blauw"},{"vid":"322578883","url":"sunbrella-plus-atlantic-blue-p024-320-gr-m2-152-cm.html","naam":"Atlantic Blue","prijs":36.95,"hex":"#24508f","img":496781528,"garen":"marine_blauw"},{"vid":"322578887","url":"sunbrella-plus-basalt-p078-320-gr-m2-152-cm.html","naam":"Basalt","prijs":36.95,"hex":"#3d4043","img":496781530,"garen":"antraciet"},{"vid":"292542129","url":"sunbrella-plus-burgundy-5034-320-gr-m2-152-cm.html","naam":"Burgundy / Bordeaux","prijs":34.95,"hex":"#8e1f2a","img":445495865,"garen":"bordeaux"},{"vid":"322578892","url":"sunbrella-plus-cadet-grey-5530-320-gr-m2-152-cm.html","naam":"Cadet Grey","prijs":36.95,"hex":"#b8babb","img":496781536,"garen":"lichtgrijs"},{"vid":"292542080","url":"sunbrella-plus-captain-navy-5057-320-gr-m2-152-cm.html","naam":"Captain Navy","prijs":34.95,"hex":"#1d2740","img":445495728,"garen":"captain_navy"},{"vid":"322578897","url":"sunbrella-plus-celestial-p057-320-gr-m2-152-cm.html","naam":"Celestial","prijs":36.95,"hex":"#9a9a9a","img":496781537,"garen":"marine_blauw"},{"vid":"285328785","url":"sunbrella-plus-charcoal-grey-5049-152-cm.html","naam":"Charcoal Grey","prijs":36.95,"hex":"#3d4043","img":445494185,"garen":"antraciet"},{"vid":"325844435","url":"sunbrella-plus-charcoal-pique-5088-320-gr-m2-152-c.html","naam":"Charcoal Pique","prijs":36.95,"hex":"#3d4043","garen":"antraciet"},{"vid":"322578904","url":"sunbrella-plus-como-p089-320-gr-m2-152-cm.html","naam":"Como","prijs":36.95,"hex":"#24508f","img":496781547,"garen":"marine_blauw"},{"vid":"292542124","url":"sunbrella-plus-dark-navy-5058-320-gr-m2-152-cm.html","naam":"Dark Navy","prijs":34.95,"hex":"#1d2740","img":445495859,"garen":"captain_navy"},{"vid":"322578908","url":"sunbrella-plus-dark-smoke-5085-320-gr-m2-152-cm.html","naam":"Dark Smoke","prijs":36.95,"hex":"#3d4043","img":496781549,"garen":"antraciet"},{"vid":"289389017","url":"sunbrella-plus-dune-5026-152-cm.html","naam":"Dune","prijs":36.95,"hex":"#c8b48f","img":439151002,"garen":"beige"},{"vid":"322578912","url":"sunbrella-plus-ebene-pique-p091-320-gr-m2-152-cm.html","naam":"Eb\u00e8ne Piqu\u00e9","prijs":36.95,"hex":"#9a9a9a","img":496781550,"garen":"lichtgrijs"},{"vid":"322578914","url":"sunbrella-plus-eucalyptus-p088-320-gr-m2-152-cm.html","naam":"Eucalyptus","prijs":36.95,"hex":"#9a9a9a","img":496781553,"garen":"olijfgroen"},{"vid":"322578921","url":"sunbrella-plus-faroe-p082-320-gr-m2-152-cm.html","naam":"Faroe","prijs":36.95,"hex":"#9a9a9a","img":496781555,"garen":"marine_blauw"},{"vid":"322578924","url":"sunbrella-plus-fjord-p093-320-gr-m2-152-cm.html","naam":"Fjord","prijs":36.95,"hex":"#8c8f92","img":496781558,"garen":"lichtgrijs"},{"vid":"322578926","url":"sunbrella-plus-flanelle-5087-320-gr-m2-152-cm.html","naam":"Flanelle","prijs":36.95,"hex":"#9a9a9a","img":496781559,"garen":"lichtgrijs"},{"vid":"322578929","url":"sunbrella-plus-flax-p017-320-gr-m2-152-cm.html","naam":"Flax","prijs":36.95,"hex":"#c8b48f","img":496781561,"garen":"beige"},{"vid":"322578935","url":"sunbrella-plus-glacier-p092-320-gr-m2-152-cm.html","naam":"Glacier","prijs":36.95,"hex":"#b8babb","img":496781568,"garen":"lichtgrijs"},{"vid":"322578936","url":"sunbrella-plus-gobi-p085-320-gr-m2-152-cm.html","naam":"Gobi","prijs":36.95,"hex":"#9a9a9a","img":496781573,"garen":"lichtgrijs"},{"vid":"322578937","url":"sunbrella-plus-graphite-5082-320-gr-m2-152-cm.html","naam":"Graphite","prijs":36.95,"hex":"#3d4043","img":496781574,"garen":"antraciet"},{"vid":"322578943","url":"sunbrella-plus-heather-beige-5572-320-gr-m2-152-cm.html","naam":"Heather Beige","prijs":36.95,"hex":"#c8b48f","img":496781575,"garen":"beige"},{"vid":"292542075","url":"sunbrella-plus-hemp-beige-5048-320-gr-m2-152-cm.html","naam":"Hemp Beige","prijs":36.95,"hex":"#c8b48f","img":445495715,"garen":"beige"},{"vid":"322578964","url":"sunbrella-plus-howlite-p080-320-gr-m2-152-cm.html","naam":"Howlite","prijs":36.95,"hex":"#b8babb","img":496781591,"garen":"lichtgrijs"},{"vid":"292542117","url":"sunbrella-plus-jet-black-5032-320-gr-m2-152-cm.html","naam":"Jet Black","prijs":34.95,"hex":"#1c1c1e","img":445495843,"garen":"zwart"},{"vid":"322578949","url":"sunbrella-plus-marble-p052-320-gr-m2-152-cm.html","naam":"Marble","prijs":36.95,"hex":"#b8babb","img":496781579,"garen":"lichtgrijs"},{"vid":"292542086","url":"sunbrella-plus-marine-blue-5031-320-gr-m2-152-cm.html","naam":"Marine Blue","prijs":36.95,"hex":"#1d2740","img":445495780,"garen":"marine_blauw"},{"vid":"322578967","url":"sunbrella-plus-moonstone-p081-320-gr-m2-152-cm.html","naam":"Moonstone","prijs":36.95,"hex":"#b8babb","img":496781592,"garen":"lichtgrijs"},{"vid":"313551544","url":"sunbrella-plus-natural-5020-152-cm.html","naam":"Natural","prijs":34.95,"hex":"#ece4cf","img":477144967,"garen":"naturel"},{"vid":"324261104","url":"sunbrella-plus-nile-p087-320-gr-m2-152-cm.html","naam":"Nile","prijs":36.95,"hex":"#2f4a36","img":500108283,"garen":"olijfgroen"},{"vid":"322578970","url":"sunbrella-plus-ocean-p083-320-gr-m2-152-cm.html","naam":"Ocean","prijs":36.95,"hex":"#24508f","img":496781595,"garen":"marine_blauw"},{"vid":"290897884","url":"sunbrella-plus-oyster-5030-152-cm.html","naam":"Oyster","prijs":36.95,"hex":"#ece4cf","img":442070190,"garen":"naturel"},{"vid":"322578978","url":"sunbrella-plus-papyrus-p055-320-gr-m2-152-cm.html","naam":"Papyrus","prijs":36.95,"hex":"#9a9a9a","img":496781603,"garen":"lichtgrijs"},{"vid":"312260423","url":"sunbrella-plus-rock-p079-152-cm.html","naam":"Rock","prijs":36.95,"hex":"#8c8f92","img":496781426,"garen":"lichtgrijs"},{"vid":"322578981","url":"sunbrella-plus-rotala-p084-320-gr-m2-152-cm.html","naam":"Rotala","prijs":36.95,"hex":"#9a9a9a","img":496781611,"garen":"olijfgroen"},{"vid":"312642739","url":"sunbrella-plus-sienna-p086-152-cm.html","naam":"Sienna","prijs":36.95,"hex":"#9a9a9a","img":496781437,"garen":"lichtgrijs"},{"vid":"322578985","url":"sunbrella-plus-silver-5035-320-gr-m2-152-cm.html","naam":"Silver","prijs":36.95,"hex":"#b8babb","img":496781612,"garen":"lichtgrijs"},{"vid":"322578987","url":"sunbrella-plus-steel-p053-320-gr-m2-152-cm.html","naam":"Steel","prijs":36.95,"hex":"#9a9a9a","img":496781615,"garen":"lichtgrijs"},{"vid":"322578997","url":"sunbrella-plus-sunset-p090-320-gr-m2-152-cm.html","naam":"Sunset","prijs":36.95,"hex":"#9a9a9a","img":496781629,"garen":"lichtgrijs"},{"vid":"322579001","url":"sunbrella-plus-taupe-5548-320-gr-m2-152-cm.html","naam":"Taupe","prijs":36.95,"hex":"#c8b48f","img":496781638,"garen":"taupe"},{"vid":"292542111","url":"sunbrella-plus-titanium-p054-320-gr-m2-152-cm.html","naam":"Titanium","prijs":36.95,"hex":"#9a9a9a","img":445495833,"garen":"lichtgrijs"}]},"sauleda_seastar":{"naam":"Sauleda Sea Star Special","merk":"Sauleda","soort":"acryl","rolCm":153,"gewicht":"330 g/m\u00b2","badge":"Voordelig alternatief","oms":"Geweven acryl met vergelijkbare eigenschappen als Sunbrella, scherper geprijsd. Ademend en UV-bestendig.","kleuren":[{"vid":"319990706","url":"sauleda-sea-star-special-bootdoek-breedt-161596485.html","naam":"CARBON","prijs":24.95,"hex":"#3d4043","img":491345417,"garen":"antraciet"},{"vid":"311986731","url":"sauleda-sea-star-special-bootdoek-breedt-157057795.html","naam":"COAL","prijs":21.75,"hex":"#3d4043","img":485657461,"garen":"antraciet"},{"vid":"325837600","url":"sauleda-sea-star-special-bootdoek-breedt-164350525.html","naam":"SHELL","prijs":24.95,"hex":"#9a9a9a","garen":"lichtgrijs"},{"vid":"258003463","url":"sauleda-sea-star-special-bootdoek-breedt-130150199.html","naam":"AZUL","prijs":24.95,"hex":"#24508f","img":393274709,"garen":"marine_blauw"},{"vid":"258003480","url":"sauleda-sea-star-special-bootdoek-breedt-130150212.html","naam":"BEIGE","prijs":24.95,"hex":"#c8b48f","img":393274514,"garen":"beige"},{"vid":"258003320","url":"sauleda-sea-star-special-bootdoek-breedt-130150134.html","naam":"BLANCO","prijs":24.95,"hex":"#f4f3ee","img":393275068,"garen":"wit"},{"vid":"258003642","url":"sauleda-sea-star-special-bootdoek-breedt-130150317.html","naam":"BRASSERIE","prijs":24.95,"hex":"#9a9a9a","img":393274070,"garen":"bordeaux"},{"vid":"258003640","url":"sauleda-sea-star-special-bootdoek-breedt-130150315.html","naam":"GRANATE","prijs":24.95,"hex":"#8e1f2a","img":393274093,"garen":"bordeaux"},{"vid":"258003464","url":"sauleda-sea-star-special-bootdoek-breedt-130150200.html","naam":"SILVER","prijs":24.95,"hex":"#b8babb","img":393274645,"garen":"lichtgrijs"},{"vid":"258003644","url":"sauleda-sea-star-special-bootdoek-breedt-130150319.html","naam":"RACING","prijs":24.95,"hex":"#9a9a9a","img":393274046,"garen":"bordeaux"},{"vid":"258003479","url":"sauleda-sea-star-special-bootdoek-breedt-130150211.html","naam":"MARFIL","prijs":24.95,"hex":"#9a9a9a","img":393274525,"garen":"naturel"},{"vid":"258003525","url":"sauleda-sea-star-special-bootdoek-breedt-130150244.html","naam":"MARINO","prijs":24.95,"hex":"#9a9a9a","img":393274299,"garen":"marine_blauw"},{"vid":"258003333","url":"sauleda-sea-star-special-bootdoek-breedt-130150146.html","naam":"MARRON","prijs":24.95,"hex":"#5a4031","img":393274975,"garen":"donkerbruin"},{"vid":"258003490","url":"sauleda-sea-star-special-bootdoek-breedt-130150221.html","naam":"JADE","prijs":24.95,"hex":"#9a9a9a","img":393274442,"garen":"olijfgroen"},{"vid":"258003469","url":"sauleda-sea-star-special-bootdoek-breedt-130150204.html","naam":"PERLA","prijs":24.95,"hex":"#9a9a9a","img":393274620,"garen":"lichtgrijs"},{"vid":"258003407","url":"sauleda-sea-star-special-bootdoek-breedt-130150162.html","naam":"BRISA","prijs":24.95,"hex":"#9a9a9a","img":393274801,"garen":"naturel"},{"vid":"258003487","url":"sauleda-sea-star-special-bootdoek-breedt-130150218.html","naam":"ROJO","prijs":24.95,"hex":"#8e1f2a","img":393274481,"garen":"bordeaux"},{"vid":"258003473","url":"sauleda-sea-star-special-bootdoek-breedt-130150206.html","naam":"GRIS","prijs":24.95,"hex":"#8c8f92","img":393274603,"garen":"lichtgrijs"},{"vid":"258003459","url":"sauleda-sea-star-special-bootdoek-breedt-130150197.html","naam":"AZUL REAL","prijs":24.95,"hex":"#24508f","img":393274739,"garen":"marine_blauw"},{"vid":"258003335","url":"sauleda-sea-star-special-bootdoek-breedt-130150147.html","naam":"CAFE","prijs":24.95,"hex":"#c8b48f","img":393274958,"garen":"taupe"},{"vid":"258003687","url":"sauleda-sea-star-special-bootdoek-breedt-130150339.html","naam":"INTEGRAL","prijs":21.75,"hex":"#9a9a9a","img":393273569,"garen":"naturel"},{"vid":"258003653","url":"sauleda-sea-star-special-bootdoek-breedt-130150326.html","naam":"ARMADA","prijs":24.95,"hex":"#9a9a9a","img":393274005,"garen":"marine_blauw"},{"vid":"258003309","url":"sauleda-sea-star-special-bootdoek-breedt-130150126.html","naam":"ADMIRAL","prijs":21.75,"hex":"#1d2740","img":393275080,"garen":"marine_blauw"},{"vid":"258003478","url":"sauleda-sea-star-special-bootdoek-breedt-130150210.html","naam":"AVENA","prijs":24.95,"hex":"#9a9a9a","img":393274557,"garen":"lichtgrijs"},{"vid":"258003557","url":"sauleda-sea-star-special-bootdoek-breedt-130150270.html","naam":"VISON","prijs":21.75,"hex":"#c8b48f","img":393274143,"garen":"taupe"},{"vid":"258003325","url":"sauleda-sea-star-special-bootdoek-breedt-130150139.html","naam":"SEDA","prijs":24.95,"hex":"#9a9a9a","img":393275002,"garen":"lichtgrijs"},{"vid":"258003406","url":"sauleda-sea-star-special-bootdoek-breedt-130150161.html","naam":"ACQUAMARINA","prijs":24.95,"hex":"#9a9a9a","img":393274828,"garen":"marine_blauw"},{"vid":"258003554","url":"sauleda-sea-star-special-bootdoek-breedt-130150267.html","naam":"ANTRACITA","prijs":21.75,"hex":"#3d4043","img":393274175,"garen":"antraciet"},{"vid":"258003676","url":"sauleda-sea-star-special-bootdoek-breedt-130150333.html","naam":"TWEED NEGRO (Zwart)","prijs":24.95,"hex":"#1c1c1e","img":393273967,"garen":"zwart"},{"vid":"258003549","url":"sauleda-sea-star-special-bootdoek-breedt-130150262.html","naam":"GRAFITO","prijs":24.95,"hex":"#3d4043","img":393274191,"garen":"antraciet"},{"vid":"258003396","url":"sauleda-sea-star-special-bootdoek-breedt-130150153.html","naam":"LILA","prijs":24.95,"hex":"#9a9a9a","img":393274925,"garen":"bordeaux"},{"vid":"258003297","url":"sauleda-sea-star-special-bootdoek-breedt-130150116.html","naam":"PINK","prijs":24.95,"hex":"#d89aa8","img":393275094,"garen":"bordeaux"},{"vid":"258003647","url":"sauleda-sea-star-special-bootdoek-breedt-130150322.html","naam":"REGATA","prijs":24.95,"hex":"#9a9a9a","img":393274032,"garen":"marine_blauw"},{"vid":"258003542","url":"sauleda-sea-star-special-bootdoek-breedt-130150256.html","naam":"TWEED GRIS CL","prijs":24.95,"hex":"#8c8f92","img":393274210,"garen":"lichtgrijs"},{"vid":"258003508","url":"sauleda-sea-star-special-bootdoek-breedt-130150232.html","naam":"BOTELLA","prijs":24.95,"hex":"#9a9a9a","img":393274367,"garen":"olijfgroen"},{"vid":"258003521","url":"sauleda-sea-star-special-bootdoek-breedt-130150242.html","naam":"TWEED AZUL","prijs":24.95,"hex":"#24508f","img":393274346,"garen":"marine_blauw"},{"vid":"258003502","url":"sauleda-sea-star-special-bootdoek-breedt-130150225.html","naam":"TWEED VERDE","prijs":24.95,"hex":"#2f4a36","img":393274388,"garen":"olijfgroen"},{"vid":"258003658","url":"sauleda-sea-star-special-bootdoek-breedt-130150329.html","naam":"TWEED ROJO","prijs":24.95,"hex":"#8e1f2a","img":393273979,"garen":"bordeaux"},{"vid":"258003329","url":"sauleda-sea-star-special-bootdoek-breedt-130150142.html","naam":"TWEED AVENA","prijs":24.95,"hex":"#9a9a9a","img":393274992,"garen":"lichtgrijs"},{"vid":"258003488","url":"sauleda-sea-star-special-bootdoek-breedt-130150219.html","naam":"RIOJA","prijs":24.95,"hex":"#9a9a9a","img":393274462,"garen":"bordeaux"},{"vid":"258003500","url":"sauleda-sea-star-special-bootdoek-breedt-130150223.html","naam":"VERDE","prijs":24.95,"hex":"#2f4a36","img":393274415,"garen":"olijfgroen"},{"vid":"258003536","url":"sauleda-sea-star-special-bootdoek-breedt-130150253.html","naam":"TWEED MIDNIGHTBLUE","prijs":24.95,"hex":"#24508f","img":393274262,"garen":"marine_blauw"},{"vid":"258003409","url":"sauleda-sea-star-special-bootdoek-breedt-130150164.html","naam":"INDIGO","prijs":24.95,"hex":"#9a9a9a","img":393274770,"garen":"marine_blauw"},{"vid":"258003545","url":"sauleda-sea-star-special-bootdoek-breedt-130150259.html","naam":"MINERAL","prijs":24.95,"hex":"#9a9a9a","img":393274200,"garen":"lichtgrijs"},{"vid":"258003680","url":"sauleda-sea-star-special-bootdoek-breedt-130150336.html","naam":"NEGRO (Zwart)","prijs":21.75,"hex":"#1c1c1e","img":393273931,"garen":"zwart"},{"vid":"258003529","url":"sauleda-sea-star-special-bootdoek-breedt-130150248.html","naam":"COMMODORE","prijs":24.95,"hex":"#9a9a9a","img":393274286,"garen":"marine_blauw"},{"vid":"258003292","url":"sauleda-sea-star-special-bootdoek-breedte-153-cm-3.html","naam":"OPTIK","prijs":24.95,"hex":"#9a9a9a","img":393275122,"garen":"lichtgrijs"},{"vid":"258003477","url":"sauleda-sea-star-special-bootdoek-breedt-130150209.html","naam":"PIEDRA","prijs":24.95,"hex":"#9a9a9a","img":393274578,"garen":"lichtgrijs"},{"vid":"258003484","url":"sauleda-sea-star-special-bootdoek-breedt-130150215.html","naam":"NARANJA","prijs":24.95,"hex":"#e06a1b","img":393274501,"garen":"lichtgrijs"},{"vid":"258003392","url":"sauleda-sea-star-special-bootdoek-breedt-130150151.html","naam":"AMARILLO","prijs":24.95,"hex":"#e8c547","img":393274949,"garen":"lichtgrijs"},{"vid":"258003323","url":"sauleda-sea-star-special-bootdoek-breedt-130150137.html","naam":"VANILLIA","prijs":24.95,"hex":"#9a9a9a","img":393275046,"garen":"lichtgrijs"},{"vid":"258003626","url":"sauleda-sea-star-special-bootdoek-breedt-130150309.html","naam":"TEJA","prijs":24.95,"hex":"#9a9a9a","img":393274134,"garen":"lichtgrijs"}]},"poly_marine":{"naam":"Poly Marine polyester","merk":"Poly Marine","soort":"polyester","rolCm":150,"gewicht":"290 g/m\u00b2","badge":"Budget","badgeType":"budget","oms":"Soepel en licht polyester. Compact op te vouwen, ideaal voor lichtere zomerafdekking.","kleuren":[{"vid":"306360540","url":"poly-marine-polyester-doek-antraciet-290-gr-m2-150.html","naam":"Antraciet","prijs":14.95,"hex":"#3d4043","img":466674160,"garen":"antraciet"},{"vid":"306360503","url":"poly-marine-polyester-doek-captain-navy-290-gr-m2.html","naam":"Captain Navy","prijs":14.95,"hex":"#1d2740","img":466674141,"garen":"captain_navy"},{"vid":"306360549","url":"poly-marine-polyester-doek-silver-290-gr-m2-150-cm.html","naam":"Silver","prijs":14.95,"hex":"#b8babb","img":466674128,"garen":"lichtgrijs"},{"vid":"306360554","url":"poly-marine-polyester-doek-zwart-290-gr-m2-150-cm.html","naam":"Zwart","prijs":14.95,"hex":"#1c1c1e","img":466674101,"garen":"zwart"}]},"ferrari_705":{"naam":"Serge Ferrari 705 PVC","merk":"Serge Ferrari","soort":"pvc","rolCm":270,"gewicht":"670 g/m\u00b2","badge":"Premium","oms":"Pr\u00e9contraint PVC: 100% waterdicht, scheurvast en maatvast. Te lijmen of te naaien.","kleuren":[{"vid":"289467412","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-270-cm-kleu-146592298.html","naam":"Agaatgrijs","prijs":30.95,"hex":"#8c8f92","img":439234998,"garen":"lichtgrijs"},{"vid":"284515327","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-2-144166185.html","naam":"Antraciet","prijs":30.95,"hex":"#3d4043","img":439234883,"garen":"antraciet"},{"vid":"289467416","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-2-146592301.html","naam":"Ivoor","prijs":30.95,"hex":"#ece4cf","img":439235031,"garen":"naturel"},{"vid":"263190368","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-270-cm-kleu.html","naam":"Karmijnrood","prijs":30.95,"hex":"#8e1f2a","img":398537820,"garen":"bordeaux"},{"vid":"274126759","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-2-138618191.html","naam":"Kobaltblauw","prijs":30.95,"hex":"#24508f","img":415067073,"garen":"marine_blauw"},{"vid":"289467406","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-270-cm-kleu-146592293.html","naam":"Lichtgrijs","prijs":30.95,"hex":"#b8babb","img":439234987,"garen":"lichtgrijs"},{"vid":"289467471","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-2-146592316.html","naam":"Mosgroen","prijs":30.95,"hex":"#2f4a36","img":439235104,"garen":"olijfgroen"},{"vid":"263190529","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-2-132945905.html","naam":"Oranje","prijs":30.95,"hex":"#e06a1b","img":398538070,"garen":"lichtgrijs"},{"vid":"289467425","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-2-146592304.html","naam":"Parelwit","prijs":30.95,"hex":"#f4f3ee","img":439235052,"garen":"wit"},{"vid":"282234646","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-270-cm-kleu-142917993.html","naam":"Wit","prijs":30.95,"hex":"#f4f3ee","img":427434147,"garen":"wit"},{"vid":"289467429","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-270-cm-kleu-146592305.html","naam":"Zilver","prijs":30.95,"hex":"#b8babb","img":439235060,"garen":"lichtgrijs"},{"vid":"274126768","url":"ferrari-705-pvc-doek-670-gr-m2-breedte-2-138618196.html","naam":"Zwart","prijs":30.95,"hex":"#1c1c1e","img":415067136,"garen":"zwart"}]},"mehler_8205":{"naam":"Mehler Polymar 8205 PVC","merk":"Mehler","soort":"pvc","rolCm":250,"gewicht":"680 g/m\u00b2","badge":"Waterdicht","oms":"Robuust PVC-doek, 100% waterdicht en vlekbestendig. Breed (250 cm), dus weinig naden.","kleuren":[{"vid":"266879882","url":"mehler-polymar-pvc-doek-8205-680-gr-m2-koningsblau.html","naam":"Koningsblauw","prijs":27.99,"hex":"#24508f","img":403691344,"garen":"marine_blauw"},{"vid":"266879955","url":"mehler-polymar-pvc-doek-8205-680-gr-m2-mosgroen-67.html","naam":"Mosgroen","prijs":27.99,"hex":"#2f4a36","img":403691485,"garen":"olijfgroen"}]},"mehler_8940":{"naam":"Mehler Polymar 8940/8948 PVC","merk":"Mehler","soort":"pvc","rolCm":204,"gewicht":"600\u2013680 g/m\u00b2","badge":"Scherp geprijsd","badgeType":"budget","oms":"Waterdicht PVC-doek op 204 cm breedte. Prima prijs/kwaliteit voor afdekzeilen.","kleuren":[{"vid":"292812283","url":"mehler-polymar-pvc-doek-8940-680-gr-m2-konings-bla.html","naam":"Konings Blauw","prijs":15.95,"hex":"#24508f","img":446072806,"garen":"marine_blauw"},{"vid":"296017465","url":"mehler-polymar-pvc-doek-8948-600-gr-m2-karmijn-roo.html","naam":"Karmijn Rood","prijs":14.16,"hex":"#8e1f2a","img":450704848,"garen":"bordeaux"}]},"ferrari_602n":{"naam":"Serge Ferrari 602N PVC (brandvertragend)","merk":"Serge Ferrari","soort":"pvc","rolCm":267,"gewicht":"620 g/m\u00b2","badge":"Brandvertragend","oms":"Brandvertragend PVC (M2/B1). Voor afdekkingen bij bbq, terrasverwarming of in bedrijfsomgeving.","kleuren":[{"vid":"320361010","url":"ferrari-602n-brandvertragend-pvc-doek-620-gr-m2-br-161783552.html","naam":"Ivoor","prijs":41.15,"hex":"#ece4cf","garen":"naturel"},{"vid":"284006635","url":"ferrari-602n-brandvertragend-pvc-doek-620-gr-m2-br.html","naam":"Zwart","prijs":41.15,"hex":"#1c1c1e","img":430464081,"garen":"zwart"}]},"mehler_gaas":{"naam":"Mehler Polymar PVC-gaasweefsel","merk":"Mehler","soort":"gaas","rolCm":250,"gewicht":"285 g/m\u00b2","badge":"Zon- en windwerend","oms":"Open PVC-gaasweefsel: houdt zon en warmte tegen, je kijkt er doorheen en het laat wind door. Rafelt niet.","kleuren":[{"vid":"296015345","url":"mehler-polymar-pvc-gaasweefsel-7914-285-gr-m2-olij.html","naam":"Olijfgroen","prijs":14.95,"hex":"#2f4a36","img":450700479},{"vid":"282183394","url":"mehler-polymar-pvc-gaasweefsel-7916-285-gr-m2-zwar.html","naam":"Zwart","prijs":14.95,"hex":"#1c1c1e"}]},"ferrari_362":{"naam":"Serge Ferrari 362 PVC-gaasdoek","merk":"Serge Ferrari","soort":"gaas","rolCm":267,"gewicht":"430 g/m\u00b2","badge":"Brandvertragend","oms":"Brandvertragend PVC-gaasdoek van Serge Ferrari. Schaduw en privacy, laat wind door.","kleuren":[{"vid":"312824948","url":"ferrari-362-pvc-gaasdoek-brandvertragend-430-gr-m2.html","naam":"Wit","prijs":46.95,"hex":"#f4f3ee","img":475939690}]}},"garen":{"antraciet":{"vid":"256699141","url":"coats-terko-garen-m36-antraciet-9969-katoen-polyes.html","naam":"Coats Terko M36 garen \u2014 Antraciet","prijs":9.95,"unit":"st","img":389686898,"hex":"#3d4043"},"beige":{"vid":"256699178","url":"coats-terko-garen-m36-beige-0673-katoen-polyester.html","naam":"Coats Terko M36 garen \u2014 Beige","prijs":9.95,"unit":"st","img":389686978,"hex":"#c8b48f"},"bordeaux":{"vid":"256699234","url":"coats-terko-garen-m36-bordeaux-9312-katoen-polyest.html","naam":"Coats Terko M36 garen \u2014 Bordeaux","prijs":9.95,"unit":"st","img":389687306,"hex":"#8e1f2a"},"captain_navy":{"vid":"256699248","url":"coats-terko-garen-m36-captain-navy-0287-katoen-pol.html","naam":"Coats Terko M36 garen \u2014 Captain Navy","prijs":9.95,"unit":"st","img":389687437,"hex":"#1d2740"},"donkerbruin":{"vid":"256699306","url":"coats-terko-garen-m36-donkerbruin-8965-katoen-poly.html","naam":"Coats Terko M36 garen \u2014 Donkerbruin","prijs":9.95,"unit":"st","img":389687601,"hex":"#5a4031"},"lichtgrijs":{"vid":"256699349","url":"coats-terko-garen-m36-lichtgrijs-9138-katoen-polye.html","naam":"Coats Terko M36 garen \u2014 Lichtgrijs","prijs":9.95,"unit":"st","img":389687669,"hex":"#b8babb"},"marine_blauw":{"vid":"256699398","url":"coats-terko-garen-m36-marine-blauw-0283-katoen-pol.html","naam":"Coats Terko M36 garen \u2014 Marine Blauw","prijs":9.95,"unit":"st","img":389687779,"hex":"#1d2740"},"naturel":{"vid":"256699436","url":"coats-terko-garen-m36-naturel-ntrl-katoen-polyeste.html","naam":"Coats Terko M36 garen \u2014 Naturel","prijs":9.95,"unit":"st","img":389687905,"hex":"#ece4cf"},"olijfgroen":{"vid":"256699510","url":"coats-terko-garen-m36-olijfgroen-5912-katoen-polye.html","naam":"Coats Terko M36 garen \u2014 Olijfgroen","prijs":9.95,"unit":"st","img":389688091,"hex":"#2f4a36"},"taupe":{"vid":"256699620","url":"coats-terko-garen-m36-taupe-8813-katoen-polyester.html","naam":"Coats Terko M36 garen \u2014 Taupe","prijs":9.95,"unit":"st","img":389688442,"hex":"#c8b48f"},"wit":{"vid":"256699679","url":"coats-terko-garen-m36-wit-1700-katoen-polyester-80.html","naam":"Coats Terko M36 garen \u2014 Wit","prijs":9.95,"unit":"st","img":389688535,"hex":"#f4f3ee"},"zwart":{"vid":"256120441","url":"terko-garen-m36-zwart-9700-katoen-polyester-800-m.html","naam":"Coats Terko M36 garen \u2014 Zwart","prijs":9.95,"unit":"st","img":388768573,"hex":"#1c1c1e"}},"p":{"loxx_kop_rvs":{"vid":"253532240","url":"loxx-kop-rvs-origineel-made-in-germany.html","naam":"Loxx kop \u2014 RVS","prijs":3.49,"unit":"st","img":385740024},"loxx_kop_kv":{"vid":"265497536","url":"loxx-kop-koper-vernikkeld.html","naam":"Loxx kop \u2014 koper-vernikkeld","prijs":1.89,"unit":"st","img":401356231},"loxx_kop_chroom":{"vid":"288360367","url":"loxx-kop-verchroomd.html","naam":"Loxx kop \u2014 messing-verchroomd","prijs":3.29,"unit":"st","img":497905761},"loxx_kop_zwart":{"vid":"262542520","url":"loxx-kop-zwart.html","naam":"Loxx kop \u2014 zwart","prijs":4.45,"unit":"st","img":397619377},"loxx_zelftapper_rvs":{"vid":"253532032","url":"loxx-zelftapper-rvs-schroefdraadlengte-12-mm-schro.html","naam":"Loxx zelftapper RVS 12 mm (op de boot)","prijs":0.89,"unit":"st","img":385844520},"loxx_zelftapper_kv":{"vid":"255590166","url":"loxx-zelftapper-schroefdraad-41-x-12-mm-koper-vern.html","naam":"Loxx zelftapper koper-vernikkeld 4,2 \u00d7 12 mm (op de boot)","prijs":1.19,"unit":"st","img":391698978},"loxx_bout_rvs":{"vid":"255769033","url":"loxx-bout-rvs-m5-x-lengte-10mm-128763177.html","naam":"Loxx bout RVS M5 \u00d7 10 mm (op de boot)","prijs":1.69,"unit":"st","img":388335392},"loxx_moer_rvs":{"vid":"255769886","url":"copy-of-loxx-bout-rvs-m5-x-lengte-10mm.html","naam":"Loxx moer RVS M5 (voor de bout)","prijs":0.19,"unit":"st","img":391697285},"loxx_doekdeel_kv":{"vid":"253531985","url":"loxx-doekdeel-koper-vernikkeld-origineel-made-in-g.html","naam":"Loxx ontvanger/doekdeel koper-vernikkeld (doek-op-doek)","prijs":1.59,"unit":"st","img":385845022},"loxx_sleutel":{"vid":"253911895","url":"lox-sleutel-koper-vernikkeld.html","naam":"Loxx montagesleutel","prijs":0.49,"unit":"st","img":391698683,"perOrder":true},"loxx_holpijp":{"vid":"316670607","url":"holpijp-9-mm-voor-holpijp-tang.html","naam":"Holpijp 9 mm voor Loxx","prijs":32.95,"unit":"st","img":498050071,"perOrder":true,"tool":true},"draai_prym":{"vid":"257993275","url":"prym-tourniquet-draaier-koper-vernikkeld-model-906.html","naam":"Prym tourniquet draaier #9065 messing-vernikkeld (15 \u00d7 9 mm)","prijs":0.99,"unit":"st","img":391524922},"draai_prym_kous":{"vid":"258015200","url":"prym-tourniquet-kous-ring-koper-vernikkeld-model-1.html","naam":"Prym tourniquet kous & ring F370 (15 \u00d7 9 mm)","prijs":0.59,"unit":"st","img":391559424},"draai_mh":{"vid":"260022585","url":"mh-tourniquet-draaier-koper-vernikkeld-voor-tourni.html","naam":"MH tourniquet draaier messing-vernikkeld (17 \u00d7 11 mm)","prijs":1.45,"unit":"st","img":394066933},"draai_mh_kous":{"vid":"260024359","url":"mh-tourniquet-kous-ring-koper-vernikkeld-17-x-11-m.html","naam":"MH tourniquet kous & ring messing-vernikkeld (17 \u00d7 11 mm)","prijs":0.99,"unit":"st","img":394069410},"draai_prym_holpijp":{"vid":"257995106","url":"prym-holpijp-tourniquet-16-x-9-mm.html","naam":"Prym holpijp tourniquet 16 \u00d7 9 mm","prijs":58.95,"unit":"st","img":391528574,"perOrder":true,"tool":true},"draai_prym_stempel":{"vid":"257994150","url":"prym-stempel-tourniquet-15-x-9-mm-voor-prym-tourni.html","naam":"Prym stempel tourniquet type 370 (15 \u00d7 9 mm)","prijs":134.75,"unit":"st","img":476469465,"perOrder":true,"tool":true},"draai_mh_holpijp":{"vid":"259989808","url":"mh-holpijp-tourniquet-17x11-mm.html","naam":"Paffrath holpijp tourniquet 17 \u00d7 11 mm","prijs":68.5,"unit":"st","img":394019283,"perOrder":true,"tool":true},"draai_mh_stempel":{"vid":"260002692","url":"mh-stempel-tourniquet-17x11-mm.html","naam":"MH stempel tourniquet 17 \u00d7 11 mm","prijs":138.25,"unit":"st","img":394038635,"perOrder":true,"tool":true},"druk_ykk_a":{"vid":"319599669","url":"ykk-drukknoop-rvs-deel-a.html","naam":"YKK YKK | Drukknoop | RVS | Deel A","prijs":0.59,"unit":"st","img":490544394},"druk_ykk_b":{"vid":"319599676","url":"ykk-drukknoop-rvs-deel-b.html","naam":"YKK YKK | Drukknoop | RVS | Deel B","prijs":0.73,"unit":"st","img":490544396},"druk_ykk_c":{"vid":"319599686","url":"ykk-drukknoop-rvs-deel-c.html","naam":"YKK YKK | Drukknoop | RVS | Deel C","prijs":0.59,"unit":"st","img":490544402},"druk_dot_a":{"vid":"257994841","url":"dot-drukknoop-rvs-deel-a.html","naam":"DOT\u00ae Fasteners DOT | Durable | Drukknoop | Deel A | RVS","prijs":0.73,"unit":"st","img":391528000},"druk_dot_b":{"vid":"257994829","url":"dot-drukknoop-deel-b-rvs.html","naam":"DOT\u00ae Fasteners DOT | Durable | Drukknoop | Deel B | RVS","prijs":0.77,"unit":"st","img":391527943},"druk_dot_c":{"vid":"257994859","url":"dot-drukknoop-parker-deel-c-9-mm.html","naam":"DOT\u00ae Fasteners DOT | Durable | Drukknoop | Deel C | Parker | RVS | 9 mm","prijs":1.79,"unit":"st","img":391528042},"druk_fasnap_a":{"vid":"286980532","url":"fasnap-drukknoop-deel-a-koper-vernikkeld.html","naam":"Fasnap Fasnap | Drukknoop | Deel A | Koper-Vernikkeld","prijs":0.49,"unit":"st","img":434865637},"druk_fasnap_b":{"vid":"286980536","url":"fasnap-drukknoop-deel-b-koper-vernikkeld.html","naam":"Fasnap Fasnap | Drukknoop | Deel B | Koper-Vernikkeld","prijs":0.59,"unit":"st","img":434865651},"druk_fasnap_c":{"vid":"286980544","url":"fasnap-drukknoop-deel-c-koper-vernikkeld.html","naam":"Fasnap Fasnap | Drukknoop | Deel C | Koper-Vernikkeld","prijs":0.49,"unit":"st","img":434865670},"druk_prym_a":{"vid":"257994790","url":"prym-drukknoop-koper-vernikkeld-deel-a-stift-5-mm.html","naam":"Prym Prym | Drukknoop | Koper-Vernikkeld | Deel A | Stift 5 mm","prijs":0.49,"unit":"st","img":391527848},"druk_prym_b":{"vid":"257994796","url":"prym-drukknoop-koper-vernikkeld-deel-b-type-3000.html","naam":"Prym Prym | Drukknoop | Koper-Vernikkeld | Deel B | Type 3000","prijs":0.49,"unit":"st","img":391527861},"druk_prym_c":{"vid":"257994803","url":"prym-drukknoop-koper-vernikkeld-deel-c-type-3000-2.html","naam":"Prym Prym | Drukknoop | Messing-Vernikkeld | Deel C | Type 3001 / 23","prijs":0.49,"unit":"st","img":391527884},"druk_dot_c_bout":{"vid":"258002241","url":"dot-drukknoop-deel-c-bout-rvs-12-mm-x-m5.html","naam":"DOT drukknoop deel C \u2014 bout RVS M5 \u00d7 9 mm","prijs":1.99,"unit":"st","img":391538412},"druk_dot_c_popnagel":{"vid":"257994867","url":"dot-drukknoop-popnagel-rvs-8-mm.html","naam":"DOT drukknoop deel C \u2014 popnagel RVS 8 mm","prijs":1.29,"unit":"st","img":391528075},"druk_dot_c_raamclip":{"vid":"257997395","url":"dot-drukknoop-deel-c-raamclip-rvs-24mm.html","naam":"DOT drukknoop deel C \u2014 raamclip RVS 24 mm","prijs":1.79,"unit":"st","img":391532232},"druk_holpijp":{"vid":"313343275","url":"holpijp-rond-3-mm.html","naam":"Paffrath holpijp rond 3 mm","prijs":4.3,"unit":"st","img":476835762,"perOrder":true,"tool":true},"druk_stempel":{"vid":"256701648","url":"osborne-usa-stempel-voor-drukknopen-semi-professio.html","naam":"Osborne stempel voor drukknopen (229-24)","prijs":37.95,"unit":"st","img":393069345,"perOrder":true,"tool":true},"ring_10_rvs":{"vid":"260094625","url":"mh-zeilkous-din-10-rvs.html","naam":"MH zeilring DIN 10 \u2014 RVS","prijs":0.45,"unit":"st","img":394164129},"ring_10_messing":{"vid":"260094491","url":"mh-zeilkous-din-10-messing.html","naam":"MH zeilring DIN 10 \u2014 messing","prijs":0.43,"unit":"st","img":394163852},"ring_10_set":{"vid":"313445757","url":"holpijp-stempel-stansblok-10-mm-voordeelset.html","naam":"Holpijp & stempel 10 mm + gratis stansblok","prijs":59.25,"unit":"st","img":476970987,"perOrder":true,"tool":true},"ring_12_rvs":{"vid":"260095659","url":"mh-zeilkous-din-12-rvs.html","naam":"MH zeilring DIN 12 \u2014 RVS","prijs":0.52,"unit":"st","img":394164449},"ring_12_messing":{"vid":"260095620","url":"mh-zeilkous-din-12-messing.html","naam":"MH zeilring DIN 12 \u2014 messing","prijs":0.59,"unit":"st","img":394164391},"ring_12_set":{"vid":"313482374","url":"holpijp-stempel-12-mm-gratis-stansblok.html","naam":"Holpijp & stempel 12 mm + gratis stansblok","prijs":61.96,"unit":"st","img":477019061,"perOrder":true,"tool":true},"ring_16_rvs":{"vid":"260096214","url":"mh-zeilkous-din-16-rvs.html","naam":"MH zeilring DIN 16 \u2014 RVS","prijs":0.75,"unit":"st","img":394165873},"ring_16_messing":{"vid":"260096117","url":"mh-zeilkous-din-16-messing.html","naam":"MH zeilring DIN 16 \u2014 messing","prijs":0.85,"unit":"st","img":394165649},"ring_16_set":{"vid":"313482376","url":"holpijp-stempel-16-mm-gratis-stansblok.html","naam":"Holpijp & stempel 16 mm + gratis stansblok","prijs":76.6,"unit":"st","img":477019063,"perOrder":true,"tool":true},"shock_6_zwart":{"vid":"259527665","url":"shockcord-elastiek-6-mm-zwart-prijs-per-meter.html","naam":"Shockcord / elastiek 6 mm \u2014 zwart","prijs":0.89,"unit":"m","img":393463069},"shock_6_wit":{"vid":"259527590","url":"shockcord-elastiek-6-mm-wit-prijs-per-meter.html","naam":"Shockcord / elastiek 6 mm \u2014 wit","prijs":0.89,"unit":"m","img":393462967},"shock_8_zwart":{"vid":"259419002","url":"shockcord-elastiek-8-mm-zwart-prijs-per-meter.html","naam":"Shockcord / elastiek 8 mm \u2014 zwart","prijs":1.09,"unit":"m","img":393313086},"shock_8_wit":{"vid":"259527714","url":"shockcord-elastiek-8-mm-wit-prijs-per-meter.html","naam":"Shockcord / elastiek 8 mm \u2014 wit","prijs":1.09,"unit":"m","img":393463153},"koordhaak":{"vid":"302548075","url":"koordhaak-nylon-wit-lengte-50-mm-breedte-20-mm-doo.html","naam":"Koordhaak nylon wit (6\u201310 mm koord)","prijs":0.76,"unit":"st","img":460654241},"musketon":{"vid":"259143564","url":"musketonhaak-nylon-zwart-quick-block-8-mm.html","naam":"Musketonhaak nylon zwart (8 mm)","prijs":1.29,"unit":"st","img":393020081},"koordklem":{"vid":"277045622","url":"koordklem-rvs-8-mm-set-10-stuks.html","naam":"Koordklem rond RVS 8 mm (koordeinden afwerken)","prijs":0.28,"unit":"st","img":419896133},"rondknop":{"vid":"259998021","url":"mh-rondknop-symmetrisch-30-x-24-x-14h-mm-zwart.html","naam":"MH rondknop asymmetrisch zwart 30 \u00d7 24 mm","prijs":0.68,"unit":"st","img":394031892},"noorse_knop":{"vid":"257072753","url":"marinetech-noorse-knop-rvs-10-x-10-mm-doorvoer-tot.html","naam":"Marinetech Noorse knop RVS 11 \u00d7 10 mm","prijs":1.39,"unit":"st","img":390279117},"klit_25_haak":{"vid":"260597286","url":"klittenband-zwart-haak-hard-25-mm-prijs-per-meter.html","naam":"Klittenband zwart 25 mm \u2014 haak (hard)","prijs":0.99,"unit":"m","img":394903980},"klit_25_lus":{"vid":"260606379","url":"klittenband-zwart-lus-zacht-25-mm-prijs-per-meter.html","naam":"Klittenband zwart 25 mm \u2014 lus (zacht)","prijs":0.99,"unit":"m","img":484613215},"klit_50_haak":{"vid":"260607937","url":"klittenband-zwart-haak-hard-50-mm-prijs-per-meter.html","naam":"Klittenband zwart 50 mm \u2014 haak (hard)","prijs":1.39,"unit":"m","img":394906274},"klit_50_lus":{"vid":"260609573","url":"klittenband-zwart-lus-zacht-50-mm-prijs-per-meter.html","naam":"Klittenband zwart 50 mm \u2014 lus (zacht)","prijs":1.39,"unit":"m","img":484613002},"raamfolie":{"vid":"293617490","url":"achilles-raamfolie-glasfolie-vinistar-super-dikte.html","naam":"Achilles Vinistar Super raamfolie 0,4 mm (137 cm breed)","prijs":9.32,"unit":"m","img":447888450,"rolCm":137},"raamfolie_05":{"vid":"323098115","url":"achilles-raamfolie-glasfolie-vinistar-smoke-tint-d.html","naam":"Achilles Vinistar Smoke Tint raamfolie 0,5 mm (137 cm breed)","prijs":16.95,"unit":"m","img":497820811,"rolCm":137},"tape_6":{"vid":"302835931","url":"seam-stick-dubbelzijdig-tape-non-yellowi-152551037.html","naam":"Seam Stick dubbelzijdig tape 6 mm (rol 50 m)","prijs":5.2,"unit":"st","img":461135435,"perOrder":true},"tape_9":{"vid":"297791084","url":"seam-stick-dubbelzijdig-tape-non-yellowing-rol-50.html","naam":"Seam Stick dubbelzijdig tape 9 mm (rol 50 m)","prijs":8.45,"unit":"st","img":452816405,"perOrder":true},"tape_12":{"vid":"297791091","url":"seam-stick-dubbelzijdig-tape-non-yellowing-rol-50-150338130.html","naam":"Seam Stick dubbelzijdig tape 12 mm (rol 50 m)","prijs":9.99,"unit":"st","img":452816419,"perOrder":true},"mallendoek":{"vid":"325737735","url":"mallendoek-ldpe-gerecycled-transparant-folie-dikte.html","naam":"Mallendoek LDPE gerecycled 0,18 mm, 300 cm breed","prijs":4.95,"unit":"m","rolCm":300},"mallendoek_rol":{"vid":"325737733","url":"mallendoek-ldpe-gerecycled-transparant-folie-dikte.html","naam":"Mallendoek LDPE gerecycled 0,18 mm, 300 cm breed \u2014 rol 50 m","prijs":149.75,"unit":"st","img":502322430,"rolLengteM":50},"band_25_zwart":{"vid":"325093988","url":"polyesterband-1366-zwart-25-mm.html","naam":"Polyesterband 1366 zwart 25 mm","prijs":1.22,"unit":"m","img":501405593},"klemgesp":{"vid":"313387985","url":"klemgesp-rvs-25-mm.html","naam":"Klemgesp RVS 25 mm","prijs":2.95,"unit":"st","img":476890980},"beugel_zwart":{"vid":"269081614","url":"bandbeugel-nylon-zwart-25-mm.html","naam":"Bandbeugel nylon zwart 25 mm","prijs":1.29,"unit":"st","img":406507354},"beugel_wit":{"vid":"269081652","url":"bandbeugel-nylon-wit-25-mm.html","naam":"Bandbeugel nylon wit 25 mm","prijs":1.29,"unit":"st","img":406507418},"beugel_rvs":{"vid":"256947996","url":"bandbeugel-rvs-luxe-versie-voor-band-25-mm-afstand.html","naam":"Bandbeugel RVS luxe 25 mm","prijs":5.49,"unit":"st","img":390061439},"glaspotlood":{"vid":"267142123","url":"staedler-glaspotlood-16-cm-wit.html","naam":"Staedtler glaspotlood wit","prijs":1.91,"unit":"st","img":404195039,"perOrder":true},"saba_250":{"vid":"282388634","url":"saba-70t-pvc-lijm-250-ml.html","naam":"Saba Sabacontact 70T PVC-lijm 250 ml","prijs":14.95,"unit":"st","img":427720898,"perOrder":true},"saba_1l":{"vid":"253895183","url":"saba-contact-70t-pvc-lijm.html","naam":"Saba Sabacontact 70T PVC-lijm 1 liter","prijs":32.99,"unit":"st","img":427711246,"perOrder":true},"sabaclean":{"vid":"253891984","url":"saba-clean-21-1-ltr-cleaner-voor-de-70t.html","naam":"Sabaclean 21 reiniger voor 70T \u2014 1 liter","prijs":23.95,"unit":"st","img":385774381,"perOrder":true},"griffon_cleaner":{"vid":"253891969","url":"griffon-cleaner-250-ml-voor-pvc-doek-pvc-c-abs-en.html","naam":"Griffon cleaner 250 ml (PVC ontvetter)","prijs":12.95,"unit":"st","img":385774341,"perOrder":true},"ferrari_cleaner":{"vid":"259191434","url":"ferrari-cleaner-stain-remover-voor-pvc-doek-500ml.html","naam":"Serge Ferrari cleaner & stain remover (PVC) 500 ml","prijs":28.95,"unit":"st","img":393068108,"perOrder":true},"fabric_guard":{"vid":"252696033","url":"303-fabric-guard.html","naam":"303 Fabric Guard impregneer 946 ml","prijs":45.95,"unit":"st","img":433070688,"perOrder":true},"multi_cleaner":{"vid":"284824378","url":"303-multi-surface-cleaner.html","naam":"303 Multi Surface Cleaner","prijs":21.95,"unit":"st","img":401350793,"perOrder":true},"zeilnaalden":{"vid":"255046148","url":"prym-zeilnaalden-set-van-5-naalden.html","naam":"Prym zeilnaalden (set van 5)","prijs":4.95,"unit":"st","img":387325003,"perOrder":true},"zuignap":{"vid":"314190231","url":"zuignap-met-lip-50-mm-transparant-m4-x-10-mm-met-t.html","naam":"Zuignap met lip 50 mm transparant (M4)","prijs":1.67,"unit":"st","img":478528474},"stansblok":{"vid":"299203891","url":"stansblok-nylon-rood-15-x-15-x-25-cm.html","naam":"Nylon stansblok 15 \u00d7 15 cm","prijs":16.95,"unit":"st","img":454744147,"perOrder":true,"tool":true}},"ritsen":{"bloktand":{"100":{"vid":"256147823","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 1 m","prijs":9.99,"unit":"st"},"150":{"vid":"256147828","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 \"Lengte : 1,5 m\"","prijs":11.81,"unit":"st"},"200":{"vid":"256147830","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 2 m","prijs":13.62,"unit":"st"},"250":{"vid":"256147834","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 \"Lengte : 2,5 m\"","prijs":15.44,"unit":"st"},"300":{"vid":"302671813","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 3 m","prijs":17.24,"unit":"st"},"350":{"vid":"280523686","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 3,5 m","prijs":18.65,"unit":"st"},"600":{"vid":"260460194","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 6 m","prijs":28.14,"unit":"st"},"1000":{"vid":"260460120","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 10 m","prijs":42.65,"unit":"st"},"1200":{"vid":"281954992","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 12 m","prijs":44.98,"unit":"st"},"1500":{"vid":"281968323","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 15 m","prijs":59.95,"unit":"st"},"2000":{"vid":"260460128","url":"ykk-rits-bloktand-deelbaar-10mm-zwart.html","naam":"Rits Bloktand \u2014 Lengte : 20 m","prijs":78.95,"unit":"st"}},"spiraal":{"100":{"vid":"256059607","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 100 cm","prijs":8.99,"unit":"st"},"150":{"vid":"256059624","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 150 cm","prijs":10.54,"unit":"st"},"200":{"vid":"256059634","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 200 cm","prijs":12,"unit":"st"},"250":{"vid":"256059643","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 250 cm","prijs":13.93,"unit":"st"},"300":{"vid":"256059651","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 300 cm","prijs":15.84,"unit":"st"},"350":{"vid":"256059664","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 350 cm","prijs":16.25,"unit":"st"},"400":{"vid":"256059669","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 400 cm","prijs":17.22,"unit":"st"},"450":{"vid":"256059673","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 450 cm","prijs":17.86,"unit":"st"},"500":{"vid":"256059685","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 500 cm","prijs":19.21,"unit":"st"},"600":{"vid":"256059695","url":"ykk-rits-spiraal-deelbaar-10mm-zwart.html","naam":"Rits Spiraal \u2014 Size : 6 m","prijs":21.97,"unit":"st"}}}};
});

;
/* =====================================================================
   eSails Keuzehulp \u2014 PAKKET
   Zet een project (\u00e9\u00e9n of meer geconfigureerde items) om in exacte
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

  /* ---------------- berekening voor \u00e9\u00e9n item ---------------- */
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
    var r = { key: key, vid: String(prod.vid), url: prod.url, naam: prod.naam, unit: prod.unit || 'st', prijs: prod.prijs,
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
      R.add('doek', { vid: b.dk.kleur.vid, url: b.dk.kleur.url, naam: b.dk.doek.naam + ' \u2014 ' + b.dk.kleur.naam, prijs: b.dk.kleur.prijs, unit: 'm', img: b.dk.kleur.img },
        b.plan.meters, 'Snijplan: ' + b.plan.stukken.length + ' stuk(ken) op een rol van ' + b.dk.doek.rolCm + ' cm breed, incl. zoom en snijmarge.', { groep: 'doek' });
    }

    /* verwerking */
    if (item.verwerking === 'lijmen') {
      var gram = C.lijmGram(b.naadCm + b.randCm); // naden + omgezette zoom
      if (gram <= 200) R.add('lijm', R.p('saba_250'), 1, 'Voor \u00b1' + Math.round(gram) + ' g lijm (naden + zoom).', { groep: 'verwerking' });
      else R.add('lijm', R.p('saba_1l'), Math.ceil(gram / 900), 'Voor \u00b1' + Math.round(gram) + ' g lijm (naden + zoom).', { groep: 'verwerking' });
      if (item.ontvetter !== false) R.add('ontvetter', R.p('griffon_cleaner'), 1, 'Ontvet de lijmnaden vooraf: essentieel voor een waterdichte hechting.', { groep: 'verwerking' });
    } else if (item.garen) {
      var garen = cat.garen[item.garen];
      if (garen) {
        var klossen = Math.max(1, Math.ceil((b.stikCm / 100) * 5 / 800)); // dubbele stiknaad, ~2,5x draad per naadmeter, 800 m per klos
        R.add('garen', garen, klossen, 'UV-bestendig garen, \u00b1' + Math.round(b.stikCm / 100) + ' m stiknaad.', { groep: 'verwerking' });
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
          R.add('loxx_moer', R.p('loxx_moer_rvs'), n, 'E\u00e9n moer per bout.', { groep: 'bevestiging' });
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
        R.add('ring', R.p('ring_10_rvs'), n, 'E\u00e9n zeilring per zuignap: voorkomt uitscheuren.', { groep: 'bevestiging' });
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
      if (mm >= 31) R.add('mallendoek', R.p('mallendoek_rol'), Math.ceil(mm / 50), 'Voordeliger dan ' + mm + ' losse meters.', { groep: 'extra' });
      else R.add('mallendoek', R.p('mallendoek'), mm, 'Voor een mal van \u00b1' + (b.model.oppervlakM2 * b.aantal).toFixed(1).replace('.', ',') + ' m\u00b2, 300 cm breed.', { groep: 'extra' });
    }
    if (x.raamfolie && x.raamfolie.breedte > 0 && x.raamfolie.hoogte > 0) {
      var rf = x.raamfolie;
      var fplan = C.snijplan([{ naam: 'Raam', w: C.num(rf.breedte, 10, 500), h: C.num(rf.hoogte, 10, 200), qty: Math.max(1, rf.aantal || 1) * b.aantal }], cat.p.raamfolie.rolCm, { zoomCm: 3 });
      R.add('raamfolie', R.p(rf.soort === 'smoke' ? 'raamfolie_05' : 'raamfolie'), fplan.meters, (rf.aantal || 1) + '\u00d7 raam ' + rf.breedte + ' \u00d7 ' + rf.hoogte + ' cm, rol 137 cm.', { groep: 'extra' });
      if (rf.tape) R.add('tape', R.p('tape_' + rf.tape), 1, 'Om de raamfolie v\u00f3\u00f3r het stikken op zijn plaats te houden.', { groep: 'extra' });
    }
    (x.ritsen || []).forEach(function (rz, i) {
      var r = cat.ritsen[rz.type] && cat.ritsen[rz.type][String(rz.lengte)];
      if (r) R.add('rits_' + rz.type + '_' + rz.lengte, r, (rz.aantal || 1) * b.aantal, 'Deelbare rits, ' + (rz.lengte / 100).toFixed(1).replace('.', ',') + ' m.', { groep: 'extra' });
    });
    if (x.trekband && x.trekband.sets > 0) {
      var s = x.trekband.sets * b.aantal;
      R.add('band', R.p('band_25_zwart'), s, '1 m band per trekbandje.', { groep: 'extra' });
      R.add('klemgesp', R.p('klemgesp'), s, 'E\u00e9n klemgesp per trekbandje.', { groep: 'extra' });
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

;
/* =====================================================================
   eSails Keuzehulp \u2014 LIVE (prijzen, voorraad, winkelwagen, tracking)
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

  /* Voegt regels \u00e9\u00e9n voor \u00e9\u00e9n toe (sequentieel, met retry) en controleert daarna. */
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

;
(function(w){w.ESKH_CSS=".eskh{--eskh-primary:#0f1c3f;--eskh-primary-2:#1d2f5e;--eskh-cta:#0f1c3f;--eskh-cta-text:#fff;--eskh-accent:#e8a33d;--eskh-text:#16181d;--eskh-muted:#5d6470;--eskh-line:#e3e5e9;--eskh-soft:#f5f6f8;--eskh-ok:#1f7a3f;--eskh-warn:#a86400;--eskh-bad:#b42318;--eskh-radius:10px;font-family:inherit;color:var(--eskh-text);background:#fff;max-width:960px;margin:24px auto;padding:24px;border:1px solid var(--eskh-line);border-radius:var(--eskh-radius);box-sizing:border-box;line-height:1.5;font-size:15px}.eskh *,.eskh *::before,.eskh *::after{box-sizing:border-box}.eskh button{font:inherit}.eskh .eskh-card,.eskh .eskh-color,.eskh .eskh-pill,.eskh .eskh-chip,.eskh .eskh-btn-ghost,.eskh .eskh-stepper button,.eskh .eskh-item-acts button{color:var(--eskh-text)}.eskh .eskh-btn-primary,.eskh .eskh-pill.is-active{color:#fff}.eskh .eskh-btn-cta{color:var(--eskh-cta-text)}.eskh .eskh-link,.eskh .eskh-btn-link{color:var(--eskh-primary)}.eskh h2{margin:0 0 4px;font-size:24px;line-height:1.25}.eskh h3{margin:0 0 6px;font-size:19px}.eskh h4{margin:0 0 4px;font-size:15.5px}.eskh p{margin:0}.eskh-head{margin-bottom:18px}.eskh-head p{color:var(--eskh-muted)}.eskh-progress{height:6px;background:var(--eskh-soft);border-radius:99px;margin:14px 0 6px;overflow:hidden}.eskh-progress div{height:100%;background:var(--eskh-primary);border-radius:99px;transition:width .3s ease}.eskh-stepname{font-size:13px;color:var(--eskh-muted);font-weight:600}.eskh-sub{color:var(--eskh-muted);margin-bottom:14px!important}.eskh-mt{margin-top:26px!important}.eskh-grid{display:grid;gap:12px;margin-top:12px}.eskh-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}.eskh-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.eskh-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;padding:16px;background:#fff;border:1.5px solid var(--eskh-line);border-radius:var(--eskh-radius);cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s;min-height:100%}.eskh-card:hover{border-color:#b9bfc9;box-shadow:0 4px 14px rgba(15,28,63,.07)}.eskh-card:focus-visible,.eskh-pill:focus-visible,.eskh-color:focus-visible,.eskh-btn:focus-visible,.eskh-switch:focus-visible,.eskh-chip:focus-visible{outline:3px solid var(--eskh-accent);outline-offset:2px}.eskh-card.is-active{border-color:var(--eskh-primary);box-shadow:0 0 0 2px var(--eskh-primary) inset}.eskh-card.is-active::after{content:\"\u2713\";position:absolute;top:10px;right:12px;width:22px;height:22px;border-radius:50%;background:var(--eskh-primary);color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center}.eskh-card p{color:var(--eskh-muted);font-size:13.5px}.eskh-ico{font-size:26px;line-height:1;margin-bottom:6px}.eskh-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;background:var(--eskh-primary);color:#fff;padding:3px 8px;border-radius:99px;margin-bottom:8px}.eskh-badge-alt{background:var(--eskh-accent);color:#1b1300}.eskh-specs{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:8px 0 6px}.eskh-specs li{font-size:12px;background:var(--eskh-soft);border-radius:6px;padding:2px 8px;color:var(--eskh-muted)}.eskh-price{font-size:13.5px;color:var(--eskh-muted)}.eskh-price strong{color:var(--eskh-text);font-size:16px}.eskh-colors{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px;margin-top:10px}.eskh-color{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;border:1.5px solid var(--eskh-line);border-radius:var(--eskh-radius);background:#fff;cursor:pointer;text-align:center}.eskh-color.is-active{border-color:var(--eskh-primary);box-shadow:0 0 0 2px var(--eskh-primary) inset}.eskh-color.is-out{opacity:.45;cursor:not-allowed}.eskh-swatch{display:block;width:100%;aspect-ratio:1/1;border-radius:7px;overflow:hidden;border:1px solid rgba(0,0,0,.08)}.eskh-swatch img{width:100%;height:100%;object-fit:cover;display:block}.eskh-color-name{font-size:12.5px;line-height:1.25}.eskh-stock{display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:99px;margin-left:4px}.eskh-stock-ok{background:#e6f4ea;color:var(--eskh-ok)}.eskh-stock-wait{background:#fff4e0;color:var(--eskh-warn)}.eskh-stock-out{background:#fde8e6;color:var(--eskh-bad)}.eskh-fields{display:grid;gap:14px}.eskh-field label{display:block;font-weight:600;margin-bottom:6px;font-size:14px}.eskh-field-row{display:flex;align-items:center;gap:14px}.eskh-field-row input[type=range]{flex:1;accent-color:var(--eskh-primary);min-width:0}.eskh input[type=range]{width:100%;accent-color:var(--eskh-primary)}.eskh-num{display:inline-flex;align-items:center;border:1.5px solid var(--eskh-line);border-radius:8px;background:#fff;overflow:hidden}.eskh-num input{width:84px;border:0;padding:9px 6px 9px 10px;font:inherit;font-size:16px;text-align:right;background:transparent;-moz-appearance:textfield}.eskh-num em{font-style:normal;color:var(--eskh-muted);padding-right:10px;font-size:13px}.eskh-field.is-error .eskh-num{border-color:var(--eskh-bad)}.eskh-err{color:var(--eskh-bad);font-size:12.5px;display:block;margin-top:4px}.eskh-note{background:var(--eskh-soft);border-radius:var(--eskh-radius);padding:12px 14px;font-size:13.5px;color:var(--eskh-muted);margin-top:14px!important}.eskh-note strong{color:var(--eskh-text)}.eskh-box{border:1px solid var(--eskh-line);border-radius:var(--eskh-radius);padding:14px 16px;margin-top:14px;display:grid;gap:12px}.eskh-toggle-row{display:flex;justify-content:space-between;align-items:center;gap:16px}.eskh-toggle-row span{display:block;color:var(--eskh-muted);font-size:13.5px}.eskh-switch{flex:0 0 auto;width:48px;height:28px;border-radius:99px;border:0;background:#cfd3da;position:relative;cursor:pointer;transition:background .2s}.eskh-switch span{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}.eskh-switch.is-on{background:var(--eskh-primary)}.eskh-switch.is-on span{transform:translateX(20px)}.eskh-pills{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.eskh-pills-label{font-size:13px;font-weight:600;color:var(--eskh-muted);min-width:120px}.eskh-pill{border:1.5px solid var(--eskh-line);background:#fff;border-radius:99px;padding:7px 13px;font-size:13.5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.eskh-pill.is-active{border-color:var(--eskh-primary);background:var(--eskh-primary);color:#fff}.eskh-pill:disabled{opacity:.4;cursor:not-allowed;text-decoration:line-through}.eskh-dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.15)}.eskh-subgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.eskh-subgrid label{font-size:13px;font-weight:600;display:grid;gap:6px}.eskh-rits{border-top:1px dashed var(--eskh-line);padding-top:10px;display:grid;gap:8px}.eskh-stepper{display:inline-flex;align-items:center;border:1.5px solid var(--eskh-line);border-radius:8px;overflow:hidden;background:#fff}.eskh-stepper button{border:0;background:var(--eskh-soft);width:34px;height:36px;font-size:18px;cursor:pointer}.eskh-stepper input{width:52px;height:36px;border:0;text-align:center;font:inherit;font-size:15px;-moz-appearance:textfield}.eskh input[type=number]::-webkit-inner-spin-button,.eskh input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.eskh-preview{display:grid;grid-template-columns:200px 1fr;gap:18px;align-items:center;background:var(--eskh-soft);border-radius:var(--eskh-radius);padding:14px 16px;margin-bottom:18px}.eskh-obj{width:100%;height:auto;max-height:150px}.eskh-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.eskh-stat{background:#fff;border:1px solid var(--eskh-line);border-radius:8px;padding:10px;text-align:center}.eskh-stat small{display:block;color:var(--eskh-muted);font-size:12px}.eskh-stat strong{font-size:18px}.eskh-plan{margin-top:10px}.eskh-plan summary{cursor:pointer;font-size:13.5px;font-weight:600;color:var(--eskh-primary)}.eskh-plan summary span{font-weight:400;color:var(--eskh-muted)}.eskh-plan-svg{display:block;width:100%;max-width:340px;height:auto;margin-top:10px}.eskh-nav{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid var(--eskh-line)}.eskh-btn{border:1.5px solid transparent;border-radius:8px;padding:11px 20px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:15px}.eskh-btn-sm{padding:7px 12px;font-size:13.5px}.eskh-btn-primary{background:var(--eskh-primary);color:#fff}.eskh-btn-primary.is-disabled{background:#b8bec9;color:#fff}.eskh-btn-ghost{background:#fff;border-color:var(--eskh-line)}.eskh-btn-ghost:disabled{opacity:.4;cursor:default}.eskh-btn-link{background:none;color:var(--eskh-primary);text-decoration:underline;padding:8px}.eskh-btn-cta{background:var(--eskh-cta);color:var(--eskh-cta-text);font-size:16px;padding:14px 26px;min-width:240px}.eskh-btn-cta:disabled{opacity:.6;cursor:wait}.eskh-link{background:none;border:0;color:var(--eskh-primary);text-decoration:underline;cursor:pointer;padding:4px 0;font-size:13.5px}.eskh-melding{margin-top:14px;padding:12px 14px;border-radius:8px;background:#fff4e0;border:1px solid #f1d39b;color:#5c3b00;font-size:14px}.eskh-melding ul{margin:6px 0 10px 18px;padding:0}.eskh-item{border:1px solid var(--eskh-line);border-radius:var(--eskh-radius);padding:12px 14px;margin-bottom:10px}.eskh-item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.eskh-item-head span{display:block;color:var(--eskh-muted);font-size:13px}.eskh-item-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.eskh-item-acts button{border:1px solid var(--eskh-line);background:#fff;border-radius:6px;padding:4px 10px;font-size:12.5px;cursor:pointer}.eskh-item-acts button:hover{border-color:var(--eskh-primary)}.eskh-add{width:100%;margin:4px 0 18px}.eskh-board{border:1px solid var(--eskh-line);border-radius:var(--eskh-radius);overflow:hidden}.eskh-board-head{display:grid;grid-template-columns:1fr 150px 110px;gap:12px;padding:10px 14px;background:var(--eskh-soft);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--eskh-muted)}.eskh-board-head span:nth-child(n+2){text-align:right}.eskh-group{padding:8px 14px 4px;font-size:12px;font-weight:700;color:var(--eskh-primary);text-transform:uppercase;letter-spacing:.4px;border-top:1px solid var(--eskh-line)}.eskh-line{display:grid;grid-template-columns:1fr 150px 110px;gap:12px;align-items:center;padding:10px 14px}.eskh-line + .eskh-line{border-top:1px dashed var(--eskh-line)}.eskh-line.is-zero{opacity:.5}.eskh-line.is-out{background:#fff8f7}.eskh-line-info{display:flex;gap:10px;align-items:flex-start;min-width:0}.eskh-line-info img{width:44px;height:44px;border-radius:6px;object-fit:cover;flex:0 0 auto;border:1px solid var(--eskh-line)}.eskh-line-info a{color:var(--eskh-text);font-weight:600;text-decoration:none;font-size:14px}.eskh-line-info a:hover{text-decoration:underline}.eskh-line-info p{color:var(--eskh-muted);font-size:12.5px}.eskh-line-qty{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.eskh-line-qty small,.eskh-line-price small{color:var(--eskh-muted);font-size:11.5px;display:block}.eskh-line-price{text-align:right;font-weight:700}.eskh-suggest{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.eskh-chip{text-align:left;border:1.5px solid var(--eskh-line);background:#fff;border-radius:8px;padding:9px 11px;cursor:pointer;font-size:13px}.eskh-chip em{font-style:normal;font-weight:700;float:right}.eskh-chip small{display:block;color:var(--eskh-muted);font-size:12px}.eskh-chip.is-active{border-color:var(--eskh-primary);box-shadow:0 0 0 1px var(--eskh-primary) inset}.eskh-total{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-top:18px;padding:16px;border-radius:var(--eskh-radius);background:var(--eskh-soft)}.eskh-total span{display:block;font-size:13px;color:var(--eskh-muted)}.eskh-total strong{font-size:26px}.eskh-total small{display:block;color:var(--eskh-muted);font-size:12px}.eskh-share{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px}.eskh-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:eskh-spin .8s linear infinite}@keyframes eskh-spin{to{transform:rotate(360deg)}}@media (max-width:720px){.eskh{padding:16px;margin:12px auto;border-radius:0;border-left:0;border-right:0}.eskh-grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}.eskh-preview{grid-template-columns:1fr;gap:10px}.eskh-obj{max-height:110px}.eskh-subgrid{grid-template-columns:1fr}.eskh-board-head{display:none}.eskh-line{grid-template-columns:1fr auto;grid-template-areas:\"info info\" \"qty price\"}.eskh-line-info{grid-area:info}.eskh-line-qty{grid-area:qty;align-items:flex-start}.eskh-line-price{grid-area:price}.eskh-item-head{flex-direction:column}.eskh-btn-cta{width:100%}.eskh-pills-label{min-width:100%}.eskh-nav{position:sticky;bottom:0;background:#fff;padding-bottom:10px;z-index:3}}@media (max-width:420px){.eskh-grid-2,.eskh-grid-3{grid-template-columns:1fr}.eskh-stats{gap:6px}.eskh-stat strong{font-size:15px}}@media print{.eskh-nav,.eskh-add,.eskh-item-acts,.eskh-share,.eskh-btn,.eskh-stepper button,.eskh-suggest .eskh-chip:not(.is-active){display:none!important}.eskh{border:0;max-width:none}.eskh-plan{display:block}}";})(window);
;
/* =====================================================================
   eSails Keuzehulp \u2014 UI (wizard)
   Mount: <div id="esails-keuzehulp"></div>
   Optioneel: data-module="bootkap|afdekzeil|zonwering" of ?keuzehulp=bootkap
   om direct een module te openen.
   ===================================================================== */
(function (root) {
  'use strict';
  var C = root.EsailsCore, P = root.EsailsPakket, CAT = root.EsailsCatalog, LIVE = root.EsailsLive;
  var MOUNT_IDS = ['esails-keuzehulp', 'esails-wizard-mount', 'esails-jacuzzi-mount', 'esails-zonwering-mount'];
  var STORE_KEY = 'eskh_state_v1';
  var TELEFOON = '023-5329517';

  /* ------------------------------------------------------------------
     Content per module / vorm
     ------------------------------------------------------------------ */
  var MODULE_KAART = {
    bootkap:   { icon: '\u26f5', titel: 'Bootkap & dekzeil', tekst: 'Buiskap, achtertent, bimini of winterkleed voor je boot.' },
    afdekzeil: { icon: '\ud83d\udecb\ufe0f', titel: 'Afdekzeil op maat', tekst: 'Waterdichte hoes voor tuinset, bbq, jacuzzi, aanhanger en meer.' },
    zonwering: { icon: '\u2600\ufe0f', titel: 'Zonwering', tekst: 'Zon- en hittewerend gaasdoek voor raam of balkon.' }
  };

  /* Objecten in de afdekzeil-module: kiezen zet vorm + startmaten */
  var OBJECTEN = [
    { key: 'loungeset', icon: '\ud83d\udecb\ufe0f', titel: 'Loungeset / tuinbank', vorm: 'blok', maten: { lengte: 200, breedte: 90, hoogte: 75 } },
    { key: 'tuintafel', icon: '\ud83e\ude91', titel: 'Tuintafel (rechthoekig)', vorm: 'blok', maten: { lengte: 180, breedte: 90, hoogte: 75 } },
    { key: 'bbq_rond', icon: '\ud83d\udd25', titel: 'Kogelbarbecue / ronde tafel', vorm: 'rond', maten: { diameter: 60, hoogte: 100 } },
    { key: 'bbq_blok', icon: '\ud83c\udf56', titel: 'Barbecue / buitenkeuken', vorm: 'blok', maten: { lengte: 140, breedte: 60, hoogte: 110 } },
    { key: 'jacuzzi', icon: '\u2668\ufe0f', titel: 'Jacuzzi / hottub', vorm: 'jacuzzi', maten: { lengte: 213, breedte: 213, radius: 30, hoogte: 25 } },
    { key: 'plat', icon: '\ud83d\ude9a', titel: 'Plat zeil (aanhanger, hout, kist)', vorm: 'plat', maten: { lengte: 250, breedte: 150, overhang: 15 } }
  ];

  var VORM_KAART = {
    buiskap: { icon: '\u26f5', tekst: 'Kap over de kuip, met dak, zijkanten en voorkant.' },
    bimini:  { icon: '\u2600\ufe0f', tekst: 'Zonnedak op een frame. Licht en snel op te zetten.' },
    dekzeil: { icon: '\u2693', tekst: 'Plat zeil over de boot: 100% waterdicht in de winter.' },
    raam:    { icon: '\ud83e\ude9f', tekst: 'Tegen het glas met zuignappen. Geen boren, zo weer weg.', badge: 'Geen boren' },
    balkon:  { icon: '\ud83c\udfd9\ufe0f', tekst: 'Met elastiek langs spijlen of railing. Beweegt mee met de wind.', badge: 'Voor railing' }
  };

  /* Maatvelden per model */
  var MAATVELDEN = {
    buiskap: [['lengte', 'Lengte van de kap', 50, 800, 5], ['breedte', 'Breedte van de kap', 50, 500, 5], ['hoogte', 'Hoogte (dek tot dak)', 30, 250, 5]],
    bimini:  [['lengte', 'Lengte van het dak', 50, 600, 5], ['breedte', 'Breedte van het dak', 50, 400, 5]],
    plat:    [['lengte', 'Lengte', 30, 2000, 5], ['breedte', 'Breedte', 30, 1000, 5], ['overhang', 'Overhang rondom', 0, 100, 5]],
    blok:    [['lengte', 'Lengte', 20, 600, 1], ['breedte', 'Diepte / breedte', 20, 400, 1], ['hoogte', 'Hoogte (rok)', 5, 250, 1]],
    rond:    [['diameter', 'Diameter', 20, 400, 1], ['hoogte', 'Hoogte (rok)', 5, 200, 1]],
    jacuzzi: [['lengte', 'Lengte', 100, 400, 1], ['breedte', 'Breedte', 100, 400, 1], ['radius', 'Hoekradius', 0, 80, 1], ['hoogte', 'Hoogte van de rok', 5, 60, 1]],
    zonwering: [['breedte', 'Breedte', 20, 600, 1], ['hoogte', 'Hoogte', 20, 400, 1]]
  };
  var MEETTIP = {
    buiskap: '<strong>Zo meet je:</strong> lengte = van voorkant tot achterkant van de kap (over de beugels gemeten wij zelf de welving mee). Breedte = buitenmaat over de kuip. Hoogte = van dek tot het hoogste punt van het dak.',
    bimini: '<strong>Zo meet je:</strong> meet het frame van buitenbeugel tot buitenbeugel. De welving rekenen wij mee.',
    plat: '<strong>Zo meet je:</strong> lengte \u00d7 breedte van wat je afdekt. De overhang komt er rondom bij, zodat het zeil netjes over de rand valt.',
    blok: '<strong>Zo meet je:</strong> meet de buitenmaten op het breedste punt (ook kussens en armleuningen). Rokhoogte = hoe ver de hoes naar beneden valt; tot net boven de grond voorkomt opwaaien.',
    rond: '<strong>Zo meet je:</strong> diameter op het breedste punt (bij een bbq inclusief handvatten). Rokhoogte = hoe ver de hoes naar beneden valt.',
    jacuzzi: '<strong>Hoekradius meten:</strong> leg twee latten haaks tegen de zijkanten. De afstand van hun kruispunt tot waar de rand begint te buigen is je radius. Rechthoekige bak = 0.',
    zonwering: '<strong>Zo meet je:</strong> bij een raam het glas dat je wilt afdekken; bij een balkon van spijl tot spijl en de hoogte van de railing.'
  };

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  var S, root$;
  function nieuwItem(module) {
    return { module: module || null, vorm: null, object: null, maten: {}, aantal: 1, doek: null, kleur: null,
             verwerking: null, garen: null, bevestiging: null, opt: {}, afstandCm: null, gereedschap: true, extras: {} };
  }
  function resetState() {
    S = { stap: 'module', draft: nieuwItem(), editIdx: -1, items: [], onderhoud: {}, overrides: {}, bezig: false, melding: null };
  }
  function bewaar() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ t: Date.now(), items: S.items, onderhoud: S.onderhoud, overrides: S.overrides, draft: S.draft, stap: S.stap, editIdx: S.editIdx })); } catch (e) { }
  }
  function herstel() {
    var bron = null;
    var m = /[#&]kh=([^&]+)/.exec(location.hash || '');
    if (m) { try { bron = JSON.parse(decodeURIComponent(escape(atob(m[1])))); bron.gedeeld = true; } catch (e) { bron = null; } }
    if (!bron) { try { bron = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { bron = null; } }
    if (!bron || (!bron.gedeeld && bron.t < Date.now() - 14 * 864e5)) return false;
    var items = (bron.items || []).filter(geldigItem);
    if (!items.length && !(bron.draft && bron.draft.module)) return false;
    S.items = items; S.onderhoud = bron.onderhoud || {}; S.overrides = bron.overrides || {};
    if (bron.gedeeld || !bron.draft || !bron.draft.module) { S.stap = items.length ? 'overzicht' : 'module'; }
    else { S.draft = bron.draft; S.stap = bron.stap || 'module'; S.editIdx = bron.editIdx != null ? bron.editIdx : -1; }
    if (S.stap !== 'overzicht' && stappen().indexOf(S.stap) < 0) S.stap = 'module';
    return true;
  }
  function geldigItem(it) {
    try { return !!(it && P.MODULES[it.module] && P.MODULES[it.module].vormen[it.vorm] && P.doekKleur(CAT, it) && it.bevestiging && P.regelsVoorItem(it, CAT)); }
    catch (e) { return false; }
  }
  function deelLink() {
    var data = { items: S.items, onderhoud: S.onderhoud, overrides: S.overrides };
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    return location.origin + location.pathname + location.search + '#kh=' + b64;
  }

  /* ------------------------------------------------------------------
     Stappen
     ------------------------------------------------------------------ */
  function stappen() {
    var m = S.draft.module;
    if (!m) return ['module'];
    if (m === 'bootkap') return ['module', 'vorm', 'maten', 'doek', 'verwerking', 'extras', 'bevestiging'];
    if (m === 'afdekzeil') return ['module', 'vorm', 'maten', 'doek', 'verwerking', 'bevestiging'];
    return ['module', 'vorm', 'maten', 'doek', 'bevestiging'];
  }
  var STAPNAAM = { module: 'Wat ga je maken?', vorm: 'Type', maten: 'Afmetingen', doek: 'Doek & kleur', verwerking: 'Verwerking', extras: "Extra's", bevestiging: 'Bevestiging', overzicht: 'Jouw pakket' };

  function vormDef() { var m = P.MODULES[S.draft.module]; return m && m.vormen[S.draft.vorm]; }
  function modelKey() { var d = vormDef(); return d && d.model; }

  function stapGeldig(stap) {
    var d = S.draft;
    switch (stap) {
      case 'module': return !!d.module;
      case 'vorm': return !!d.vorm;
      case 'maten': return (MAATVELDEN[modelKey()] || []).every(function (f) { var v = d.maten[f[0]]; return v != null && v !== '' && !isNaN(v) && v >= f[2] && v <= f[3]; });
      case 'doek': return !!(d.doek && d.kleur && P.doekKleur(CAT, d));
      case 'verwerking': return !!d.verwerking;
      case 'extras': {
        var x = d.extras || {};
        if (x.ritsen && x.ritsen.some(function (r) { return !r.type || !r.lengte; })) return false;
        return true;
      }
      case 'bevestiging': return !!d.bevestiging;
      default: return true;
    }
  }
  function ontbreekt(stap) {
    return { module: 'Kies wat je wilt maken.', vorm: 'Kies een type.', maten: 'Vul alle maten in (binnen het bereik).', doek: 'Kies een doek \u00e9n een kleur.',
             verwerking: 'Kies hoe je het doek verwerkt.', extras: 'Kies type en lengte voor elke rits.', bevestiging: 'Kies een bevestiging.' }[stap] || '';
  }

  function ga(stap) {
    S.stap = stap; S.melding = null;
    if (stap === 'overzicht') LIVE.track('keuzehulp_overzicht', { keuzehulp_items: S.items.length });
    else LIVE.track('keuzehulp_stap', { keuzehulp_stap: stap, keuzehulp_module: S.draft.module || '' });
    render(true);
  }
  function volgende() {
    var st = stappen(), i = st.indexOf(S.stap);
    if (!stapGeldig(S.stap)) { S.melding = ontbreekt(S.stap); render(); return; }
    if (i === st.length - 1) { opslaanDraft(); ga('overzicht'); return; }
    ga(st[i + 1]);
  }
  function vorige() {
    if (S.stap === 'overzicht') { if (S.items.length) return; }
    var st = stappen(), i = st.indexOf(S.stap);
    if (i > 0) ga(st[i - 1]);
  }
  function opslaanDraft() {
    var it = JSON.parse(JSON.stringify(S.draft));
    if (S.editIdx >= 0 && S.items[S.editIdx]) S.items[S.editIdx] = it; else S.items.push(it);
    S.editIdx = -1;
    LIVE.track('keuzehulp_item_klaar', { keuzehulp_module: it.module, keuzehulp_vorm: it.vorm });
  }

  /* ------------------------------------------------------------------
     Helpers (HTML)
     ------------------------------------------------------------------ */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function euro(n) { return '\u20ac ' + C.money(n); }
  function nl(n, d) { return Number(n).toFixed(d == null ? 1 : d).replace('.', ','); }
  function img(id, size) { return id ? CAT.imgBase + id + '/' + (size || '120x120x2') + '/image.jpg' : ''; }
  function live(vid) { return LIVE.info(vid); }
  function prijsVan(vid, fallback) { var l = live(vid); return l && l.prijs != null ? l.prijs : fallback; }
  function statusBadge(vid) {
    var l = live(vid);
    if (!l || !l.status) return '';
    if (l.status.code === 'voorraad') return '<span class="eskh-stock eskh-stock-ok">Op voorraad</span>';
    if (l.status.code === 'bestelling') return '<span class="eskh-stock eskh-stock-wait" title="' + esc(l.status.levertijd) + '">Op bestelling</span>';
    if (l.status.code === 'uitverkocht') return '<span class="eskh-stock eskh-stock-out">Niet leverbaar</span>';
    return '';
  }
  function uitverkocht(vid) { var l = live(vid); return !!(l && l.status && l.status.code === 'uitverkocht'); }

  function kaart(attrs, inhoud, actief, extraCls) {
    return '<button type="button" class="eskh-card' + (actief ? ' is-active' : '') + (extraCls ? ' ' + extraCls : '') + '" ' + attrs + ' aria-pressed="' + (actief ? 'true' : 'false') + '">' + inhoud + '</button>';
  }
  function pill(attrs, label, actief, disabled) {
    return '<button type="button" class="eskh-pill' + (actief ? ' is-active' : '') + '" ' + attrs + (disabled ? ' disabled' : '') + ' aria-pressed="' + (actief ? 'true' : 'false') + '">' + label + '</button>';
  }
  function toggleRij(key, titel, tekst, aan) {
    return '<div class="eskh-toggle-row"><div><strong>' + titel + '</strong><span>' + tekst + '</span></div>' +
      '<button type="button" class="eskh-switch' + (aan ? ' is-on' : '') + '" data-toggle="' + key + '" role="switch" aria-checked="' + (aan ? 'true' : 'false') + '"><span></span></button></div>';
  }
  function stepper(key, val, min, max, label) {
    return '<span class="eskh-stepper" role="group" aria-label="' + esc(label || 'Aantal') + '"><button type="button" data-step="' + key + '" data-d="-1" aria-label="Minder">\u2212</button>' +
      '<input type="number" inputmode="numeric" data-num="' + key + '" value="' + val + '" min="' + min + '" max="' + max + '" aria-label="' + esc(label || 'Aantal') + '">' +
      '<button type="button" data-step="' + key + '" data-d="1" aria-label="Meer">+</button></span>';
  }
  function getPath(path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, S.draft); }
  function setPath(path, val) {
    var ks = path.split('.'), o = S.draft;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */
  function render(scroll) {
    var st = stappen();
    var isOverzicht = S.stap === 'overzicht';
    var idx = st.indexOf(S.stap);
    var totaalStappen = S.draft.module ? st.length : 7;
    var pct = isOverzicht ? 100 : Math.round(((idx + 1) / (totaalStappen + 1)) * 100);
    var html = '<div class="eskh-head"><h2>' + (isOverzicht ? 'Jouw materiaalpakket' : 'eSails Keuzehulp') + '</h2>' +
      '<p>' + (isOverzicht ? 'Precies berekend op jouw maten. Pas aantallen aan of voeg nog iets toe.' : 'Stel in een paar stappen je complete materiaalpakket samen. Wij rekenen alles uit.') + '</p>' +
      '<div class="eskh-progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><div style="width:' + pct + '%"></div></div>' +
      '<div class="eskh-stepname">' + (isOverzicht ? 'Overzicht' : ('Stap ' + (idx + 1) + (S.draft.module ? ' van ' + st.length : '') + ' \u00b7 ' + STAPNAAM[S.stap])) + '</div></div>';

    if (!isOverzicht && S.draft.module && idx >= 2) html += previewHTML();
    html += '<div class="eskh-body" aria-live="polite">' + stapHTML() + '</div>';
    if (S.melding) html += '<div class="eskh-melding" role="alert">' + esc(S.melding) + '</div>';
    if (!isOverzicht) {
      var laatste = idx === st.length - 1 && !!S.draft.module;
      var toonVolgende = S.stap !== 'module' || !!S.draft.module;
      html += '<div class="eskh-nav">' +
        '<button type="button" class="eskh-btn eskh-btn-ghost" data-act="vorige"' + (idx <= 0 ? ' disabled' : '') + '>Vorige</button>' +
        (S.items.length ? '<button type="button" class="eskh-btn eskh-btn-link" data-act="naar-overzicht">Naar pakket (' + S.items.length + ')</button>' : '') +
        (toonVolgende ? '<button type="button" class="eskh-btn eskh-btn-primary' + (stapGeldig(S.stap) ? '' : ' is-disabled') + '" data-act="volgende" aria-disabled="' + (!stapGeldig(S.stap)) + '">' + (laatste ? 'Bekijk mijn pakket \u2192' : 'Volgende') + '</button>' : '<span></span>') + '</div>';
    }
    root$.innerHTML = html;
    bewaar();
    if (scroll) {
      var r = root$.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.5) root$.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    laadLive();
  }

  /* Live prijzen/voorraad ophalen voor wat nu zichtbaar is */
  var liveTimer = null;
  function laadLive() {
    var want = [];
    var d = S.draft;
    if (S.stap === 'doek' && d.vorm) {
      vormDef().doeken.forEach(function (key) {
        var dk = CAT.doeken[key]; if (!dk) return;
        want.push(dk.kleuren[0]);
        if (key === d.doek) dk.kleuren.forEach(function (k) { want.push(k); });
      });
    }
    if (S.stap === 'overzicht') pakket().regels.forEach(function (r) { want.push(r); });
    var missend = want.filter(function (w) { return !live(w.vid); });
    if (!missend.length) return;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      LIVE.verrijk(missend).then(function () { if (!S.bezig) render(); });
    }, 50);
  }

  function pakket() {
    var pk = P.bouwPakket({ items: S.items, onderhoud: Object.keys(S.onderhoud).map(function (k) { return { key: k, qty: S.onderhoud[k] }; }) }, CAT);
    pk.regels.forEach(function (r) {
      r.berekend = r.qty;
      if (S.overrides[r.vid] != null) r.qty = S.overrides[r.vid];
      r.prijsLive = prijsVan(r.vid, r.prijs);
    });
    return pk;
  }

  /* ---------------- live preview (snijplan) ---------------- */
  function previewHTML() {
    var d = S.draft;
    if (!d.vorm) return '';
    var item = previewItem();
    var b;
    try { b = P.berekenItem(item, CAT); } catch (e) { return ''; }
    var dk = b.dk;
    var kleur = dk ? dk.kleur.hex : '#c9ced6';
    var stats = '<div class="eskh-stat"><small>Oppervlak</small><strong>' + nl(b.model.oppervlakM2 * b.aantal) + ' m\u00b2</strong></div>' +
      '<div class="eskh-stat"><small>Doek nodig</small><strong>' + b.plan.meters + ' m</strong></div>' +
      (b.punten ? '<div class="eskh-stat"><small>Bevestigers</small><strong>' + b.punten + '</strong></div>' :
                  '<div class="eskh-stat"><small>Rand</small><strong>' + nl(b.randCm / 100) + ' m</strong></div>');
    var plan = snijplanSVG(b.plan, kleur);
    var rolTxt = dk ? dk.doek.naam + ', ' + dk.doek.rolCm + ' cm breed' : 'indicatie bij ' + b.plan.rolCm + ' cm rolbreedte';
    return '<div class="eskh-preview"><div class="eskh-preview-vis">' + objectSVG(d, kleur) + '</div>' +
      '<div class="eskh-preview-info"><div class="eskh-stats">' + stats + '</div>' +
      '<details class="eskh-plan"><summary>Bekijk snijplan <span>(' + esc(rolTxt) + ')</span></summary>' + plan + '</details></div></div>';
  }
  function previewItem() {
    var d = JSON.parse(JSON.stringify(S.draft));
    var def = vormDef();
    (MAATVELDEN[def.model] || []).forEach(function (f) { if (d.maten[f[0]] == null || isNaN(d.maten[f[0]])) d.maten[f[0]] = f[2]; });
    if (!d.doek || !CAT.doeken[d.doek]) d.doek = def.doeken[0];
    if (!P.doekKleur(CAT, d)) d.kleur = CAT.doeken[d.doek].kleuren[0].vid;
    return d;
  }
  function snijplanSVG(plan, kleur) {
    var W = 300, sc = W / plan.rolCm, H = Math.max(40, plan.lengteCm * sc);
    var maxH = 420; if (H > maxH) { sc = sc * maxH / H; H = maxH; }
    var w = plan.rolCm * sc;
    var s = '<svg class="eskh-plan-svg" viewBox="0 0 ' + (w + 2) + ' ' + (H + 22) + '" role="img" aria-label="Snijplan">' +
      '<rect x="1" y="1" width="' + w + '" height="' + (plan.lengteCm * sc) + '" fill="#f3f4f6" stroke="#9aa1ab" stroke-dasharray="4 3"/>';
    plan.stukken.forEach(function (p) {
      s += '<rect x="' + (1 + p.x * sc) + '" y="' + (1 + p.y * sc) + '" width="' + Math.max(1, p.w * sc - 1) + '" height="' + Math.max(1, p.h * sc - 1) + '" fill="' + kleur + '" fill-opacity=".85" stroke="#fff"/>';
      if (p.w * sc > 46 && p.h * sc > 16) s += '<text x="' + (1 + p.x * sc + 4) + '" y="' + (1 + p.y * sc + 13) + '" font-size="10" fill="' + (isLicht(kleur) ? '#111' : '#fff') + '">' + esc(p.naam.replace(/ \(baan.*\)/, '')) + '</text>';
    });
    s += '<text x="1" y="' + (H + 16) + '" font-size="11" fill="#555">Rol ' + plan.rolCm + ' cm breed \u00b7 ' + nl(plan.lengteCm / 100, 2) + ' m lang \u2192 ' + plan.meters + ' m besteld</text></svg>';
    return s;
  }
  function isLicht(hex) {
    var h = String(hex).replace('#', ''); if (h.length !== 6) return false;
    return (0.299 * parseInt(h.substr(0, 2), 16) + 0.587 * parseInt(h.substr(2, 2), 16) + 0.114 * parseInt(h.substr(4, 2), 16)) > 170;
  }
  /* eenvoudige illustratie van het object, schaalt mee met de maten */
  function objectSVG(d, kleur) {
    var m = d.maten || {}, mk = modelKey(), stroke = isLicht(kleur) ? '#9aa1ab' : 'none';
    var s = '<svg viewBox="0 0 220 160" class="eskh-obj" aria-hidden="true">';
    if (mk === 'blok' || mk === 'buiskap') {
      var L = C.num(m.lengte || 100, 20, 800), B = C.num(m.breedte || 60, 20, 500), Hh = C.num(m.hoogte || 60, 5, 250);
      var sc = 120 / Math.max(L + B * 0.5, Hh + B * 0.5);
      var l = L * sc, b = B * sc * 0.5, h = Hh * sc, x = 110 - (l + b) / 2, y = 140;
      s += '<polygon points="' + [x, y, x + l, y, x + l, y - h, x, y - h].join(' ') + '" fill="' + kleur + '" stroke="' + stroke + '"/>' +
           '<polygon points="' + [x + l, y, x + l + b, y - b, x + l + b, y - b - h, x + l, y - h].join(' ') + '" fill="' + kleur + '" opacity=".75" stroke="' + stroke + '"/>' +
           '<polygon points="' + [x, y - h, x + l, y - h, x + l + b, y - b - h, x + b, y - b - h].join(' ') + '" fill="' + kleur + '" opacity=".9" stroke="' + stroke + '"/>';
      if (mk === 'buiskap') s += '<rect x="' + (x + l * 0.08) + '" y="' + (y - h * 0.8) + '" width="' + (l * 0.84) + '" height="' + (h * 0.38) + '" rx="3" fill="#dfe9ef" opacity=".85"/>';
    } else if (mk === 'rond') {
      var D = C.num(m.diameter || 60, 20, 400), Hr = C.num(m.hoogte || 60, 5, 200), sr = 110 / Math.max(D, Hr * 1.2);
      var rx = D * sr / 2, ry = rx * 0.3, hr = Hr * sr;
      s += '<rect x="' + (110 - rx) + '" y="' + (130 - hr) + '" width="' + (2 * rx) + '" height="' + hr + '" fill="' + kleur + '" opacity=".8"/>' +
           '<ellipse cx="110" cy="130" rx="' + rx + '" ry="' + ry + '" fill="' + kleur + '" opacity=".8"/>' +
           '<ellipse cx="110" cy="' + (130 - hr) + '" rx="' + rx + '" ry="' + ry + '" fill="' + kleur + '" stroke="' + stroke + '"/>';
    } else if (mk === 'jacuzzi') {
      var Lj = C.num(m.lengte || 200, 100, 400), Bj = C.num(m.breedte || 200, 100, 400), Rj = C.num(m.radius || 0, 0, 80), sj = 130 / Math.max(Lj, Bj);
      var wj = Lj * sj, hj = Bj * sj * 0.8, rj = Math.min(Rj * sj, wj / 2, hj / 2);
      s += '<rect x="' + (110 - wj / 2) + '" y="' + (80 - hj / 2) + '" width="' + wj + '" height="' + hj + '" rx="' + rj + '" fill="' + kleur + '" stroke="' + stroke + '"/>' +
           '<line x1="110" y1="' + (80 - hj / 2 + 4) + '" x2="110" y2="' + (80 + hj / 2 - 4) + '" stroke="#fff" stroke-opacity=".25"/>';
    } else {
      var Lp = C.num(m.lengte || m.breedte || 200, 20, 2000), Bp = C.num(m.breedte && mk !== 'zonwering' ? m.breedte : (m.hoogte || 100), 20, 1000), o = C.num(m.overhang || 0, 0, 100);
      var sp = 150 / Math.max(Lp + 2 * o, (Bp + 2 * o) * 1.2), wp = (Lp + 2 * o) * sp, hp = (Bp + 2 * o) * sp;
      if (d.vorm === 'raam') s += '<rect x="' + (110 - wp / 2 - 6) + '" y="' + (80 - hp / 2 - 6) + '" width="' + (wp + 12) + '" height="' + (hp + 12) + '" fill="#dfe9ef" stroke="#b9c4cb"/>';
      if (d.vorm === 'balkon') for (var i = 0; i <= 10; i++) s += '<line x1="' + (110 - wp / 2 + wp * i / 10) + '" y1="' + (80 - hp / 2 - 6) + '" x2="' + (110 - wp / 2 + wp * i / 10) + '" y2="' + (80 + hp / 2 + 6) + '" stroke="#c9ced3" stroke-width="2"/>';
      s += '<rect x="' + (110 - wp / 2) + '" y="' + (80 - hp / 2) + '" width="' + wp + '" height="' + hp + '" fill="' + kleur + '" opacity="' + (mk === 'zonwering' ? '.75' : '1') + '" stroke="' + stroke + '"/>';
      if (o > 0) s += '<rect x="' + (110 - wp / 2 + o * sp) + '" y="' + (80 - hp / 2 + o * sp) + '" width="' + (wp - 2 * o * sp) + '" height="' + (hp - 2 * o * sp) + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-dasharray="3 3"/>';
    }
    return s + '</svg>';
  }

  /* ---------------- stappen ---------------- */
  function stapHTML() {
    switch (S.stap) {
      case 'module': return stapModule();
      case 'vorm': return stapVorm();
      case 'maten': return stapMaten();
      case 'doek': return stapDoek();
      case 'verwerking': return stapVerwerking();
      case 'extras': return stapExtras();
      case 'bevestiging': return stapBevestiging();
      case 'overzicht': return stapOverzicht();
    }
    return '';
  }

  function stapModule() {
    var h = '<h3>Wat wil je maken?</h3><div class="eskh-grid eskh-grid-3">';
    Object.keys(MODULE_KAART).forEach(function (k) {
      var m = MODULE_KAART[k];
      h += kaart('data-set="module" data-val="' + k + '"', '<span class="eskh-ico">' + m.icon + '</span><h4>' + m.titel + '</h4><p>' + m.tekst + '</p>', S.draft.module === k);
    });
    return h + '</div>';
  }

  function stapVorm() {
    var d = S.draft, h;
    if (d.module === 'afdekzeil') {
      h = '<h3>Wat wil je afdekken?</h3><p class="eskh-sub">We zetten alvast gangbare maten klaar; die pas je in de volgende stap aan.</p><div class="eskh-grid eskh-grid-3">';
      OBJECTEN.forEach(function (o) {
        h += kaart('data-object="' + o.key + '"', '<span class="eskh-ico">' + o.icon + '</span><h4>' + o.titel + '</h4>', d.object === o.key);
      });
      return h + '</div>';
    }
    var vormen = P.MODULES[d.module].vormen;
    h = '<h3>' + (d.module === 'zonwering' ? 'Waar komt je zonwering?' : 'Wat wil je maken of vervangen?') + '</h3><div class="eskh-grid eskh-grid-3">';
    Object.keys(vormen).forEach(function (k) {
      var v = VORM_KAART[k] || {};
      h += kaart('data-set="vorm" data-val="' + k + '"', (v.badge ? '<span class="eskh-badge">' + v.badge + '</span>' : '') + '<span class="eskh-ico">' + (v.icon || '') + '</span><h4>' + vormen[k].naam + '</h4><p>' + (v.tekst || '') + '</p>', d.vorm === k);
    });
    return h + '</div>';
  }

  function stapMaten() {
    var d = S.draft, mk = modelKey();
    var h = '<h3>Wat zijn de maten?</h3><p class="eskh-sub">In centimeters. De preview en het snijplan rekenen direct mee.</p><div class="eskh-fields">';
    MAATVELDEN[mk].forEach(function (f) {
      var v = d.maten[f[0]];
      var fout = v == null || v === '' || isNaN(v) || v < f[2] || v > f[3];
      h += '<div class="eskh-field' + (fout ? ' is-error' : '') + '"><label for="eskh-m-' + f[0] + '">' + f[1] + '</label>' +
        '<div class="eskh-field-row"><input type="range" min="' + f[2] + '" max="' + f[3] + '" step="' + f[4] + '" value="' + (fout ? f[2] : v) + '" data-maat="' + f[0] + '" aria-label="' + esc(f[1]) + ' (schuif)">' +
        '<span class="eskh-num"><input id="eskh-m-' + f[0] + '" type="number" inputmode="decimal" min="' + f[2] + '" max="' + f[3] + '" step="1" value="' + (v == null ? '' : v) + '" data-maat="' + f[0] + '"><em>cm</em></span></div>' +
        (fout ? '<small class="eskh-err">Tussen ' + f[2] + ' en ' + f[3] + ' cm</small>' : '') + '</div>';
    });
    if (mk === 'buiskap') h += '<div class="eskh-field">' + toggleRij('maten.achterkant', 'Achterkant meenemen', 'Sluit je de kap ook aan de achterzijde af (bijv. met een rits)?', !!d.maten.achterkant) + '</div>';
    h += '<div class="eskh-field"><label>Aantal van dit formaat</label>' + stepper('aantal', d.aantal || 1, 1, 50, 'Aantal van dit formaat') + '</div>';
    h += '</div><p class="eskh-note">' + (MEETTIP[mk] || '') + '</p>';
    return h;
  }

  function stapDoek() {
    var d = S.draft, def = vormDef();
    var h = '<h3>Kies je doek</h3><div class="eskh-grid eskh-grid-' + Math.min(3, def.doeken.length) + '">';
    def.doeken.forEach(function (key) {
      var dk = CAT.doeken[key]; if (!dk) return;
      var vanaf = Math.min.apply(null, dk.kleuren.map(function (k) { return prijsVan(k.vid, k.prijs); }));
      var leverbaar = dk.kleuren.filter(function (k) { return !uitverkocht(k.vid); }).length;
      var inh = (dk.badge ? '<span class="eskh-badge' + (dk.badgeType === 'budget' ? ' eskh-badge-alt' : '') + '">' + esc(dk.badge) + '</span>' : '') +
        '<h4>' + esc(dk.naam) + '</h4><p>' + esc(dk.oms) + '</p>' +
        '<ul class="eskh-specs"><li>' + dk.rolCm + ' cm breed</li><li>' + esc(dk.gewicht) + '</li><li>' + dk.kleuren.length + ' kleur' + (dk.kleuren.length > 1 ? 'en' : '') + '</li></ul>' +
        '<div class="eskh-price">vanaf <strong>' + euro(vanaf) + '</strong> per meter</div>' +
        (leverbaar === 0 && dk.kleuren.every(function (k) { return live(k.vid); }) ? '<div class="eskh-stock eskh-stock-out">Momenteel niet leverbaar</div>' : '');
      h += kaart('data-set="doek" data-val="' + key + '"', inh, d.doek === key);
    });
    h += '</div>';
    if (d.doek && CAT.doeken[d.doek]) {
      var dk = CAT.doeken[d.doek];
      h += '<h3 class="eskh-mt">Kies de kleur</h3><div class="eskh-colors">';
      dk.kleuren.forEach(function (k) {
        var uit = uitverkocht(k.vid);
        var sw = k.img ? '<img src="' + img(k.img, '96x96x2') + '" alt="" loading="lazy" onerror="this.remove()">' : '';
        h += '<button type="button" class="eskh-color' + (d.kleur === k.vid ? ' is-active' : '') + (uit ? ' is-out' : '') + '" data-kleur="' + k.vid + '" aria-pressed="' + (d.kleur === k.vid) + '"' + (uit ? ' aria-disabled="true"' : '') + '>' +
          '<span class="eskh-swatch" style="background:' + k.hex + '">' + sw + '</span><span class="eskh-color-name">' + esc(k.naam) + '</span>' + statusBadge(k.vid) + '</button>';
      });
      h += '</div><p class="eskh-note">Kleuren op een scherm wijken af. Twijfel? Bestel eerst een staal of bel ons: ' + TELEFOON + '.</p>';
    }
    return h;
  }

  function stapVerwerking() {
    var d = S.draft, dk = P.doekKleur(CAT, d), pvc = dk && dk.doek.soort === 'pvc';
    var h = '';
    if (pvc) {
      h += '<h3>Hoe ga je het doek verwerken?</h3><div class="eskh-grid eskh-grid-2">' +
        kaart('data-set="verwerking" data-val="lijmen"', '<span class="eskh-badge">Makkelijkst</span><span class="eskh-ico">\ud83e\uddea</span><h4>Lijmen</h4><p>Naden waterdicht verlijmen met Saba PVC-lijm. Geen naaimachine nodig.</p>', d.verwerking === 'lijmen') +
        kaart('data-set="verwerking" data-val="naaien"', '<span class="eskh-ico">\ud83e\udea1</span><h4>Naaien</h4><p>Stikken met UV-bestendig garen. Vraagt een stevige naaimachine.</p>', d.verwerking === 'naaien') + '</div>';
    } else {
      h += '<h3>Garen</h3><p class="eskh-sub">' + esc(dk ? dk.doek.naam : 'Dit doek') + ' wordt gestikt. Kies het bijpassende zeilmakersgaren.</p>';
    }
    if (d.verwerking === 'naaien') {
      var auto = dk && dk.kleur.garen;
      h += '<div class="eskh-box"><div class="eskh-toggle-row"><div><strong>Bijpassend garen</strong><span>Coats Terko M36: UV-bestendig, rot niet. ' + (auto ? 'Wij kozen de kleur die het best bij <em>' + esc(dk.kleur.naam) + '</em> past.' : '') + '</span></div></div><div class="eskh-pills">';
      h += pill('data-garen=""', 'Geen garen nodig', !d.garen);
      Object.keys(CAT.garen).forEach(function (g) {
        var gp = CAT.garen[g];
        h += pill('data-garen="' + g + '"', '<i class="eskh-dot" style="background:' + gp.hex + '"></i>' + esc(gp.naam.replace(/^.*\u2014 /, '')) + (g === auto ? ' \u2605' : ''), d.garen === g, uitverkocht(gp.vid));
      });
      h += '</div></div>';
    }
    if (d.verwerking === 'lijmen') {
      h += '<div class="eskh-box">' + toggleRij('ontvetter', 'PVC-ontvetter toevoegen', 'Lijm hecht alleen op schoon, vetvrij doek. Sterk aanbevolen.', d.ontvetter !== false) + '</div>';
    }
    if (d.module === 'bootkap') {
      h += '<div class="eskh-box">' + toggleRij('extras.mallendoek', 'Eerst een mal maken?', 'Transparant gerecycled mallendoek (300 cm breed) om eerst een exacte mal van je boot te maken. Wij rekenen de meters uit.', !!(d.extras && d.extras.mallendoek)) + '</div>';
    }
    return h;
  }

  function stapExtras() {
    var d = S.draft, x = d.extras || {};
    var h = '<h3>Extra onderdelen</h3><p class="eskh-sub">Optioneel. Alles wat je aanzet rekenen we mee.</p>';
    // raamfolie
    var rf = x.raamfolie;
    h += '<div class="eskh-box">' + toggleRij('extras.raamfolie', '\ud83e\ude9f Raamfolie', 'Heldere, UV-bestendige Achilles-folie voor de ramen in je kap.', !!rf);
    if (rf) {
      h += '<div class="eskh-subgrid">' +
        '<label>Breedte per raam <span class="eskh-num"><input type="number" inputmode="numeric" data-path="extras.raamfolie.breedte" value="' + (rf.breedte || '') + '" min="10" max="500"><em>cm</em></span></label>' +
        '<label>Hoogte per raam <span class="eskh-num"><input type="number" inputmode="numeric" data-path="extras.raamfolie.hoogte" value="' + (rf.hoogte || '') + '" min="10" max="200"><em>cm</em></span></label>' +
        '<label>Aantal ramen ' + stepper('extras.raamfolie.aantal', rf.aantal || 1, 1, 20, 'Aantal ramen') + '</label></div>' +
        '<div class="eskh-pills"><span class="eskh-pills-label">Folie:</span>' + pill('data-path-set="extras.raamfolie.soort" data-val="helder"', 'Helder 0,4 mm', rf.soort !== 'smoke') + pill('data-path-set="extras.raamfolie.soort" data-val="smoke"', 'Smoke tint 0,5 mm', rf.soort === 'smoke') + '</div>' +
        '<div class="eskh-pills"><span class="eskh-pills-label">Dubbelzijdig tape:</span>' + pill('data-path-set="extras.raamfolie.tape" data-val=""', 'Geen', !rf.tape) +
          ['6', '9', '12'].map(function (t) { return pill('data-path-set="extras.raamfolie.tape" data-val="' + t + '"', t + ' mm', rf.tape === t); }).join('') + '</div>' +
        (!(rf.breedte > 0 && rf.hoogte > 0) ? '<small class="eskh-err">Vul de maten van de ramen in, anders rekenen we geen folie.</small>' : '');
    }
    h += '</div>';
    // ritsen
    var rz = x.ritsen || [];
    h += '<div class="eskh-box">' + toggleRij('extras.ritsen', '\ud83e\udd10 Deelbare ritsen', 'YKK 10 mm, zwart. Voor een deur in de kap of een oprolbaar deel.', rz.length > 0);
    rz.forEach(function (r, i) {
      var lengtes = r.type ? Object.keys(CAT.ritsen[r.type]) : [];
      h += '<div class="eskh-rits"><div class="eskh-pills"><span class="eskh-pills-label">Rits ' + (i + 1) + ':</span>' +
        pill('data-path-set="extras.ritsen.' + i + '.type" data-val="bloktand"', 'Bloktand (stevig)', r.type === 'bloktand') +
        pill('data-path-set="extras.ritsen.' + i + '.type" data-val="spiraal"', 'Spiraal (soepel)', r.type === 'spiraal') + '</div>' +
        (r.type ? '<div class="eskh-pills"><span class="eskh-pills-label">Lengte:</span>' + lengtes.map(function (l) {
          var rr = CAT.ritsen[r.type][l];
          return pill('data-path-set="extras.ritsen.' + i + '.lengte" data-val="' + l + '"', nl(l / 100, l % 100 ? 1 : 0) + ' m', String(r.lengte) === l, uitverkocht(rr.vid));
        }).join('') + '</div>' : '') +
        '<div class="eskh-pills"><span class="eskh-pills-label">Aantal:</span>' + stepper('extras.ritsen.' + i + '.aantal', r.aantal || 1, 1, 20, 'Aantal ritsen') +
        '<button type="button" class="eskh-link" data-rits-weg="' + i + '">Verwijder</button></div></div>';
    });
    if (rz.length) h += '<button type="button" class="eskh-btn eskh-btn-ghost eskh-btn-sm" data-act="rits-plus">+ Nog een rits</button>';
    h += '</div>';
    // trekband
    var tb = x.trekband;
    h += '<div class="eskh-box">' + toggleRij('extras.trekband', '\ud83c\udf97\ufe0f Trekbandjes met klemgesp', 'Polyester band 25 mm met RVS klemgesp om de kap strak te zetten. 1 set = 1 m band + 1 gesp.', !!tb);
    if (tb) {
      h += '<div class="eskh-pills"><span class="eskh-pills-label">Aantal sets:</span>' + stepper('extras.trekband.sets', tb.sets || 1, 1, 40, 'Aantal sets') + '</div>' +
        '<div class="eskh-pills"><span class="eskh-pills-label">Bandbeugel op de boot:</span>' + pill('data-path-set="extras.trekband.beugel" data-val=""', 'Geen', !tb.beugel) +
        pill('data-path-set="extras.trekband.beugel" data-val="zwart"', 'Nylon zwart', tb.beugel === 'zwart') + pill('data-path-set="extras.trekband.beugel" data-val="wit"', 'Nylon wit', tb.beugel === 'wit') +
        pill('data-path-set="extras.trekband.beugel" data-val="rvs"', 'RVS luxe', tb.beugel === 'rvs') + '</div>';
    }
    return h + '</div>';
  }

  function stapBevestiging() {
    var d = S.draft, def = vormDef(), o = d.opt || {};
    var h = '<h3>Hoe maak je het vast?</h3><div class="eskh-grid eskh-grid-2">';
    var info = {
      loxx: ['\ud83d\udd18', 'Zelfborgende drukknop: klikt vast en waait nooit uit zichzelf los.'],
      druk: ['\u26aa', 'Klassieke maritieme drukknopen. Snel vast en los.'],
      draai: ['\ud83d\udd04', 'Tourniquets: draaiers op de boot, kousen in het doek. Ijzersterk.'],
      ring: ['\u2b55', 'Zeilringen in de rand, met elastisch koord om knoppen of haken.'],
      tunnel: ['\u3030\ufe0f', 'Koord door een zoom rondom: aantrekken en klaar. Simpel en strak.'],
      klit: ['\ud83e\uddf7', 'Klittenband langs de rand. Geen gereedschap nodig.'],
      zuignap: ['\ud83e\ude9f', 'Zuignappen aan de binnenzijde van het glas, met een zeilring per zuignap.'],
      balkon: ['\ud83c\udfd9\ufe0f', 'Zeilringen in de rand, elastiek met koordhaken om de spijlen.']
    };
    def.bevestiging.forEach(function (k) {
      var bv = P.BEVESTIGING[k];
      var inh = '<span class="eskh-ico">' + info[k][0] + '</span><h4>' + bv.naam + '</h4><p>' + info[k][1] + '</p>';
      h += kaart('data-set="bevestiging" data-val="' + k + '"', inh, d.bevestiging === k);
    });
    h += '</div>';
    if (!d.bevestiging) return h;
    h += '<div class="eskh-box">';
    var b = d.bevestiging;
    function opties(label, key, lijst) {
      return '<div class="eskh-pills"><span class="eskh-pills-label">' + label + '</span>' + lijst.map(function (l) {
        return pill('data-path-set="opt.' + key + '" data-val="' + l[0] + '"', l[1], String(o[key] != null ? o[key] : lijst[0][0]) === String(l[0]));
      }).join('') + '</div>';
    }
    if (b === 'loxx') {
      h += opties('Kop:', 'loxxKop', [['rvs', 'RVS'], ['kv', 'Koper-vernikkeld'], ['chroom', 'Verchroomd'], ['zwart', 'Zwart']]) +
           opties('Vast op:', 'loxxBasis', [['zelftapper', 'Zelftapper (schroef)'], ['bout', 'Bout + moer'], ['doekdeel', 'Doekdeel (doek-op-doek)']]);
    }
    if (b === 'druk') {
      h += opties('Merk:', 'drukMerk', [['dot', 'DOT (RVS)'], ['ykk', 'YKK (RVS)'], ['fasnap', 'Fasnap (koper-vernikkeld)'], ['prym', 'Prym (koper-vernikkeld)']]);
      if ((o.drukMerk || 'dot') === 'dot') h += opties('Deel C op de boot:', 'drukC', [['parker', 'Parker-schroef'], ['bout', 'Bout M5'], ['popnagel', 'Popnagel'], ['raamclip', 'Raamclip (buis 24 mm)']]);
    }
    if (b === 'draai') h += opties('Merk / maat:', 'draaiMerk', [['prym', 'Prym (15 \u00d7 9 mm)'], ['mh', 'MH (17 \u00d7 11 mm)']]);
    if (b === 'ring') {
      h += opties('Zeilring:', 'ringDin', [[12, 'DIN 12'], [10, 'DIN 10'], [16, 'DIN 16 (zwaar)']]) +
           opties('Materiaal:', 'ringMat', [['rvs', 'RVS'], ['messing', 'Messing']]) +
           opties('Koord:', 'koordDikte', [[6, '6 mm'], [8, '8 mm']]) + opties('Kleur koord:', 'koordKleur', [['zwart', 'Zwart'], ['wit', 'Wit']]) +
           opties('Vastzetten aan:', 'aanslag', [['koordhaak', 'Koordhaken'], ['musketon', 'Musketonhaken'], ['rondknop', 'Rondknoppen (kunststof)'], ['noorse_knop', 'Noorse knoppen (RVS)'], ['geen', 'Heb ik al']]);
    }
    if (b === 'tunnel') h += opties('Koord:', 'koordDikte', [[6, '6 mm'], [8, '8 mm']]) + opties('Kleur koord:', 'koordKleur', [['zwart', 'Zwart'], ['wit', 'Wit']]);
    if (b === 'klit') h += opties('Breedte:', 'klitBreedte', [[25, '25 mm'], [50, '50 mm (stevig)']]);

    var bv = P.BEVESTIGING[b];
    if (bv.afstand) {
      var afst = d.afstandCm || bv.afstand;
      var punten = 0;
      try { punten = P.berekenItem(Object.assign({}, previewItem(), { afstandCm: afst }), CAT).punten; } catch (e) { }
      h += '<div class="eskh-field"><label>Afstand tussen bevestigers: <strong>' + afst + ' cm</strong> \u2192 ' + punten + ' stuks</label>' +
        '<input type="range" min="10" max="' + (b === 'zuignap' || b === 'balkon' ? 80 : 60) + '" step="5" value="' + afst + '" data-afstand aria-label="Afstand tussen bevestigers"></div>' +
        '<p class="eskh-note">Advies: 20\u201330 cm voor kappen (windvast), 30\u201350 cm voor zeilen en zonwering.</p>';
    }
    var heeftTool = b === 'loxx' || b === 'druk' || b === 'draai' || b === 'ring' || b === 'zuignap' || b === 'balkon';
    if (heeftTool) h += toggleRij('gereedschap', 'Gereedschap meebestellen', 'Holpijp, stempel en/of stansblok om de onderdelen zelf in het doek te zetten. Zonder gereedschap lukt het niet. Heb je het al? Zet dit uit.', d.gereedschap !== false);
    return h + '</div>';
  }

  /* ---------------- overzicht ---------------- */
  var ONDERHOUD = [
    ['fabric_guard', '\ud83d\udee1\ufe0f', 'Impregneer na verloop van tijd (acryl en polyester).'],
    ['multi_cleaner', '\ud83e\uddf4', 'Reinigt doek, ramen en kunststof.'],
    ['glaspotlood', '\u270f\ufe0f', 'Aftekenen op doek, folie en glas.'],
    ['zeilnaalden', '\ud83e\udea1', 'Voor handwerk en reparaties.'],
    ['stansblok', '\ud83d\udfe5', 'Extra stansblok als ondergrond.']
  ];

  function itemLabel(it, i) {
    var def = P.MODULES[it.module].vormen[it.vorm];
    var obj = it.object && OBJECTEN.filter(function (o) { return o.key === it.object; })[0];
    var m = it.maten, mk = def.model;
    var maat = mk === 'rond' ? '\u00d8 ' + m.diameter + ' \u00d7 ' + m.hoogte + ' cm' :
      (MAATVELDEN[mk] || []).filter(function (f) { return f[0] !== 'overhang' && f[0] !== 'radius'; }).map(function (f) { return m[f[0]]; }).join(' \u00d7 ') + ' cm';
    return (i + 1) + '. ' + (obj ? obj.titel : def.naam) + ' \u00b7 ' + maat + (it.aantal > 1 ? ' \u00b7 ' + it.aantal + '\u00d7' : '');
  }

  function stapOverzicht() {
    if (!S.items.length) return '<p>Je pakket is leeg.</p><button type="button" class="eskh-btn eskh-btn-primary" data-act="nieuw">Begin opnieuw</button>';
    var pk = pakket();
    var h = '';
    // per item
    S.items.forEach(function (it, i) {
      var r = pk.perItem[i];
      var dk = r.berekening.dk;
      h += '<div class="eskh-item"><div class="eskh-item-head"><div><strong>' + esc(itemLabel(it, i)) + '</strong><span>' +
        esc(dk.doek.naam + ' ' + dk.kleur.naam) + ' \u00b7 ' + esc(P.BEVESTIGING[it.bevestiging].naam) + ' \u00b7 ' + r.berekening.plan.meters + ' m doek</span></div>' +
        '<div class="eskh-item-acts"><button type="button" data-edit="' + i + '">Wijzig</button><button type="button" data-dup="' + i + '">Dupliceer</button><button type="button" data-del="' + i + '">Verwijder</button></div></div>' +
        '<details class="eskh-plan"><summary>Snijplan &amp; berekening</summary>' + snijplanSVG(r.berekening.plan, dk.kleur.hex) +
        '<p class="eskh-note">Netto oppervlak ' + nl(r.berekening.model.oppervlakM2 * r.berekening.aantal) + ' m\u00b2 \u00b7 rand ' + nl(r.berekening.randCm / 100) + ' m' +
        (r.berekening.punten ? ' \u00b7 ' + r.berekening.punten + ' bevestigingspunten (om de ' + r.berekening.afstand + ' cm)' : '') + '. Incl. ' + C.R.zoomCm + ' cm zoom per rand en snijmarge.</p></details></div>';
    });
    h += '<button type="button" class="eskh-btn eskh-btn-ghost eskh-add" data-act="nieuw">+ Nog iets toevoegen (bootkap, hoes of zonwering)</button>';

    // regels
    var groepen = [['doek', 'Doek'], ['verwerking', 'Verwerking'], ['bevestiging', 'Bevestiging'], ['extra', "Extra's"], ['gereedschap', 'Gereedschap'], ['onderhoud', 'Onderhoud']];
    var totaal = 0, problemen = 0;
    h += '<div class="eskh-board"><div class="eskh-board-head"><span>Product</span><span>Aantal</span><span>Prijs</span></div>';
    groepen.forEach(function (g) {
      var rs = pk.regels.filter(function (r) { return (r.groep || 'onderhoud') === g[0]; });
      if (!rs.length) return;
      h += '<div class="eskh-group">' + g[1] + '</div>';
      rs.forEach(function (r) {
        var lt = r.qty * r.prijsLive; totaal += lt;
        var uit = uitverkocht(r.vid) && r.qty > 0;
        if (uit) problemen++;
        var gewijzigd = r.qty !== r.berekend;
        h += '<div class="eskh-line' + (r.qty === 0 ? ' is-zero' : '') + (uit ? ' is-out' : '') + '">' +
          '<div class="eskh-line-info">' + (r.img ? '<img src="' + img(r.img, '80x80x2') + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
          '<div><a href="/' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.naam) + '</a>' + statusBadge(r.vid) +
          '<p>' + esc(r.notitie || '') + (gewijzigd ? ' <em>(berekend: ' + r.berekend + ')</em>' : '') + '</p>' +
          (uit ? '<p class="eskh-err">Dit product is nu niet leverbaar. Kies een andere variant of zet het aantal op 0. Vragen? Bel ' + TELEFOON + '.</p>' : '') + '</div></div>' +
          '<div class="eskh-line-qty">' + stepper('qty:' + r.vid, r.qty, 0, 999, 'Aantal ' + r.naam) + '<small>' + (r.unit === 'm' ? 'meter' : r.unit === 'rol' ? 'rol' : 'stuks') + '</small></div>' +
          '<div class="eskh-line-price">' + euro(lt) + '<small>' + euro(r.prijsLive) + ' / ' + (r.unit === 'm' ? 'm' : 'st') + '</small></div></div>';
      });
    });
    h += '</div>';

    // onderhoud-suggesties
    h += '<div class="eskh-box"><strong>Niet vergeten?</strong><div class="eskh-suggest">';
    ONDERHOUD.forEach(function (o) {
      var p = CAT.p[o[0]]; if (!p) return;
      var aan = S.onderhoud[o[0]] > 0;
      h += '<button type="button" class="eskh-chip' + (aan ? ' is-active' : '') + '" data-onderhoud="' + o[0] + '" aria-pressed="' + aan + '">' + o[1] + ' ' + esc(p.naam) + ' <em>' + euro(prijsVan(p.vid, p.prijs)) + '</em><small>' + o[2] + '</small></button>';
    });
    h += '</div></div>';

    var kanBestellen = totaal > 0 && !S.bezig;
    h += '<div class="eskh-total"><div><span>Totaal incl. btw</span><strong>' + euro(totaal) + '</strong><small>Prijzen live uit de shop \u00b7 exclusief verzendkosten</small></div>' +
      '<button type="button" class="eskh-btn eskh-btn-cta" data-act="cart"' + (kanBestellen ? '' : ' disabled') + '>' +
      (S.bezig ? '<span class="eskh-spin"></span> ' + esc(S.bezig) : 'Alles in winkelwagen') + '</button></div>';
    if (problemen) h += '<div class="eskh-melding" role="alert">' + problemen + ' product(en) zijn niet leverbaar. Die slaan we over; pas ze aan of bel ' + TELEFOON + '.</div>';
    if (S.cartResultaat) h += S.cartResultaat;
    h += '<div class="eskh-share"><button type="button" class="eskh-link" data-act="deel">\ud83d\udd17 Kopieer link naar dit pakket</button>' +
      '<button type="button" class="eskh-link" data-act="print">\ud83d\udda8\ufe0f Print / bewaar als PDF</button>' +
      '<button type="button" class="eskh-link" data-act="reset">\u21ba Opnieuw beginnen</button></div>';
    return h;
  }

  /* ---------------- winkelwagen ---------------- */
  function naarWinkelwagen() {
    var pk = pakket();
    var regels = pk.regels.filter(function (r) { return r.qty > 0 && !uitverkocht(r.vid); });
    if (!regels.length) return;
    S.bezig = 'Bezig\u2026'; S.cartResultaat = null; render();
    LIVE.track('keuzehulp_cart_start', {});
    LIVE.zetInWinkelwagen(regels, function (i, n) {
      S.bezig = 'Toevoegen ' + i + ' van ' + n + '\u2026';
      var btn = root$.querySelector('[data-act="cart"]'); if (btn) btn.innerHTML = '<span class="eskh-spin"></span> ' + S.bezig;
    }).then(function (res) {
      S.bezig = false;
      var waarde = res.ok.reduce(function (s, r) { return s + r.qty * r.prijsLive; }, 0);
      if (res.ok.length) LIVE.track('add_to_cart', { ecommerce: { currency: 'EUR', value: Math.round(waarde * 100) / 100, items: LIVE.ga4Items(res.ok) }, keuzehulp: true });
      if (!res.fout.length) {
        LIVE.track('keuzehulp_cart_klaar', { keuzehulp_regels: res.ok.length, value: Math.round(waarde * 100) / 100 });
        try { localStorage.removeItem(STORE_KEY); } catch (e) { }
        location.href = '/cart/';
        return;
      }
      LIVE.track('keuzehulp_cart_fout', { keuzehulp_fout: res.fout.length });
      S.cartResultaat = '<div class="eskh-melding" role="alert"><strong>' + res.ok.length + ' van ' + (res.ok.length + res.fout.length) + ' producten staan in je winkelwagen.</strong> Deze lukten niet:<ul>' +
        res.fout.map(function (r) { return '<li>' + esc(r.naam) + ' (' + r.qty + ')</li>'; }).join('') + '</ul>' +
        '<button type="button" class="eskh-btn eskh-btn-primary eskh-btn-sm" data-act="cart-retry">Probeer deze opnieuw</button> <a class="eskh-btn eskh-btn-ghost eskh-btn-sm" href="/cart/">Naar winkelwagen</a>' +
        '<p>Lukt het niet? Bel ' + TELEFOON + ', dan zetten we het voor je klaar.</p></div>';
      S.retry = res.fout;
      render();
    });
  }
  function retryWinkelwagen() {
    var regels = S.retry || []; if (!regels.length) return;
    S.bezig = 'Opnieuw proberen\u2026'; render();
    LIVE.zetInWinkelwagen(regels).then(function (res) {
      S.bezig = false;
      if (!res.fout.length) { location.href = '/cart/'; return; }
      S.retry = res.fout;
      S.cartResultaat = '<div class="eskh-melding" role="alert">Nog steeds ' + res.fout.length + ' product(en) niet gelukt. Bel ' + TELEFOON + ' of voeg ze via de productpagina toe.</div>';
      render();
    });
  }

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */
  function kiesModule(m) {
    if (S.draft.module !== m) { S.draft = nieuwItem(m); }
    LIVE.track('keuzehulp_module', { keuzehulp_module: m });
  }
  function kiesVorm(v) {
    var d = S.draft;
    if (d.vorm === v) return;
    d.vorm = v; d.doek = null; d.kleur = null; d.bevestiging = null; d.opt = {}; d.afstandCm = null;
    var mk = vormDef().model, def = {
      buiskap: { lengte: 250, breedte: 220, hoogte: 110 }, bimini: { lengte: 200, breedte: 200 }, plat: { lengte: 700, breedte: 260, overhang: 30 },
      zonwering: { breedte: 120, hoogte: 100 }
    }[mk];
    if (def) d.maten = JSON.parse(JSON.stringify(def));
    if (d.module === 'zonwering') d.verwerking = 'geen';
    if (d.module === 'bootkap' && CAT.doeken[vormDef().doeken[0]].soort !== 'pvc') d.verwerking = 'naaien'; else if (d.module !== 'zonwering') d.verwerking = null;
  }
  function kiesDoek(key) {
    var d = S.draft;
    if (d.doek === key) return;
    d.doek = key;
    var dk = CAT.doeken[key];
    var eerst = dk.kleuren.filter(function (k) { return !uitverkocht(k.vid); })[0];
    d.kleur = dk.kleuren.length === 1 ? dk.kleuren[0].vid : null;
    if (dk.soort !== 'pvc' && d.module !== 'zonwering') d.verwerking = 'naaien';
    else if (d.module !== 'zonwering' && d.verwerking === 'naaien' && dk.soort === 'pvc') { /* keuze behouden */ }
    if (dk.soort === 'gaas') d.verwerking = 'geen';
    if (d.kleur) d.garen = (P.doekKleur(CAT, d).kleur.garen) || null;
    void eerst;
  }

  function onClick(e) {
    var t = e.target.closest('button, a[data-act]');
    if (!t || !root$.contains(t)) return;
    var d = S.draft;
    if (t.hasAttribute('data-set')) {
      var key = t.getAttribute('data-set'), val = t.getAttribute('data-val');
      if (key === 'module') kiesModule(val);
      else if (key === 'vorm') kiesVorm(val);
      else if (key === 'doek') kiesDoek(val);
      else if (key === 'verwerking') { d.verwerking = val; if (val === 'naaien' && d.garen == null) { var dk = P.doekKleur(CAT, d); d.garen = dk ? dk.kleur.garen || null : null; } }
      else if (key === 'bevestiging') { if (d.bevestiging !== val) { d.bevestiging = val; d.opt = {}; d.afstandCm = null; } }
      S.melding = null;
      var autoNext = (key === 'module' || key === 'vorm');
      if (autoNext) { ga(stappen()[stappen().indexOf(S.stap) + 1]); return; }
      render(); return;
    }
    if (t.hasAttribute('data-object')) {
      var o = OBJECTEN.filter(function (x) { return x.key === t.getAttribute('data-object'); })[0];
      if (d.object !== o.key) { kiesVorm(o.vorm); d.vorm = o.vorm; d.object = o.key; d.maten = JSON.parse(JSON.stringify(o.maten)); }
      ga('maten'); return;
    }
    if (t.hasAttribute('data-kleur')) {
      if (t.getAttribute('aria-disabled') === 'true') { S.melding = 'Deze kleur is nu niet leverbaar. Kies een andere kleur of bel ' + TELEFOON + '.'; render(); return; }
      d.kleur = t.getAttribute('data-kleur');
      var dk2 = P.doekKleur(CAT, d);
      if (dk2 && d.verwerking === 'naaien') d.garen = dk2.kleur.garen || null;
      S.melding = null; render(); return;
    }
    if (t.hasAttribute('data-garen')) { d.garen = t.getAttribute('data-garen') || null; render(); return; }
    if (t.hasAttribute('data-path-set')) {
      var v = t.getAttribute('data-val'), p = t.getAttribute('data-path-set');
      if (/^opt\.(ringDin|koordDikte|klitBreedte)$/.test(p)) v = parseInt(v, 10);
      setPath(p, v === '' ? null : v); S.melding = null; render(); return;
    }
    if (t.hasAttribute('data-toggle')) {
      var k = t.getAttribute('data-toggle');
      if (k === 'gereedschap') d.gereedschap = d.gereedschap === false;
      else if (k === 'ontvetter') d.ontvetter = d.ontvetter === false;
      else if (k === 'extras.raamfolie') setPath(k, getPath(k) ? null : { breedte: null, hoogte: null, aantal: 1, soort: 'helder', tape: '9' });
      else if (k === 'extras.ritsen') setPath(k, (getPath(k) || []).length ? [] : [{ type: 'spiraal', lengte: null, aantal: 1 }]);
      else if (k === 'extras.trekband') setPath(k, getPath(k) ? null : { sets: 4, beugel: 'rvs' });
      else setPath(k, !getPath(k));
      render(); return;
    }
    if (t.hasAttribute('data-step')) {
      var sk = t.getAttribute('data-step'), delta = parseInt(t.getAttribute('data-d'), 10);
      if (sk.indexOf('qty:') === 0) {
        var vid = sk.slice(4), r = pakket().regels.filter(function (x) { return x.vid === vid; })[0];
        S.overrides[vid] = Math.max(0, (r ? r.qty : 0) + delta);
      } else {
        var cur = parseInt(getPath(sk), 10) || 1;
        setPath(sk, Math.max(1, cur + delta));
      }
      render(); return;
    }
    if (t.hasAttribute('data-rits-weg')) { d.extras.ritsen.splice(parseInt(t.getAttribute('data-rits-weg'), 10), 1); render(); return; }
    if (t.hasAttribute('data-onderhoud')) {
      var ok = t.getAttribute('data-onderhoud');
      if (S.onderhoud[ok] > 0) delete S.onderhoud[ok]; else S.onderhoud[ok] = 1;
      render(); return;
    }
    if (t.hasAttribute('data-edit')) { var i = +t.getAttribute('data-edit'); S.draft = JSON.parse(JSON.stringify(S.items[i])); S.editIdx = i; ga('maten'); return; }
    if (t.hasAttribute('data-dup')) { var j = +t.getAttribute('data-dup'); S.items.splice(j + 1, 0, JSON.parse(JSON.stringify(S.items[j]))); render(); return; }
    if (t.hasAttribute('data-del')) {
      S.items.splice(+t.getAttribute('data-del'), 1); S.overrides = {};
      if (!S.items.length) { S.draft = nieuwItem(); ga('module'); return; }
      render(); return;
    }
    var act = t.getAttribute('data-act');
    if (act === 'volgende') { volgende(); return; }
    if (act === 'vorige') { vorige(); return; }
    if (act === 'naar-overzicht') { ga('overzicht'); return; }
    if (act === 'nieuw') { S.draft = nieuwItem(); S.editIdx = -1; ga('module'); return; }
    if (act === 'rits-plus') { d.extras.ritsen.push({ type: 'spiraal', lengte: null, aantal: 1 }); render(); return; }
    if (act === 'cart') { naarWinkelwagen(); return; }
    if (act === 'cart-retry') { retryWinkelwagen(); return; }
    if (act === 'print') { window.print(); return; }
    if (act === 'reset') { if (window.confirm('Weet je zeker dat je opnieuw wilt beginnen? Je pakket wordt gewist.')) { resetState(); try { localStorage.removeItem(STORE_KEY); } catch (e2) { } render(true); } return; }
    if (act === 'deel') {
      var link = deelLink();
      var klaar = function () { t.textContent = '\u2713 Link gekopieerd'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(klaar, function () { window.prompt('Kopieer deze link:', link); });
      else window.prompt('Kopieer deze link:', link);
      LIVE.track('keuzehulp_deel', {});
      return;
    }
  }

  /* inputs: maten, afstand, number-steppers, vrije velden */
  var inputTimer = null;
  function onInput(e) {
    var t = e.target;
    if (!root$.contains(t)) return;
    var d = S.draft;
    if (t.hasAttribute('data-maat')) {
      var k = t.getAttribute('data-maat');
      var v = t.value === '' ? null : parseFloat(String(t.value).replace(',', '.'));
      d.maten[k] = v;
      // zusterveld (slider <-> getal) direct bijwerken zonder volledige render (focus behouden)
      root$.querySelectorAll('[data-maat="' + k + '"]').forEach(function (el) { if (el !== t && v != null && !isNaN(v)) el.value = v; });
      clearTimeout(inputTimer);
      inputTimer = setTimeout(function () { renderPreviewAlleen(); }, t.type === 'range' ? 0 : 250);
      if (e.type === 'change') render();
      return;
    }
    if (t.hasAttribute('data-afstand')) { d.afstandCm = parseInt(t.value, 10); if (e.type === 'change' || t.type === 'range') { clearTimeout(inputTimer); inputTimer = setTimeout(render, 60); } return; }
    if (t.hasAttribute('data-num')) {
      var key = t.getAttribute('data-num'), n = parseInt(t.value, 10);
      if (e.type !== 'change') return;
      if (key.indexOf('qty:') === 0) S.overrides[key.slice(4)] = isNaN(n) ? 0 : Math.max(0, n);
      else setPath(key, isNaN(n) ? 1 : Math.max(1, n));
      render(); return;
    }
    if (t.hasAttribute('data-path')) {
      var pv = t.value === '' ? null : parseFloat(t.value);
      setPath(t.getAttribute('data-path'), pv);
      if (e.type === 'change') render();
      return;
    }
  }
  function renderPreviewAlleen() {
    var oud = root$.querySelector('.eskh-preview');
    var tmp = document.createElement('div'); tmp.innerHTML = previewHTML();
    var nieuw = tmp.firstChild;
    if (oud && nieuw) {
      var open = oud.querySelector('details') && oud.querySelector('details').open;
      oud.parentNode.replaceChild(nieuw, oud);
      if (open) nieuw.querySelector('details').open = true;
    }
    var next = root$.querySelector('[data-act="volgende"]');
    if (next) { var ok = stapGeldig(S.stap); next.classList.toggle('is-disabled', !ok); next.setAttribute('aria-disabled', String(!ok)); }
    bewaar();
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  function init() {
    if (!C || !P || !CAT || !LIVE) return false;
    var el = null;
    for (var i = 0; i < MOUNT_IDS.length && !el; i++) el = document.getElementById(MOUNT_IDS[i]);
    if (!el) return false;
    if (el.getAttribute('data-eskh') === '1') return true;
    el.setAttribute('data-eskh', '1');
    el.classList.add('eskh');
    root$ = el;
    injectCSS();
    resetState();
    var hersteld = herstel();
    var pre = el.getAttribute('data-module') || (/[?&]keuzehulp=(bootkap|afdekzeil|zonwering)/.exec(location.search) || [])[1];
    if (!hersteld && pre && P.MODULES[pre]) { S.draft = nieuwItem(pre); S.stap = 'vorm'; }
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onInput);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    LIVE.track('keuzehulp_start', { keuzehulp_hersteld: hersteld });
    render();
    return true;
  }

  function injectCSS() {
    if (document.getElementById('eskh-css')) return;
    var st = document.createElement('style');
    st.id = 'eskh-css';
    st.textContent = root.ESKH_CSS || '';
    document.head.appendChild(st);
  }

  root.EsailsKeuzehulp = { init: init, _state: function () { return S; }, _pakket: function () { return pakket(); } };

  function start() { if (!init()) { start.n = (start.n || 0) + 1; if (start.n < 40) setTimeout(start, 150); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : this);
