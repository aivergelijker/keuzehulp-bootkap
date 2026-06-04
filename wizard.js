/* =====================================================================
   eSails Bootkap Keuzehulp  -  Custom JavaScript
   ---------------------------------------------------------------------
   Deze code bouwt de VOLLEDIGE wizard zelf op binnen #esails-wizard-mount.
   Daardoor maakt het niet meer uit of de CMS-editor lange HTML afkapt:
   in de CMS-pagina staat alleen een kort, onafkapbaar <div>.

   TE DOEN: vervang in CONFIG hieronder elke "id" met een echt
   Lightspeed product-ID (een getal, te vinden in de product-URL in je
   back office). Placeholders beginnen met "ID_".
   ===================================================================== */
window.esailsWizard = (function () {
  "use strict";

  /* -------------------- CONFIGURATIE -------------------- */
  var CONFIG = {
    stoffen: {
      premium_acryl: {
        jet_black: { id: "ID_ACRYL_ZWART", naam: "Sunbrella Plus - Jet Black (Zwart)", prijs: 34.95, unit: "meter" },
        navy_blue: { id: "ID_ACRYL_BLAUW", naam: "Sunbrella Plus - Navy Blue (Donkerblauw)", prijs: 34.95, unit: "meter" },
        dark_grey: { id: "ID_ACRYL_GRIJS", naam: "Sunbrella Plus - Antraciet", prijs: 34.95, unit: "meter" },
        ecru:      { id: "ID_ACRYL_ECRU",  naam: "Sunbrella Plus - Ecru", prijs: 34.95, unit: "meter" }
      },
      heavy_pvc: {
        jet_black: { id: "ID_PVC_ZWART", naam: "Heavy-Duty PVC - Zwart", prijs: 19.95, unit: "meter" },
        navy_blue: { id: "ID_PVC_BLAUW", naam: "Heavy-Duty PVC - Marine Blauw", prijs: 19.95, unit: "meter" },
        dark_grey: { id: "ID_PVC_GRIJS", naam: "Heavy-Duty PVC - Grijs", prijs: 19.95, unit: "meter" },
        ecru:      { id: "ID_PVC_ECRU",  naam: "Heavy-Duty PVC - Off-White", prijs: 19.95, unit: "meter" }
      },
      polyester_comfort: {
        jet_black: { id: "ID_POLY_ZWART", naam: "eSails Comfort Polyester - Zwart", prijs: 24.95, unit: "meter" },
        navy_blue: { id: "ID_POLY_BLAUW", naam: "eSails Comfort Polyester - Navy", prijs: 24.95, unit: "meter" },
        dark_grey: { id: "ID_POLY_GRIJS", naam: "eSails Comfort Polyester - Grijs", prijs: 24.95, unit: "meter" },
        ecru:      { id: "ID_POLY_ECRU",  naam: "eSails Comfort Polyester - Ecru", prijs: 24.95, unit: "meter" }
      }
    },
    fournituren: {
      tenax_knop:      { id: "ID_TENAX_KNOP", naam: "Tenax Knop Bovendeel (RVS)", prijs: 2.50, unit: "stuks" },
      tenax_schroef:   { id: "ID_TENAX_SCHROEF", naam: "Tenax Zelftappende Schroef 16mm", prijs: 1.50, unit: "stuks" },
      tenax_sleutel:   { id: "ID_TENAX_SLEUTEL", naam: "Tenax Montagesleutel (Onmisbaar)", prijs: 4.95, unit: "stuks" },
      draaisluiting:   { id: "ID_DRAAI_SLUITING", naam: "Traditionele Draaisluiting Messing", prijs: 1.95, unit: "stuks" },
      dot_drukknoop:   { id: "ID_DOT_DRUKKNOOP", naam: "DOT Drukknoop Set RVS", prijs: 1.20, unit: "stuks" },
      zeiloog_set:     { id: "ID_ZEILOOG_SET", naam: "Messing Zeilringen + Stempelset", prijs: 14.95, unit: "stuks" },
      elastisch_koord: { id: "ID_ELASTISCH_KOORD", naam: "Elastisch Schokkoord 6mm", prijs: 2.25, unit: "meter" },
      garen:           { id: "ID_GAREN_MATCH", naam: "Zeilmakersgaren UV-bestendig", prijs: 18.50, unit: "klos" },
      vensterfolie:    { id: "ID_VENSTERFOLIE", naam: "Premium Vensterfolie 0.5mm (120cm breed)", prijs: 14.95, unit: "meter" },
      ykk_rits:        { id: "ID_YKK_RITS", naam: "YKK Heavy-Duty Deelbare Rits 200cm", prijs: 14.95, unit: "stuks" },
      trekbandjes:     { id: "ID_TREKBANDJES", naam: "Trekbandjes met RVS gespen set", prijs: 9.95, unit: "set" },
      microvezel:      { id: "ID_MICROVEZEL", naam: "eSails Premium Microvezel Doekenset", prijs: 12.95, unit: "set" }
    }
  };

  var TOTAL_INPUT_STEPS = 6;
  var RESULT_STEP = 7;

  /* -------------------- STATE -------------------- */
  var state;
  function resetState() {
    state = {
      currentStep: 1, toepassing: null, boot_type: null, boot_lengte: 7.0,
      doek_type: null, kleur: null, bevestiging: null,
      extra_ramen: false, extra_ritsen: false, extra_trekbandjes: false,
      bundle: {}
    };
  }

  /* -------------------- HTML-TEMPLATE -------------------- */
  /* De volledige wizard als string. Wordt in de mount geïnjecteerd. */
  function wizardHTML() {
    return '' +
    '<div class="esails-wizard-header">' +
      '<h2>Bootkap &amp; Dekzeil Keuzehulp</h2>' +
      '<p>Stel in een paar stappen jouw ideale materiaalpakket samen</p>' +
      '<div class="esails-progress-wrapper"><div class="esails-progress-bar" id="esailsProgressBar" style="width:16.6%;"></div></div>' +
      '<div class="esails-step-indicator" id="esailsStepIndicator">Stap 1 van 6: Toepassing</div>' +
    '</div>' +

    /* STAP 1 */
    '<div class="esails-wizard-step active" data-step="1">' +
      '<h3>Wat wil je gaan maken of vervangen?</h3>' +
      '<div class="esails-card-grid">' +
        card('toepassing','buiskap','⛵','Buiskap / Achtertent','Luxe, ademende bescherming voor dagelijks intensief gebruik.') +
        card('toepassing','dekzeil','⚓','Dekzeil / Winterkleed','Heavy-duty, 100% waterdichte bescherming tegen extreme weersinvloeden.') +
        card('toepassing','bimini','☀️','Bimini / Zonnedek','Lichtgewicht UV-bescherming en schaduw voor warme zomerdagen.') +
      '</div>' +
    '</div>' +

    /* STAP 2 */
    '<div class="esails-wizard-step" data-step="2">' +
      '<h3>Type vaartuig en afmetingen</h3>' +
      '<p class="esails-step-subtitle">Dit helpt ons de benodigde hoeveelheid materialen te berekenen.</p>' +
      '<div class="esails-card-grid esails-grid-2">' +
        cardSimple('boot_type','sloep','Sloep / Motorboot') +
        cardSimple('boot_type','zeilboot','Zeilboot') +
      '</div>' +
      '<div class="esails-slider-wrapper">' +
        '<label for="esailsBootLengte">Totale lengte van de boot: <span id="esailsLengteWeergave">7.0</span> meter</label>' +
        '<input type="range" id="esailsBootLengte" min="4" max="15" step="0.5" value="7">' +
      '</div>' +
    '</div>' +

    /* STAP 3 */
    '<div class="esails-wizard-step" data-step="3">' +
      '<h3>Kies de prestatieklasse van het doek</h3>' +
      '<div class="esails-card-grid">' +
        cardBadge('doek_type','premium_acryl','Meest gekozen','Premium Maritiem Acryl','Luxe geweven look, ademend (voorkomt schimmel), extreme UV-stabiliteit en kleurvastheid.') +
        cardSimpleDesc('doek_type','heavy_pvc','Heavy-Duty PVC','100% waterdicht vrachtwagenzeil-kwaliteit. Oersterk, vlekbestendig en eenvoudig afneembaar.') +
        cardSimpleDesc('doek_type','polyester_comfort','Lichtgewicht Polyester','Soepel, compact op te vouwen en zeer hanteerbaar. Ideaal voor lichtere zomerafdekking.') +
      '</div>' +
    '</div>' +

    /* STAP 4 */
    '<div class="esails-wizard-step" data-step="4">' +
      '<h3>Kies de gewenste kleur</h3>' +
      '<p class="esails-step-subtitle">We koppelen hier automatisch de juiste kleur professioneel zeilmakersgaren aan.</p>' +
      '<div class="esails-color-grid">' +
        colorCard('jet_black','#1a1a1a','Jet Black (Zwart)','') +
        colorCard('navy_blue','#0f1c3f','Navy Blue (Donkerblauw)','') +
        colorCard('dark_grey','#4a4a4a','Antraciet / Grijs','') +
        colorCard('ecru','#e8e3d3','Ecru / Hennep','border:1px solid #ccc;') +
      '</div>' +
    '</div>' +

    /* STAP 5 */
    '<div class="esails-wizard-step" data-step="5">' +
      '<h3>Extra opties en toevoegingen</h3>' +
      '<p class="esails-step-subtitle">Selecteer de extra componenten die je wilt toevoegen aan je project. Meerdere keuzes mogelijk.</p>' +
      '<div class="esails-card-grid">' +
        multiCard('extra_ramen','🪟','Premium Raamfolie','Voeg hoogwaardige, UV-gestabiliseerde vensterfolie toe voor optimaal zicht.') +
        multiCard('extra_ritsen','🤐','YKK Heavy-Duty Ritsen','Voeg deelbare ritsen toe voor het maken van een achterdeur of oprolbare delen.') +
        multiCard('extra_trekbandjes','🎗️','Trekbandjes met Gespen','Handige spanbandjes inclusief rvs gespen om de kap perfect strak te fixeren.') +
      '</div>' +
    '</div>' +

    /* STAP 6 */
    '<div class="esails-wizard-step" data-step="6">' +
      '<h3>Welk bevestigingssysteem gebruik je?</h3>' +
      '<div class="esails-card-grid">' +
        cardSimpleDesc('bevestiging','tenax','Tenax / Loxx Systeem','Zelfborgende drukknoppen. Kunnen niet losscheuren door wind.') +
        cardSimpleDesc('bevestiging','draaisluiting','Traditionele Draaisluitingen','Klassieke messing/koperen draaiers met zeilkousen in het doek.') +
        cardSimpleDesc('bevestiging','dot_drukknoop','DOT Drukknopen','Standaard RVS maritieme drukknopen voor snelle montage.') +
        cardSimpleDesc('bevestiging','zeiloog_koord','Zeilringen &amp; Elastisch Koord','Ideaal voor vlakke dekzeilen en winterafdekkingen.') +
      '</div>' +
    '</div>' +

    /* STAP 7 */
    '<div class="esails-wizard-step" data-step="7">' +
      '<div class="esails-success-banner">' +
        '<h3>✓ Jouw eSails Maatwerk Advies is klaar!</h3>' +
        '<p>Op basis van je keuzes hebben we het ideale pakket samengesteld. Pas de aantallen naar wens aan.</p>' +
      '</div>' +
      '<div class="esails-configuration-board">' +
        '<div class="esails-board-header"><span>Geselecteerd Component</span><span style="text-align:right;">Aantal / Prijs</span></div>' +
        '<div id="esailsDynamicLines"></div>' +
        '<div class="esails-board-footer">' +
          '<div class="esails-total-price">Totaalprijs pakket: <span id="esailsTotalAmount">€ 0,00</span></div>' +
          '<button type="button" class="esails-btn-submit" id="esailsBtnAddToCart">' +
            '<span class="btn-text">Voeg complete pakket toe aan winkelwagen</span>' +
            '<div class="esails-loader" style="display:none;"></div>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* NAVIGATIE */
    '<div class="esails-wizard-navigation" id="esailsNav">' +
      '<button type="button" class="esails-btn esails-btn-secondary" id="esailsBtnPrev" disabled>Vorige</button>' +
      '<button type="button" class="esails-btn esails-btn-primary" id="esailsBtnNext" disabled>Volgende</button>' +
    '</div>';
  }

  /* -------- kleine template-helpers (voorkomt typefouten/herhaling) -------- */
  function card(key, val, icon, titel, tekst) {
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '">' +
      '<div class="esails-card-icon">' + icon + '</div>' +
      '<h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }
  function cardSimple(key, val, titel) {
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '"><h4>' + titel + '</h4></div>';
  }
  function cardSimpleDesc(key, val, titel, tekst) {
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '"><h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }
  function cardBadge(key, val, badge, titel, tekst) {
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '">' +
      '<span class="esails-badge">' + badge + '</span><h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }
  function colorCard(val, hex, titel, extraStyle) {
    return '<div class="esails-color-card" data-key="kleur" data-value="' + val + '">' +
      '<div class="esails-color-swatch" style="background-color:' + hex + ';' + extraStyle + '"></div>' +
      '<span>' + titel + '</span></div>';
  }
  function multiCard(extraKey, icon, titel, tekst) {
    return '<div class="esails-selection-card esails-multi-card" data-extra-key="' + extraKey + '">' +
      '<div class="esails-card-icon">' + icon + '</div><h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }

  /* -------------------- DOM-REFERENTIES -------------------- */
  var root; // de mount
  function $(id) { return document.getElementById(id); }

  /* -------------------- INIT -------------------- */
  function init() {
    root = $('esails-wizard-mount');
    if (!root) return false;            // mount nog niet aanwezig
    if (root.getAttribute('data-ready') === '1') return true; // al gedaan

    resetState();
    root.innerHTML = wizardHTML();
    root.setAttribute('data-ready', '1');

    bindEvents();
    updateSliderLabel(state.boot_lengte);
    renderCurrentStep();
    return true;
  }

  /* -------------------- EVENTS (gedelegeerd = robuust) -------------------- */
  function bindEvents() {
    // Eén click-listener op de root vangt alles op, ook dynamisch gerenderde elementen.
    root.addEventListener('click', function (e) {
      var card = e.target.closest('.esails-selection-card[data-key], .esails-color-card[data-key]');
      if (card && root.contains(card)) { onSelect(card); return; }

      var multi = e.target.closest('.esails-multi-card');
      if (multi && root.contains(multi)) { onMultiSelect(multi); return; }

      var qtyBtn = e.target.closest('button[data-item-key]');
      if (qtyBtn && root.contains(qtyBtn)) {
        adjustQty(qtyBtn.getAttribute('data-item-key'), parseInt(qtyBtn.getAttribute('data-delta'), 10));
        return;
      }

      if (e.target.closest('#esailsBtnPrev')) { prevStep(); return; }
      if (e.target.closest('#esailsBtnNext')) { nextStep(); return; }
      if (e.target.closest('#esailsBtnAddToCart')) { submitToLightspeed(); return; }
    });

    // Slider apart (input-event)
    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'esailsBootLengte') {
        updateSliderLabel(e.target.value);
      }
    });
  }

  function onSelect(element) {
    var key = element.getAttribute('data-key');
    var value = element.getAttribute('data-value');
    state[key] = value;
    var stepContainer = element.closest('.esails-wizard-step');
    if (stepContainer) {
      var cards = stepContainer.querySelectorAll('.esails-selection-card, .esails-color-card');
      for (var i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
    }
    element.classList.add('selected');
    evaluateNavButtons();
  }

  function onMultiSelect(element) {
    var extraKey = element.getAttribute('data-extra-key');
    state[extraKey] = !state[extraKey];
    element.classList.toggle('selected', state[extraKey]);
    evaluateNavButtons();
  }

  function updateSliderLabel(val) {
    state.boot_lengte = parseFloat(val);
    var label = $('esailsLengteWeergave');
    if (label) label.innerText = parseFloat(val).toFixed(1);
    evaluateNavButtons();
  }

  /* -------------------- NAVIGATIE -------------------- */
  function isStepValid(step) {
    switch (step) {
      case 1: return !!state.toepassing;
      case 2: return !!state.boot_type;
      case 3: return !!state.doek_type;
      case 4: return !!state.kleur;
      case 5: return true;
      case 6: return !!state.bevestiging;
      default: return true;
    }
  }

  function nextStep() {
    if (!isStepValid(state.currentStep)) return;
    if (state.currentStep < RESULT_STEP) {
      state.currentStep++;
      if (state.currentStep === RESULT_STEP) buildBundle();
      renderCurrentStep();
    }
  }

  function prevStep() {
    if (state.currentStep > 1) {
      state.currentStep--;
      renderCurrentStep();
    }
  }

  function renderCurrentStep() {
    var steps = root.querySelectorAll('.esails-wizard-step');
    for (var i = 0; i < steps.length; i++) steps[i].classList.remove('active');
    var active = root.querySelector('.esails-wizard-step[data-step="' + state.currentStep + '"]');
    if (active) active.classList.add('active');

    var shown = Math.min(state.currentStep, TOTAL_INPUT_STEPS);
    var bar = $('esailsProgressBar');
    if (bar) bar.style.width = ((shown / TOTAL_INPUT_STEPS) * 100) + '%';

    var names = ["Toepassing", "Vaartuig & Lengte", "Materiaalkeuze", "Kleurstelling", "Extra Opties", "Bevestigingsmethode"];
    var ind = $('esailsStepIndicator');
    if (ind) {
      ind.innerText = state.currentStep <= TOTAL_INPUT_STEPS
        ? 'Stap ' + state.currentStep + ' van ' + TOTAL_INPUT_STEPS + ': ' + names[state.currentStep - 1]
        : 'Jouw Maatwerk Advies';
    }

    evaluateNavButtons();
    if (root.scrollIntoView) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function evaluateNavButtons() {
    var btnPrev = $('esailsBtnPrev');
    var btnNext = $('esailsBtnNext');
    var nav = $('esailsNav');
    if (!btnPrev || !btnNext || !nav) return;

    nav.style.display = 'flex';

    if (state.currentStep === RESULT_STEP) {
      btnNext.style.display = 'none';
      btnPrev.disabled = false;
      return;
    }
    btnNext.style.display = 'inline-block';
    btnPrev.disabled = (state.currentStep === 1);
    btnNext.disabled = !isStepValid(state.currentStep);
  }

  /* -------------------- BUNDEL OPBOUWEN -------------------- */
  function lineFrom(key, qty, notitie) {
    var f = CONFIG.fournituren[key];
    return { id: f.id, naam: f.naam, prijs: f.prijs, qty: qty, unit: f.unit, notitie: notitie };
  }

  function buildBundle() {
    state.bundle = {};

    var factor = 1.2;
    if (state.toepassing === 'dekzeil') factor = 1.6;
    if (state.toepassing === 'bimini') factor = 0.9;

    var metersDoek = Math.ceil(state.boot_lengte * factor);
    var doekObj = CONFIG.stoffen[state.doek_type][state.kleur];

    state.bundle.stof = {
      id: doekObj.id, naam: doekObj.naam, prijs: doekObj.prijs, qty: metersDoek, unit: doekObj.unit,
      notitie: 'Berekend advies op basis van een ' + state.boot_type + ' (' + state.boot_lengte + 'm).'
    };

    var klossen = state.boot_lengte > 9 ? 2 : 1;
    var colorEl = root.querySelector('.esails-color-card.selected span');
    var kleurNaam = colorEl ? colorEl.innerText : 'Gekozen kleur';
    state.bundle.garen = {
      id: CONFIG.fournituren.garen.id, naam: CONFIG.fournituren.garen.naam + ' - (' + kleurNaam + ')',
      prijs: CONFIG.fournituren.garen.prijs, qty: klossen, unit: CONFIG.fournituren.garen.unit,
      notitie: 'UV-bestendig garen tegen rotting op de naden.'
    };

    if (state.extra_ramen) {
      state.bundle.vensterfolie = {
        id: CONFIG.fournituren.vensterfolie.id, naam: CONFIG.fournituren.vensterfolie.naam,
        prijs: CONFIG.fournituren.vensterfolie.prijs, qty: Math.ceil(state.boot_lengte * 0.4),
        unit: CONFIG.fournituren.vensterfolie.unit, notitie: 'Krasbestendige en UV-gestabiliseerde raamfolie.'
      };
    }
    if (state.extra_ritsen) {
      state.bundle.ritsen = {
        id: CONFIG.fournituren.ykk_rits.id, naam: CONFIG.fournituren.ykk_rits.naam,
        prijs: CONFIG.fournituren.ykk_rits.prijs, qty: 2,
        unit: CONFIG.fournituren.ykk_rits.unit, notitie: 'Zware, zoutwaterbestendige YKK spiraalritsen.'
      };
    }
    if (state.extra_trekbandjes) {
      state.bundle.trekbandjes = {
        id: CONFIG.fournituren.trekbandjes.id, naam: CONFIG.fournituren.trekbandjes.naam,
        prijs: CONFIG.fournituren.trekbandjes.prijs, qty: 4,
        unit: CONFIG.fournituren.trekbandjes.unit, notitie: 'Stevige spanbandsets inclusief roestvrijstalen gespen.'
      };
    }

    var basis = Math.ceil(state.boot_lengte * 3);
    if (state.bevestiging === 'tenax') {
      state.bundle.tenax_knop = lineFrom('tenax_knop', basis, 'Zelfborgende drukknopen (bovendeel).');
      state.bundle.tenax_schroef = lineFrom('tenax_schroef', basis, 'Zelftappende parkers voor polyester of hout.');
      state.bundle.tenax_sleutel = lineFrom('tenax_sleutel', 1, 'Essentieel gereedschap voor Tenax montage.');
    } else if (state.bevestiging === 'draaisluiting') {
      state.bundle.draaisluiting = lineFrom('draaisluiting', Math.ceil(basis * 0.8), 'Traditionele draaiers inclusief tegenringen.');
    } else if (state.bevestiging === 'dot_drukknoop') {
      state.bundle.dot_drukknoop = lineFrom('dot_drukknoop', basis, 'Complete RVS DOT sets.');
    } else if (state.bevestiging === 'zeiloog_koord') {
      state.bundle.zeiloog_set = lineFrom('zeiloog_set', 1, 'Inclusief holpijp en stempelset.');
      state.bundle.elastisch_koord = lineFrom('elastisch_koord', Math.ceil(state.boot_lengte * 2.5), 'Duurzaam elastisch schokkoord.');
    }

    state.bundle.microvezel = lineFrom('microvezel', 1, 'Aanbevolen: voor pluisvrije reiniging van je nieuwe materiaal.');

    renderBoard();
  }

  function renderBoard() {
    var container = $('esailsDynamicLines');
    if (!container) return;
    var html = '';
    Object.keys(state.bundle).forEach(function (key) {
      var item = state.bundle[key];
      var lineTotal = item.qty * item.prijs;
      html += '<div class="esails-line-item" id="esails-line-' + key + '">' +
        '<div class="esails-line-info"><h5>' + item.naam + '</h5><p>' + item.notitie + '</p></div>' +
        '<div class="esails-line-controls">' +
          '<div class="esails-counter">' +
            '<button type="button" data-item-key="' + key + '" data-delta="-1">-</button>' +
            '<input type="text" value="' + item.qty + '" readonly>' +
            '<button type="button" data-item-key="' + key + '" data-delta="1">+</button>' +
          '</div>' +
          '<div class="esails-line-price" id="esails-price-' + key + '">€ ' + money(lineTotal) + '</div>' +
        '</div></div>';
    });
    container.innerHTML = html;
    calcTotal();
  }

  function adjustQty(key, delta) {
    if (!state.bundle[key]) return;
    var q = state.bundle[key].qty + delta;
    if (q < 0) q = 0;
    state.bundle[key].qty = q;
    var line = $('esails-line-' + key);
    if (line) {
      var input = line.querySelector('input');
      if (input) input.value = q;
      var priceEl = $('esails-price-' + key);
      if (priceEl) priceEl.innerText = '€ ' + money(q * state.bundle[key].prijs);
    }
    calcTotal();
  }

  function calcTotal() {
    var total = 0;
    Object.keys(state.bundle).forEach(function (key) {
      total += state.bundle[key].qty * state.bundle[key].prijs;
    });
    var el = $('esailsTotalAmount');
    if (el) el.innerText = '€ ' + money(total);
  }

  function money(n) { return n.toFixed(2).replace('.', ','); }

  /* -------------------- WINKELWAGEN (Lightspeed eCom / C-Series) --------------------
     Lightspeed gebruikt GEEN /cart/add/{id}/ (dat is Shopify-syntax).
     Toevoegen gebeurt via een form-POST naar /cart met velden:
        product  = <product-ID>
        quantity = <aantal>
     We posten elk product via een verborgen form naar een verborgen iframe,
     zodat de pagina niet bij elk product herlaadt, en gaan daarna naar /cart.
  ------------------------------------------------------------------------------------ */
  function submitToLightspeed() {
    var btn = $('esailsBtnAddToCart');
    if (!btn) return;
    var btnText = btn.querySelector('.btn-text');
    var loader = btn.querySelector('.esails-loader');
    btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (loader) loader.style.display = 'block';

    var items = Object.keys(state.bundle)
      .map(function (k) { return state.bundle[k]; })
      .filter(function (it) { return it.qty > 0; });

    // Veiligheidscheck: placeholder-ID's nog niet vervangen?
    var bad = items.find(function (it) { return /^ID_/.test(String(it.id)); });
    if (bad) {
      alert('Configuratiefout: product-ID "' + bad.id + '" is nog een placeholder.\n' +
            'Vervang in de JavaScript (CONFIG) alle "ID_..."-waarden door de echte Lightspeed product-ID\'s.');
      resetButton(btn, btnText, loader);
      return;
    }

    var iframe = ensureFrame();
    var i = 0;
    function addNext() {
      if (i >= items.length) { window.location.href = '/cart'; return; }
      var item = items[i++];
      postOne(iframe, item.id, item.qty, addNext);
    }
    addNext();
  }

  function ensureFrame() {
    var iframe = document.getElementById('esailsCartFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'esailsCartFrame';
      iframe.name = 'esailsCartFrame';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    return iframe;
  }

  function postOne(iframe, productId, quantity, onDone) {
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = '/cart';
    form.target = 'esailsCartFrame';
    form.style.display = 'none';
    form.appendChild(hidden('product', productId));
    form.appendChild(hidden('quantity', quantity));
    document.body.appendChild(form);

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      iframe.removeEventListener('load', finish);
      if (form.parentNode) form.parentNode.removeChild(form);
      onDone();
    }
    iframe.addEventListener('load', finish);
    form.submit();
    setTimeout(finish, 1500); // fallback als 'load' niet vuurt
  }

  function hidden(name, value) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    return input;
  }

  function resetButton(btn, btnText, loader) {
    btn.disabled = false;
    if (btnText) btnText.style.display = 'block';
    if (loader) loader.style.display = 'none';
  }

  return { init: init };
})();

/* -------------------- STARTER (wacht tot mount bestaat) -------------------- */
(function () {
  var tries = 0;
  function start() {
    if (window.esailsWizard.init()) return; // gelukt
    if (tries++ < 40) setTimeout(start, 150); // probeer ~6s lang
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
