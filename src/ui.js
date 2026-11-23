/* =====================================================================
   eSails Keuzehulp — UI (wizard)
   Mount: <div id="esails-keuzehulp"></div>
   Optioneel: data-module="bootkap|afdekzeil|zonwering" of ?keuzehulp=bootkap
   om direct een module te openen.
   ===================================================================== */
(function (root) {
  'use strict';
  var C = root.EsailsCore, P = root.EsailsPakket, CAT = root.EsailsCatalog, LIVE = root.EsailsLive, BT = root.EsailsBouwtekening;
  var MOUNT_IDS = ['esails-keuzehulp', 'esails-wizard-mount', 'esails-jacuzzi-mount', 'esails-zonwering-mount'];
  var STORE_KEY = 'eskh_state_v1';
  var TELEFOON = '023-5329517';

  /* ------------------------------------------------------------------
     Content per module / vorm
     ------------------------------------------------------------------ */
  var MODULE_KAART = {
    bootkap:   { icon: '⛵', titel: 'Bootkap & dekzeil', tekst: 'Buiskap, achtertent, bimini of winterkleed voor je boot.' },
    afdekzeil: { icon: '🛋️', titel: 'Afdekzeil op maat', tekst: 'Waterdichte hoes voor tuinset, bbq, jacuzzi, aanhanger en meer.' },
    zonwering: { icon: '☀️', titel: 'Zonwering', tekst: 'Zon- en hittewerend gaasdoek voor raam of balkon.' }
  };

  /* Objecten in de afdekzeil-module: kiezen zet vorm + startmaten */
  var OBJECTEN = [
    { key: 'loungeset', icon: '🛋️', titel: 'Loungeset / tuinbank', vorm: 'blok', maten: { lengte: 200, breedte: 90, hoogte: 75 } },
    { key: 'tuintafel', icon: '🪑', titel: 'Tuintafel (rechthoekig)', vorm: 'blok', maten: { lengte: 180, breedte: 90, hoogte: 75 } },
    { key: 'bbq_rond', icon: '🔥', titel: 'Kogelbarbecue / ronde tafel', vorm: 'rond', maten: { diameter: 60, hoogte: 100 } },
    { key: 'bbq_blok', icon: '🍖', titel: 'Barbecue / buitenkeuken', vorm: 'blok', maten: { lengte: 140, breedte: 60, hoogte: 110 } },
    { key: 'jacuzzi', icon: '♨️', titel: 'Jacuzzi / hottub', vorm: 'jacuzzi', maten: { lengte: 213, breedte: 213, radius: 30, hoogte: 25 } },
    { key: 'plat', icon: '🚚', titel: 'Plat zeil (aanhanger, hout, kist)', vorm: 'plat', maten: { lengte: 250, breedte: 150, overhang: 15 } }
  ];

  var VORM_KAART = {
    buiskap: { icon: '⛵', tekst: 'Kap over de kuip, met dak, zijkanten en voorkant.' },
    bimini:  { icon: '☀️', tekst: 'Zonnedak op een frame. Licht en snel op te zetten.' },
    dekzeil: { icon: '⚓', tekst: 'Plat zeil over de boot: 100% waterdicht in de winter.' },
    raam:    { icon: '🪟', tekst: 'Tegen het glas met zuignappen. Geen boren, zo weer weg.', badge: 'Geen boren' },
    balkon:  { icon: '🏙️', tekst: 'Oogjes in de zoom, met elastisch koord of tie-wraps aan de reling of balustrade.', badge: 'Voor reling' }
  };

  /* Maatvelden per model */
  var MAATVELDEN = {
    buiskap: [['lengte', 'Lengte van de kap', 50, 800, 5], ['breedte', 'Breedte van de kap', 50, 500, 5], ['hoogte', 'Hoogte (dek tot dak)', 30, 250, 5]],
    bimini:  [['lengte', 'Lengte van het dak', 50, 600, 5], ['breedte', 'Breedte van het dak', 50, 400, 5]],
    plat:    [['lengte', 'Lengte', 30, 2000, 5], ['breedte', 'Breedte', 30, 1000, 5], ['overhang', 'Overhang rondom', 0, 100, 5]],
    dekzeil: [['lengte', 'Lengte van de boot (dek)', 100, 2000, 5], ['breedte', 'Breedte van de boot', 50, 800, 5], ['hoogte', 'Rokhoogte (valt over de rand)', 5, 150, 5]],
    blok:    [['lengte', 'Lengte', 20, 600, 1], ['breedte', 'Diepte / breedte', 20, 400, 1], ['hoogte', 'Hoogte (rok)', 5, 250, 1]],
    rond:    [['diameter', 'Diameter', 20, 400, 1], ['hoogte', 'Hoogte (rok)', 5, 200, 1]],
    jacuzzi: [['lengte', 'Lengte', 100, 400, 1], ['breedte', 'Breedte', 100, 400, 1], ['radius', 'Hoekradius', 0, 80, 1], ['hoogte', 'Hoogte van de rok', 5, 60, 1]],
    zonwering: [['breedte', 'Breedte', 20, 600, 1], ['hoogte', 'Hoogte', 20, 400, 1]]
  };
  var MEETTIP = {
    buiskap: '<strong>Zo meet je:</strong> lengte = van voorkant tot achterkant van de kap, recht gemeten. Breedte = buitenmaat over de kuip. Hoogte = van dek tot het hoogste punt van het dak. Voor de welving van het dak over de beugels rekenen wij 10% extra lengte bij het dak.',
    bimini: '<strong>Zo meet je:</strong> meet het frame van buitenbeugel tot buitenbeugel, recht gemeten. Voor de welving van het dak rekenen wij 10% extra lengte bij.',
    plat: '<strong>Zo meet je:</strong> lengte × breedte van wat je afdekt. De overhang komt er rondom bij, zodat het zeil netjes over de rand valt.',
    dekzeil: '<strong>Zo meet je:</strong> lengte en breedte op het breedste punt van het dek, over relingen of opbouw heen. Rokhoogte = hoe ver het zeil langs de zijkant over de rand naar beneden valt. De rok maken we van vier stroken, in de hoeken aan elkaar genaaid.',
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
    return ['module', 'vorm', 'maten', 'doek', 'verwerking', 'bevestiging']; // zonwering: zoom wordt altijd gestikt
  }
  var STAPNAAM = { module: 'Wat ga je maken?', vorm: 'Type', maten: 'Afmetingen', doek: 'Doek & kleur', verwerking: 'Verwerking', extras: "Extra's", bevestiging: 'Bevestiging', overzicht: 'Jouw pakket' };

  function vormDef() { var m = P.MODULES[S.draft.module]; return m && m.vormen[S.draft.vorm]; }
  function modelKey() { var d = vormDef(); return d && d.model; }

  function stapGeldig(stap) {
    var d = S.draft;
    switch (stap) {
      case 'module': return !!d.module;
      case 'vorm': return !!d.vorm;
      case 'maten': return (MAATVELDEN[modelKey()] || []).every(function (f) { var v = d.maten[f[0]]; return v != null && v !== '' && !isNaN(v) && v >= f[2] && v <= f[3]; }) &&
        (!(modelKey() === 'buiskap' && d.maten.voorkantSchuin) || (d.maten.voorkantLengte >= d.maten.hoogte && d.maten.voorkantLengte <= 400));
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
    return { module: 'Kies wat je wilt maken.', vorm: 'Kies een type.', maten: 'Vul alle maten in (binnen het bereik).', doek: 'Kies een doek én een kleur.',
             verwerking: 'Kies hoe je het doek verwerkt.', extras: 'Kies type en lengte voor elke rits.', bevestiging: 'Kies een bevestiging.' }[stap] || '';
  }

  function ga(stap) {
    S.stap = stap; S.melding = null;
    // Kap: trekbandjes aan de achterkant staan standaard aan (alleen zolang de klant ze nog niet zelf aan/uit zette)
    if (stap === 'extras' && modelKey() === 'buiskap') {
      S.draft.extras = S.draft.extras || {};
      if (S.draft.extras.trekband === undefined) S.draft.extras.trekband = { sets: trekbandSets(), beugel: 'rvs' };
    }
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
  function euro(n) { return '€ ' + C.money(n); }
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
    return '<span class="eskh-stepper" role="group" aria-label="' + esc(label || 'Aantal') + '"><button type="button" data-step="' + key + '" data-d="-1" aria-label="Minder">−</button>' +
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
      '<div class="eskh-stepname">' + (isOverzicht ? 'Overzicht' : ('Stap ' + (idx + 1) + (S.draft.module ? ' van ' + st.length : '') + ' · ' + STAPNAAM[S.stap])) + '</div></div>';

    if (!isOverzicht && S.draft.module && idx >= 2) html += previewHTML();
    html += '<div class="eskh-body" aria-live="polite">' + stapHTML() + '</div>';
    if (S.melding) html += '<div class="eskh-melding" role="alert">' + esc(S.melding) + '</div>';
    if (!isOverzicht) {
      var laatste = idx === st.length - 1 && !!S.draft.module;
      var toonVolgende = S.stap !== 'module' || !!S.draft.module;
      html += '<div class="eskh-nav">' +
        '<button type="button" class="eskh-btn eskh-btn-ghost" data-act="vorige"' + (idx <= 0 ? ' disabled' : '') + '>Vorige</button>' +
        (S.items.length ? '<button type="button" class="eskh-btn eskh-btn-link" data-act="naar-overzicht">Naar pakket (' + S.items.length + ')</button>' : '') +
        (toonVolgende ? '<button type="button" class="eskh-btn eskh-btn-primary' + (stapGeldig(S.stap) ? '' : ' is-disabled') + '" data-act="volgende" aria-disabled="' + (!stapGeldig(S.stap)) + '">' + (laatste ? 'Bekijk mijn pakket →' : 'Volgende') + '</button>' : '<span></span>') + '</div>';
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
        if (key === d.doek) dk.kleuren.forEach(function (k) { want.push(k); if (k.staal && k.vid === d.kleur) want.push(k.staal); });
      });
    }
    if (S.stap === 'overzicht') pakket().regels.forEach(function (r) { want.push(r); });
    if (S.stap === 'module') zonweringDoeken().forEach(function (dk) { dk.kleuren.forEach(function (k) { want.push(k); }); });
    if (S.stap !== 'overzicht' && d.vorm && d.doek && d.kleur) {
      try { P.regelsVoorItem(previewItem(), CAT).regels.forEach(function (r) { want.push(r); }); } catch (e) { }
      if (S.items.length) pakket().regels.forEach(function (r) { want.push(r); });
    }
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
      r.prijsWas = prijsVan(r.vid, r.prijs);
      r.prijsLive = r.gratis ? 0 : r.prijsWas;
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
    var stats = '<div class="eskh-stat"><small>Oppervlak</small><strong>' + nl(b.model.oppervlakM2 * b.aantal) + ' m²</strong></div>' +
      '<div class="eskh-stat"><small>Doek nodig</small><strong>' + b.plan.meters + ' m</strong></div>' +
      (b.punten ? '<div class="eskh-stat"><small>Bevestigers</small><strong>' + b.punten + '</strong></div>' :
                  '<div class="eskh-stat"><small>Rand</small><strong>' + nl(b.randCm / 100) + ' m</strong></div>');
    if (d.doek && d.kleur && P.doekKleur(CAT, d)) {
      var ind = indicatie();
      if (ind != null) stats += '<div class="eskh-stat eskh-stat-ind"><small>Indicatie' + (S.items.length ? ' (totaal)' : '') + '</small><strong>' + euro(ind) + '</strong></div>';
    }
    var plan = snijplanSVG(b.plan, kleur);
    var rolTxt = dk ? dk.doek.naam + ', ' + dk.doek.rolCm + ' cm breed' : 'indicatie bij ' + b.plan.rolCm + ' cm rolbreedte';
    return '<div class="eskh-preview"><div class="eskh-preview-vis">' + objectSVG(d, kleur) + '</div>' +
      '<div class="eskh-preview-info"><div class="eskh-stats">' + stats + '</div>' +
      '<details class="eskh-plan"><summary>Bekijk snijplan <span>(' + esc(rolTxt) + ')</span></summary>' + plan + '</details></div></div>';
  }
  /* prijsindicatie: dit item (met huidige keuzes) + wat al in het pakket staat */
  function indicatie() {
    try {
      var regels = P.regelsVoorItem(previewItem(), CAT).regels;
      var telt = function (r) { return !uitverkocht(r.vid); };
      var som = regels.filter(telt).reduce(function (t, r) { return t + (r.gratis ? 0 : r.qty * prijsVan(r.vid, r.prijs)); }, 0);
      if (S.items.length && S.editIdx < 0) som += pakket().regels.filter(telt).reduce(function (t, r) { return t + r.qty * r.prijsLive; }, 0);
      else if (S.items.length) {
        var rest = S.items.filter(function (x, i) { return i !== S.editIdx; });
        som += P.bouwPakket({ items: rest }, CAT).regels.filter(telt).reduce(function (t, r) { return t + (r.gratis ? 0 : r.qty * prijsVan(r.vid, r.prijs)); }, 0);
      }
      return som;
    } catch (e) { return null; }
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
    s += '<text x="1" y="' + (H + 16) + '" font-size="11" fill="#555">Rol ' + plan.rolCm + ' cm breed · ' + nl(plan.lengteCm / 100, 2) + ' m lang → ' + plan.meters + ' m besteld</text></svg>';
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
    if (mk === 'blok' || mk === 'buiskap' || mk === 'dekzeil') {
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

  function zonweringDoeken() {
    var keys = [];
    Object.keys(P.MODULES.zonwering.vormen).forEach(function (v) { P.MODULES.zonwering.vormen[v].doeken.forEach(function (d) { if (keys.indexOf(d) < 0) keys.push(d); }); });
    return keys.map(function (k) { return CAT.doeken[k]; }).filter(Boolean);
  }
  /* true als van alle zonwering-kleuren live bekend is dat ze niet leverbaar zijn */
  function zonweringUitverkocht() {
    var kl = [];
    zonweringDoeken().forEach(function (dk) { kl = kl.concat(dk.kleuren); });
    return kl.length > 0 && kl.every(function (k) { return uitverkocht(k.vid); });
  }
  function stapModule() {
    var h = '<h3>Wat wil je maken?</h3><div class="eskh-grid eskh-grid-3">';
    Object.keys(MODULE_KAART).forEach(function (k) {
      var m = MODULE_KAART[k];
      var binnenkort = k === 'zonwering' && zonweringUitverkocht();
      h += kaart('data-set="module" data-val="' + k + '"', (binnenkort ? '<span class="eskh-badge eskh-badge-alt">Binnenkort weer leverbaar</span>' : '') +
        '<span class="eskh-ico">' + m.icon + '</span><h4>' + m.titel + '</h4><p>' + m.tekst + '</p>' +
        (binnenkort ? '<p class="eskh-soon">Het gaasdoek is tijdelijk uitverkocht. Je kunt alvast je pakket samenstellen en delen, of bel ' + TELEFOON + ' voor de levertijd.</p>' : ''), S.draft.module === k);
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
    if (mk === 'buiskap') {
      h += '<div class="eskh-field">' + toggleRij('maten.voorkantSchuin', 'Voorkant loopt schuin', 'Staat de voorkant schuin naar achteren, zoals bij de meeste buiskappen? Meet de voorkant dan langs de schuinte, van dek tot dak. Uit = we rekenen met een rechte voorkant (de hoogte).', !!d.maten.voorkantSchuin) + '</div>';
      if (d.maten.voorkantSchuin) {
        var vk = d.maten.voorkantLengte, hmin = C.num(d.maten.hoogte || 30, 30, 250), vfout = vk == null || isNaN(vk) || vk < hmin || vk > 400;
        h += '<div class="eskh-field' + (vfout ? ' is-error' : '') + '"><label for="eskh-m-voorkantLengte">Lengte voorkant langs de schuinte</label>' +
          '<div class="eskh-field-row"><input type="range" min="' + hmin + '" max="400" step="5" value="' + (vfout ? hmin : vk) + '" data-maat="voorkantLengte" aria-label="Lengte voorkant (schuif)">' +
          '<span class="eskh-num"><input id="eskh-m-voorkantLengte" type="number" inputmode="decimal" min="' + hmin + '" max="400" step="1" value="' + (vk == null ? '' : vk) + '" data-maat="voorkantLengte"><em>cm</em></span></div>' +
          (vfout ? '<small class="eskh-err">Tussen ' + hmin + ' (de hoogte) en 400 cm</small>' : '') + '</div>';
      }
      h += '<div class="eskh-field">' + toggleRij('maten.achterkant', 'Achterkant meenemen', 'Sluit je de kap ook aan de achterzijde af? Ook die zetten we langs de onderrand vast.', !!d.maten.achterkant) + '</div>';
    }
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
      h += '</div>';
      var gek = d.kleur && dk.kleuren.filter(function (k) { return k.vid === d.kleur; })[0];
      var heeftStalen = dk.kleuren.some(function (k) { return k.staal; });
      if (gek && gek.staal && !uitverkocht(gek.staal.vid)) {
        h += '<div class="eskh-staal"><div><strong>Twijfel je over de kleur?</strong><span>Bestel eerst een staal van ' + esc(gek.naam) + ' en voel het doek zelf.</span></div>' +
          (S.staalOk === gek.staal.vid ? '<span class="eskh-stock eskh-stock-ok">✓ Staal in je winkelwagen</span>' :
            '<button type="button" class="eskh-btn eskh-btn-ghost eskh-btn-sm" data-act="staal"' + (S.bezig ? ' disabled' : '') + '>Staal bestellen (' + euro(prijsVan(gek.staal.vid, gek.staal.prijs)) + ')</button>') + '</div>';
      }
      h += '<p class="eskh-note">Kleuren op een scherm wijken af. ' + (heeftStalen ? 'Van dit doek kun je een staal bestellen. ' : '') + 'Twijfel? Bel ons: ' + TELEFOON + '.</p>';
    }
    return h;
  }

  function stapVerwerking() {
    var d = S.draft, dk = P.doekKleur(CAT, d), pvc = dk && dk.doek.soort === 'pvc';
    var h = '';
    if (pvc) {
      h += '<h3>Hoe ga je het doek verwerken?</h3><div class="eskh-grid eskh-grid-2">' +
        kaart('data-set="verwerking" data-val="lijmen"', '<span class="eskh-badge">Makkelijkst</span><span class="eskh-ico">🧪</span><h4>Lijmen</h4><p>Naden waterdicht verlijmen met Saba PVC-lijm. Geen naaimachine nodig.</p>', d.verwerking === 'lijmen') +
        kaart('data-set="verwerking" data-val="naaien"', '<span class="eskh-ico">🪡</span><h4>Naaien</h4><p>Stikken met UV-bestendig garen. Vraagt een stevige naaimachine.</p>', d.verwerking === 'naaien') + '</div>';
    } else {
      h += '<h3>Garen</h3><p class="eskh-sub">' + esc(dk ? dk.doek.naam : 'Dit doek') + ' wordt gestikt. Kies het bijpassende zeilmakersgaren.</p>';
      if (d.module === 'zonwering') h += '<div class="eskh-box"><strong>Rondom een gestikte zoom</strong><p class="eskh-note">Zeilringen kun je niet in enkel gaasdoek zetten: rondom komt een zoom van 5 cm (al meegerekend in de snijmaat). Sla de zoom om en stik hem vast, dan zit elke zeilring in twee lagen doek. Lijmen kan niet: gaasdoek heeft open gaatjes, daar hecht lijm niet op.</p></div>';
    }
    if (d.verwerking === 'naaien') {
      var auto = dk && dk.kleur.garen;
      h += '<div class="eskh-box"><div class="eskh-toggle-row"><div><strong>Bijpassend garen</strong><span>Coats Terko M36: UV-bestendig, rot niet. ' + (auto ? 'Wij kozen de kleur die het best bij <em>' + esc(dk.kleur.naam) + '</em> past.' : '') + '</span></div></div><div class="eskh-pills">';
      h += pill('data-garen=""', 'Geen garen nodig', !d.garen);
      Object.keys(CAT.garen).forEach(function (g) {
        var gp = CAT.garen[g];
        h += pill('data-garen="' + g + '"', '<i class="eskh-dot" style="background:' + gp.hex + '"></i>' + esc(gp.naam.replace(/^.*— /, '')) + (g === auto ? ' ★' : ''), d.garen === g, uitverkocht(gp.vid));
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
    h += '<div class="eskh-box">' + toggleRij('extras.raamfolie', '🪟 Raamfolie', 'Heldere, UV-bestendige Achilles-folie voor de ramen in je kap.', !!rf);
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
    var kap = modelKey() === 'buiskap';
    h += '<div class="eskh-box">' + toggleRij('extras.ritsen', '🤐 Deelbare ritsen', 'YKK 10 mm, zwart. Voor een deur in de kap of een oprolbaar deel.' + (kap ? ' Bij een kap zijn het meestal twee ritsen: van de onderkant van de ene zijkant tot het midden van het dak, en vanaf het midden naar de onderkant van de andere zijkant. We zetten er alvast twee klaar van ± ' + Math.round(ritsDoel() || 0) + ' cm (hoogte + halve breedte).' : ''), rz.length > 0);
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
    h += '<div class="eskh-box">' + toggleRij('extras.trekband', '🎗️ Trekbandjes met klemgesp', (kap ? 'Aan de achterkant van een kap zitten meestal een paar bandjes met een bandbeugel en klemgesp; die zetten we alvast aan. ' : '') + 'Polyester band 25 mm met RVS klemgesp om de kap strak te zetten. 1 set = 1 m band + 1 gesp.', !!tb);
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
      loxx: ['🔘', 'Zelfborgende drukknop: klikt vast en waait nooit uit zichzelf los.'],
      druk: ['⚪', 'Klassieke maritieme drukknopen. Snel vast en los.'],
      draai: ['🔄', 'Tourniquets: draaiers op de boot, kousen in het doek. Ijzersterk.'],
      ring: ['⭕', 'Zeilringen in de rand, met elastisch koord om knoppen of haken.'],
      tunnel: ['〰️', 'Koord door een zoom rondom: aantrekken en klaar. Simpel en strak.'],
      klit: ['🧷', 'Zelfklevend klittenband langs de rand. Geen gereedschap nodig.'],
      zuignap: ['🪟', 'Zuignappen aan de binnenzijde van het glas, met een zeilring per zuignap.'],
      balkon: ['🏙️', 'Oogjes (zeilringen) in de zoom, met elastisch koord of tie-wraps aan de reling of balustrade.']
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
    if (b === 'draai') h += opties('Merk / maat:', 'draaiMerk', [['prym', 'Prym (15 × 9 mm)'], ['mh', 'MH (17 × 11 mm)']]);
    if (b === 'ring') {
      h += opties('Zeilring:', 'ringDin', [[12, 'DIN 12'], [10, 'DIN 10'], [16, 'DIN 16 (zwaar)']]) +
           opties('Materiaal:', 'ringMat', [['rvs', 'RVS'], ['messing', 'Messing']]) +
           opties('Koord:', 'koordDikte', [[6, '6 mm'], [8, '8 mm']]) + opties('Kleur koord:', 'koordKleur', [['zwart', 'Zwart'], ['wit', 'Wit']]) +
           opties('Vastzetten aan:', 'aanslag', [['koordhaak', 'Koordhaken'], ['musketon', 'Musketonhaken'], ['rondknop', 'Rondknoppen (kunststof)'], ['noorse_knop', 'Noorse knoppen (RVS)'], ['geen', 'Heb ik al']]);
    }
    if (b === 'tunnel') h += opties('Koord:', 'koordDikte', [[6, '6 mm'], [8, '8 mm']]) + opties('Kleur koord:', 'koordKleur', [['zwart', 'Zwart'], ['wit', 'Wit']]);
    if (b === 'balkon') {
      h += opties('Aan de reling met:', 'balkonVast', [['koord', 'Elastisch koord (shockcord)'], ['tiewrap', 'Tie-wraps']]);
      if ((o.balkonVast || 'koord') === 'koord') h += opties('Kleur koord:', 'koordKleur', [['zwart', 'Zwart'], ['wit', 'Wit']]);
    }
    if (b === 'klit') h += opties('Breedte:', 'klitBreedte', [[25, '25 mm'], [50, '50 mm (stevig)']]);

    var bv = P.BEVESTIGING[b];
    if (bv.afstand) {
      var afst = d.afstandCm || bv.afstand;
      var punten = 0;
      try { punten = P.berekenItem(Object.assign({}, previewItem(), { afstandCm: afst }), CAT).punten; } catch (e) { }
      h += '<div class="eskh-field"><label>Maximale afstand tussen bevestigers: <strong>' + afst + ' cm</strong> → ' + punten + ' stuks</label>' +
        '<input type="range" min="10" max="' + (b === 'zuignap' || b === 'balkon' ? 80 : 60) + '" step="5" value="' + afst + '" data-afstand aria-label="Afstand tussen bevestigers"></div>' +
        '<p class="eskh-note">In elke hoek komt een bevestiger; daartussen verdelen we ze gelijk, zodat ze recht en symmetrisch op elke zijde staan. Advies: 20–30 cm voor kappen (windvast), 30–50 cm voor zeilen en zonwering.</p>';
    }
    var heeftTool = b === 'loxx' || b === 'druk' || b === 'draai' || b === 'ring' || b === 'zuignap' || b === 'balkon';
    if (heeftTool) h += toggleRij('gereedschap', 'Gereedschap meebestellen', 'Holpijp, stempel, stansblok en/of montagesleutel om de onderdelen zelf in het doek te zetten. Zonder gereedschap lukt het niet. Heb je het al? Zet dit uit.', d.gereedschap !== false);
    return h + '</div>';
  }

  /* ---------------- overzicht ---------------- */
  var ONDERHOUD = [
    ['fabric_guard', '🛡️', 'Impregneer na verloop van tijd (acryl en polyester).'],
    ['multi_cleaner', '🧴', 'Reinigt doek, kunststof en andere buitenoppervlakken. Niet voor ramen of raamfolie.'],
    ['glaspotlood', '✏️', 'Aftekenen op doek, folie en glas.'],
    ['zeilnaalden', '🪡', 'Voor handwerk en reparaties.'],
    ['stansblok', '🟥', 'Extra stansblok als ondergrond.']
  ];

  function itemLabel(it, i) {
    var def = P.MODULES[it.module].vormen[it.vorm];
    var obj = it.object && OBJECTEN.filter(function (o) { return o.key === it.object; })[0];
    var m = it.maten, mk = def.model;
    var maat = mk === 'rond' ? 'Ø ' + m.diameter + ' × ' + m.hoogte + ' cm' :
      mk === 'dekzeil' ? m.lengte + ' × ' + m.breedte + ' cm, rok ' + m.hoogte + ' cm' :
      (MAATVELDEN[mk] || []).filter(function (f) { return f[0] !== 'overhang' && f[0] !== 'radius'; }).map(function (f) { return m[f[0]]; }).join(' × ') + ' cm';
    return (i + 1) + '. ' + (obj ? obj.titel : def.naam) + ' · ' + maat + (it.aantal > 1 ? ' · ' + it.aantal + '×' : '');
  }

  function stapOverzicht() {
    if (!S.items.length) return '<p>Je pakket is leeg.</p><button type="button" class="eskh-btn eskh-btn-primary" data-act="nieuw">Begin opnieuw</button>';
    var pk = pakket();
    var h = '';
    // doekgroep per item (items met hetzelfde doek + kleur delen één snijplan)
    var doekGroep = {};
    (pk.snijplannen || []).forEach(function (g) { if (g.soort === 'doek') g.items.forEach(function (i) { doekGroep[i] = g; }); });
    // per item
    S.items.forEach(function (it, i) {
      var r = pk.perItem[i];
      var b = r.berekening, dk = b.dk;
      var g = doekGroep[i], gedeeld = g && g.items.length > 1;
      var doekTxt = gedeeld ? 'deelt ' + g.plan.meters + ' m doek met item ' + g.items.filter(function (j) { return j !== i; }).map(function (j) { return j + 1; }).join(', ') : b.plan.meters + ' m doek';
      h += '<div class="eskh-item"><div class="eskh-item-head"><div><strong>' + esc(itemLabel(it, i)) + '</strong><span>' +
        esc(dk.doek.naam + ' ' + dk.kleur.naam) + ' · ' + esc(P.BEVESTIGING[it.bevestiging].naam) + ' · ' + esc(doekTxt) + '</span></div>' +
        '<div class="eskh-item-acts"><button type="button" data-edit="' + i + '">Wijzig</button><button type="button" data-dup="' + i + '">Dupliceer</button><button type="button" data-del="' + i + '">Verwijder</button></div></div>' +
        '<details class="eskh-plan"><summary>Bouwtekening &amp; berekening <span>(voorbeeld)</span></summary>' +
        '<p class="eskh-note">Netto oppervlak ' + nl(b.model.oppervlakM2 * b.aantal) + ' m² · rand ' + nl(b.randCm / 100) + ' m' +
        (b.punten ? ' · ' + b.punten + ' bevestigingspunten (in elke hoek, daartussen max. ±' + b.afstand + ' cm)' : '') + '. Incl. ' + nl(b.zoom, 0) + ' cm zoom per rand' + (it.bevestiging === 'tunnel' && b.zoom === C.R.zoomCm ? ' (+8 cm tunnel aan de onderrand)' : '') + '.</p>' +
        BT.html(it, b, { snijplan: !gedeeld }) +
        (gedeeld ? '<p class="eskh-note">De stukken van dit item staan in het gezamenlijke snijplan hieronder.</p>' : '') + '</details></div>';
    });
    // gezamenlijke snijplannen (alleen als items doek of raamfolie delen)
    var gedeeldePlannen = (pk.snijplannen || []).filter(function (g) { return g.items.length > 1; });
    if (gedeeldePlannen.length) {
      h += '<div class="eskh-box eskh-gezamenlijk"><strong>Gezamenlijk snijplan</strong>' +
        '<p class="eskh-note">Items met hetzelfde doek snijden we uit één stuk: dat scheelt doek. Het nummer voor de naam is het item.</p>';
      gedeeldePlannen.forEach(function (g) {
        var label = function (p) { return (p.item + 1) + '· ' + p.naam.replace(/ \(baan.*\)/, ''); };
        var los = g.los > g.plan.meters ? ' <em>(' + (g.los - g.plan.meters) + ' m minder dan elk item apart)</em>' : '';
        h += '<details class="eskh-plan" open><summary>' + esc(g.naam) + ': ' + g.plan.meters + ' m voor item ' + g.items.map(function (i) { return i + 1; }).join(', ') + los + '</summary>' +
          BT.snijplanSVG(g.plan, { kleur: g.dk ? g.dk.kleur.hex : '#e5f0ff', label: label }) + BT.snijlijstHTML(g.plan, label) + '</details>';
      });
      h += '<p class="eskh-bt-disclaimer">' + esc(BT.DISCLAIMER) + '</p></div>';
    }
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
        var lt = r.qty * r.prijsLive;
        var uit = uitverkocht(r.vid) && r.qty > 0;
        if (!uit) totaal += lt;
        if (uit) problemen++;
        var gewijzigd = r.qty !== r.berekend;
        h += '<div class="eskh-line' + (r.qty === 0 ? ' is-zero' : '') + (uit ? ' is-out' : '') + '">' +
          '<div class="eskh-line-info">' + (r.img ? '<img src="' + img(r.img, '80x80x2') + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
          '<div><a href="/' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.naam) + '</a>' + statusBadge(r.vid) +
          '<p>' + esc(r.notitie || '') + (gewijzigd ? ' <em>(berekend: ' + r.berekend + ')</em>' : '') + '</p>' +
          (uit ? '<p class="eskh-err">Dit product is nu niet leverbaar. Kies een andere variant of zet het aantal op 0. Vragen? Bel ' + TELEFOON + '.</p>' : '') + '</div></div>' +
          '<div class="eskh-line-qty">' + stepper('qty:' + r.vid, r.qty, 0, 999, 'Aantal ' + r.naam) + '<small>' + (r.unit === 'm' ? 'meter' : r.unit === 'rol' ? 'rol' : (r.verpakking > 1 ? 'stuks (per ' + r.verpakking + ')' : 'stuks')) + '</small></div>' +
          '<div class="eskh-line-price">' + (r.gratis
            ? '<s class="eskh-was">' + euro(r.qty * r.prijsWas) + '</s> ' + euro(0) + '<small class="eskh-gratis">Gratis</small>'
            : euro(lt) + '<small>' + euro(r.prijsLive) + ' / ' + (r.unit === 'm' ? 'm' : 'st') + '</small>') + '</div></div>';
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
    h += '<div class="eskh-total"><div><span>Totaal incl. btw</span><strong>' + euro(totaal) + '</strong><small>Prijzen live uit de shop · exclusief verzendkosten</small></div>' +
      '<button type="button" class="eskh-btn eskh-btn-cta" data-act="cart"' + (kanBestellen ? '' : ' disabled') + '>' +
      (S.bezig ? '<span class="eskh-spin"></span> ' + esc(S.bezig) : 'Alles in winkelwagen') + '</button></div>';
    if (problemen) h += '<div class="eskh-melding" role="alert">' + problemen + ' product(en) zijn niet leverbaar. Die slaan we over; pas ze aan of bel ' + TELEFOON + '.</div>';
    if (S.cartResultaat) h += S.cartResultaat;
    h += '<div class="eskh-share"><button type="button" class="eskh-link" data-act="deel">🔗 Kopieer link naar dit pakket</button>' +
      '<button type="button" class="eskh-link" data-act="print">🖨️ Print / bewaar als PDF</button>' +
      (S.resetVraag
        ? '<span class="eskh-reset-vraag" role="alert">Je pakket wordt gewist. Zeker weten? <button type="button" class="eskh-link eskh-link-danger" data-act="reset-ja">Ja, opnieuw beginnen</button> <button type="button" class="eskh-link" data-act="reset-nee">Annuleren</button></span>'
        : '<button type="button" class="eskh-link" data-act="reset">↺ Opnieuw beginnen</button>') + '</div>';
    return h;
  }

  /* ---------------- winkelwagen ---------------- */
  function naarWinkelwagen() {
    var pk = pakket();
    var regels = pk.regels.filter(function (r) { return r.qty > 0 && !uitverkocht(r.vid); });
    if (!regels.length) return;
    S.bezig = 'Bezig…'; S.cartResultaat = null; render();
    LIVE.track('keuzehulp_cart_start', {});
    LIVE.zetInWinkelwagen(regels, function (i, n) {
      S.bezig = 'Toevoegen ' + i + ' van ' + n + '…';
      var btn = root$.querySelector('[data-act="cart"]'); if (btn) btn.innerHTML = '<span class="eskh-spin"></span> ' + S.bezig;
    }).then(function (res) {
      S.bezig = false;
      var waarde = res.ok.reduce(function (s, r) { return s + r.qty * r.prijsLive; }, 0);
      if (res.ok.length) LIVE.track('add_to_cart', { ecommerce: { currency: 'EUR', value: Math.round(waarde * 100) / 100, items: LIVE.ga4Items(res.ok) }, keuzehulp: true });
      if (!res.fout.length) {
        LIVE.track('keuzehulp_cart_klaar', { keuzehulp_regels: res.ok.length, value: Math.round(waarde * 100) / 100 });
        try { localStorage.removeItem(STORE_KEY); } catch (e) { }
        naarCartPagina(res.ok);
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
  /* Demo/test-haak: window.ESKH_DEMO.klaar(regels) i.p.v. naar /cart/ te navigeren */
  function naarCartPagina(regels) {
    if (root.ESKH_DEMO && typeof root.ESKH_DEMO.klaar === 'function') { root.ESKH_DEMO.klaar(regels); return; }
    location.href = '/cart/';
  }
  function retryWinkelwagen() {
    var regels = S.retry || []; if (!regels.length) return;
    S.bezig = 'Opnieuw proberen…'; render();
    LIVE.zetInWinkelwagen(regels).then(function (res) {
      S.bezig = false;
      if (!res.fout.length) { naarCartPagina(res.ok); return; }
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
  /* Rits bij een kap: meestal één opening over de kap, van de onderkant van de
     ene zijkant via het dak naar de onderkant van de andere zijkant, verdeeld
     over twee ritsen die in het midden van het dak samenkomen. Eén rits is dan
     ± hoogte + halve breedte; we kiezen de kortste leverbare lengte die dat haalt. */
  function ritsDoel() {
    var m = S.draft.maten || {};
    return modelKey() === 'buiskap' && m.breedte > 0 && m.hoogte > 0 ? m.hoogte + m.breedte / 2 : null;
  }
  function ritsLengte(type) {
    var lengtes = Object.keys(CAT.ritsen[type] || {}).map(Number).sort(function (a, b) { return a - b; });
    var doel = ritsDoel();
    if (!lengtes.length || !doel) return null;
    for (var i = 0; i < lengtes.length; i++) if (lengtes[i] >= doel && !uitverkocht(CAT.ritsen[type][String(lengtes[i])].vid)) return lengtes[i];
    return lengtes[lengtes.length - 1];
  }
  /* Trekbandjes aan de achterkant van een kap: ongeveer één per 80 cm breedte, minstens 2. */
  function trekbandSets() {
    var B = S.draft.maten && S.draft.maten.breedte;
    return modelKey() === 'buiskap' && B > 0 ? Math.max(2, Math.round(B / 80)) : 4;
  }
  function kiesVorm(v) {
    var d = S.draft;
    if (d.vorm === v) return;
    d.vorm = v; d.doek = null; d.kleur = null; d.bevestiging = null; d.opt = {}; d.afstandCm = null;
    var mk = vormDef().model, def = {
      buiskap: { lengte: 250, breedte: 220, hoogte: 110 }, bimini: { lengte: 200, breedte: 200 }, plat: { lengte: 700, breedte: 260, overhang: 30 }, dekzeil: { lengte: 700, breedte: 260, hoogte: 30 },
      zonwering: { breedte: 120, hoogte: 100 }
    }[mk];
    if (def) d.maten = JSON.parse(JSON.stringify(def));
    if (d.module === 'zonwering') d.verwerking = 'naaien';
    if (d.module === 'bootkap' && CAT.doeken[vormDef().doeken[0]].soort !== 'pvc') d.verwerking = 'naaien'; else if (d.module !== 'zonwering') d.verwerking = null;
  }
  function kiesDoek(key) {
    var d = S.draft;
    if (d.doek === key) return;
    d.doek = key;
    var dk = CAT.doeken[key];
    var eerst = dk.kleuren.filter(function (k) { return !uitverkocht(k.vid); })[0];
    d.kleur = dk.kleuren.length === 1 ? dk.kleuren[0].vid : null;
    if (dk.soort !== 'pvc') d.verwerking = 'naaien'; // acryl, polyester en gaas worden gestikt (gaas: lijm laat in de zon los)
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
      // Niet-leverbare kleur blokkeren, behalve als het hele doek tijdelijk uitverkocht is: dan kan de
      // klant zijn pakket wel samenstellen en delen (zoals de modulekaart belooft); het doek gaat niet in de winkelwagen.
      var dkAlles = CAT.doeken[d.doek], alleUit = dkAlles && dkAlles.kleuren.every(function (k) { return uitverkocht(k.vid); });
      if (t.getAttribute('aria-disabled') === 'true' && !alleUit) { S.melding = 'Deze kleur is nu niet leverbaar. Kies een andere kleur of bel ' + TELEFOON + '.'; render(); return; }
      d.kleur = t.getAttribute('data-kleur');
      var dkk = P.doekKleur(CAT, d);
      if (dkk && d.verwerking === 'naaien') d.garen = dkk.kleur.garen || null;
      if (alleUit) { S.melding = 'Dit doek is tijdelijk uitverkocht. Je kunt je pakket wel samenstellen en delen; het doek zetten we nog niet in de winkelwagen. Vragen over de levertijd? Bel ' + TELEFOON + '.'; render(); return; }
      var dk2 = P.doekKleur(CAT, d);
      if (dk2 && d.verwerking === 'naaien') d.garen = dk2.kleur.garen || null;
      S.melding = null; render(); return;
    }
    if (t.hasAttribute('data-garen')) { d.garen = t.getAttribute('data-garen') || null; render(); return; }
    if (t.hasAttribute('data-path-set')) {
      var v = t.getAttribute('data-val'), p = t.getAttribute('data-path-set');
      if (/^opt\.(ringDin|koordDikte|klitBreedte)$/.test(p)) v = parseInt(v, 10);
      setPath(p, v === '' ? null : v);
      // ander type rits: lengte opnieuw kiezen als die er bij dit type niet is
      var rm = /^extras\.ritsen\.(\d+)\.type$/.exec(p);
      if (rm) { var rz = d.extras.ritsen[+rm[1]]; if (!rz.lengte || !CAT.ritsen[v][String(rz.lengte)]) rz.lengte = ritsLengte(v); }
      S.melding = null; render(); return;
    }
    if (t.hasAttribute('data-toggle')) {
      var k = t.getAttribute('data-toggle');
      if (k === 'gereedschap') d.gereedschap = d.gereedschap === false;
      else if (k === 'ontvetter') d.ontvetter = d.ontvetter === false;
      else if (k === 'extras.raamfolie') setPath(k, getPath(k) ? null : { breedte: null, hoogte: null, aantal: 1, soort: 'helder', tape: '9' });
      else if (k === 'extras.ritsen') setPath(k, (getPath(k) || []).length ? [] : [{ type: 'spiraal', lengte: ritsLengte('spiraal'), aantal: ritsDoel() ? 2 : 1 }]);
      else if (k === 'extras.trekband') setPath(k, getPath(k) ? null : { sets: trekbandSets(), beugel: 'rvs' });
      else if (k === 'maten.voorkantSchuin') { d.maten.voorkantSchuin = !d.maten.voorkantSchuin; if (d.maten.voorkantSchuin && !(d.maten.voorkantLengte > 0)) d.maten.voorkantLengte = Math.round((d.maten.hoogte || 100) * 1.2 / 5) * 5; }
      else setPath(k, !getPath(k));
      render(); return;
    }
    if (t.hasAttribute('data-step')) {
      var sk = t.getAttribute('data-step'), delta = parseInt(t.getAttribute('data-d'), 10);
      if (sk.indexOf('qty:') === 0) {
        var vid = sk.slice(4), r = pakket().regels.filter(function (x) { return x.vid === vid; })[0];
        S.overrides[vid] = Math.max(0, (r ? r.qty : 0) + delta * ((r && r.verpakking) || 1));
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
    if (act === 'rits-plus') { d.extras.ritsen.push({ type: 'spiraal', lengte: ritsLengte('spiraal'), aantal: 1 }); render(); return; }
    if (act === 'cart') { naarWinkelwagen(); return; }
    if (act === 'staal') {
      var sk = P.doekKleur(CAT, d);
      if (!sk || !sk.kleur.staal) return;
      var st = sk.kleur.staal;
      S.bezig = 'Staal toevoegen…'; render();
      LIVE.zetInWinkelwagen([{ vid: st.vid, qty: 1, naam: 'Staal ' + sk.doek.naam + ' ' + sk.kleur.naam, prijs: st.prijs }]).then(function (res) {
        S.bezig = false;
        if (res.fout.length) S.melding = 'Het staal kon niet worden toegevoegd. Probeer het opnieuw of bel ' + TELEFOON + '.';
        else { S.staalOk = st.vid; LIVE.track('keuzehulp_staal', { keuzehulp_doek: sk.doek.naam, keuzehulp_kleur: sk.kleur.naam }); }
        render();
      });
      return;
    }
    if (act === 'cart-retry') { retryWinkelwagen(); return; }
    if (act === 'print') {
      // bouwtekeningen en snijplannen openklappen voor de print, daarna terugzetten
      var dicht = [].slice.call(root$.querySelectorAll('details:not([open])'));
      dicht.forEach(function (el) { el.open = true; });
      var terug = function () { dicht.forEach(function (el) { el.open = false; }); window.removeEventListener('afterprint', terug); };
      window.addEventListener('afterprint', terug);
      window.print();
      return;
    }
    // Bevestiging in de pagina zelf: window.confirm wordt door sommige (in-app) browsers stil geblokkeerd.
    if (act === 'reset') { S.resetVraag = true; render(); return; }
    if (act === 'reset-nee') { S.resetVraag = false; render(); return; }
    if (act === 'reset-ja') {
      resetState();
      try { localStorage.removeItem(STORE_KEY); } catch (e2) { }
      if (/[#&]kh=/.test(location.hash || '')) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e3) { } }
      render(true); return;
    }
    if (act === 'deel') {
      var link = deelLink();
      var klaar = function () { t.textContent = '✓ Link gekopieerd'; };
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
      if (key.indexOf('qty:') === 0) { var rv = pakket().regels.filter(function (x) { return x.vid === key.slice(4); })[0], vp = (rv && rv.verpakking) || 1; S.overrides[key.slice(4)] = isNaN(n) ? 0 : Math.ceil(Math.max(0, n) / vp) * vp; }
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
    if (!C || !P || !CAT || !LIVE || !BT) return false;
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
