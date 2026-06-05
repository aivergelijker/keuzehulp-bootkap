/* =====================================================================
   eSails Bootkap Keuzehulp  -  wizard.js  (v2)
   ---------------------------------------------------------------------
   Wijzigingen t.o.v. v1:
   - Geen auto-scroll meer bij stapwissel (pagina blijft rustig staan).
   - Stap 2: breedte toegevoegd; doekberekening o.b.v. doekbreedte 152cm.
   - Microvezel-doekenset NIET meer automatisch toegevoegd.
   - Stap 5 ritsen: keuze bloktand/spiraal + lengte + aantal (uitklappend).
   - Stap 5 trekbandjes: aantal sets (1 set = 1m band + 1 RVS klemgesp).
   - Stap 6 bevestiging: sub-opties klappen uit onder de gekozen kaart.
   - "Lichtgewicht Polyester" krijgt een budget-label.

   TE DOEN: vervang elke "id" (ID_...) en placeholder-prijs door de echte
   Lightspeed product-ID's en prijzen in CONFIG hieronder.
   ===================================================================== */
window.esailsWizard = (function () {
  "use strict";

  var DOEK_BREEDTE_CM = 152; // standaard doekbreedte voor meterberekening

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

    /* Garen per doekkleur - elk een eigen Lightspeed product-ID */
    garen: {
      jet_black: { id: "ID_GAREN_ZWART", naam: "Zeilmakersgaren UV-bestendig - Zwart", prijs: 18.50, unit: "klos" },
      navy_blue: { id: "ID_GAREN_BLAUW", naam: "Zeilmakersgaren UV-bestendig - Navy", prijs: 18.50, unit: "klos" },
      dark_grey: { id: "ID_GAREN_GRIJS", naam: "Zeilmakersgaren UV-bestendig - Antraciet/Grijs", prijs: 18.50, unit: "klos" },
      ecru:      { id: "ID_GAREN_ECRU",  naam: "Zeilmakersgaren UV-bestendig - Ecru", prijs: 18.50, unit: "klos" }
    },

    ritsen: {
      bloktand: {
        "1.5": { id: "ID_RITS_BLOK_150", naam: "Bloktand rits 1,5m", prijs: 11.95 },
        "2":   { id: "ID_RITS_BLOK_200", naam: "Bloktand rits 2,0m", prijs: 13.95 },
        "2.5": { id: "ID_RITS_BLOK_250", naam: "Bloktand rits 2,5m", prijs: 15.95 },
        "3":   { id: "ID_RITS_BLOK_300", naam: "Bloktand rits 3,0m", prijs: 17.95 },
        "3.5": { id: "ID_RITS_BLOK_350", naam: "Bloktand rits 3,5m", prijs: 19.95 },
        "4":   { id: "ID_RITS_BLOK_400", naam: "Bloktand rits 4,0m", prijs: 21.95 },
        "6":   { id: "ID_RITS_BLOK_600", naam: "Bloktand rits 6,0m", prijs: 29.95 }
      },
      spiraal: {
        "1.5": { id: "ID_RITS_SPIR_150", naam: "Spiraalrits 1,5m", prijs: 9.95 },
        "2":   { id: "ID_RITS_SPIR_200", naam: "Spiraalrits 2,0m", prijs: 11.95 },
        "2.5": { id: "ID_RITS_SPIR_250", naam: "Spiraalrits 2,5m", prijs: 13.95 },
        "3":   { id: "ID_RITS_SPIR_300", naam: "Spiraalrits 3,0m", prijs: 15.95 },
        "3.5": { id: "ID_RITS_SPIR_350", naam: "Spiraalrits 3,5m", prijs: 17.95 },
        "4":   { id: "ID_RITS_SPIR_400", naam: "Spiraalrits 4,0m", prijs: 19.95 },
        "6":   { id: "ID_RITS_SPIR_600", naam: "Spiraalrits 6,0m", prijs: 27.95 }
      }
    },

    vensterfolie: { id: "ID_VENSTERFOLIE", naam: "Premium Vensterfolie 0.5mm (120cm breed)", prijs: 14.95, unit: "meter" },
    trekband:     { id: "ID_TREKBAND_SET", naam: "Trekbandset: 1m Polyester 1366 band (25mm) + RVS klemgesp", prijs: 9.95, unit: "set" },
    bandbeugel: {
      kunststof_zwart: { id: "ID_BEUGEL_KS_ZWART", naam: "Bandbeugel kunststof - Zwart", prijs: 1.95 },
      kunststof_wit:   { id: "ID_BEUGEL_KS_WIT",   naam: "Bandbeugel kunststof - Wit", prijs: 1.95 },
      rvs:             { id: "ID_BEUGEL_RVS",       naam: "Bandbeugel RVS (luxe)", prijs: 4.95 }
    },

    loxx: {
      rvs:   { id: "ID_LOXX_RVS",   naam: "Loxx drukknoop RVS", prijs: 3.95 },
      koper: { id: "ID_LOXX_KOPER", naam: "Loxx drukknoop Koper/Vernikkeld", prijs: 4.50 }
    },
    loxx_schroef: {
      zelftapper: { id: "ID_LOXX_ZELFTAPPER", naam: "Loxx bevestiging - Zelftapper (schroef)", prijs: 0.65 },
      bout_moer:  { id: "ID_LOXX_BOUTMOER",   naam: "Loxx bevestiging - Bout en moer", prijs: 0.95 }
    },

    draaisluiting: {
      prym: {
        koper:   { id: "ID_DRAAI_PRYM_KOPER",   naam: "Draaisluiting Prym - Koper-Vernikkeld (zilver)", prijs: 2.25 },
        messing: { id: "ID_DRAAI_PRYM_MESSING", naam: "Draaisluiting Prym - Messing (goud)", prijs: 2.40 }
      },
      mh: {
        koper:   { id: "ID_DRAAI_MH_KOPER",   naam: "Draaisluiting MH - Koper-Vernikkeld (zilver)", prijs: 2.50 },
        messing: { id: "ID_DRAAI_MH_MESSING", naam: "Draaisluiting MH - Messing (goud)", prijs: 2.65 }
      }
    },
    draai_kous: { id: "ID_DRAAI_KOUS", naam: "Zeilkous voor draaisluiting", prijs: 0.65 },
    draai_ring: { id: "ID_DRAAI_RING", naam: "Tegenring voor draaisluiting", prijs: 0.45 },

    drukknoop: {
      ykk:    { id: "ID_DRUK_YKK",    naam: "Drukknoop RVS - YKK", prijs: 1.20 },
      dot:    { id: "ID_DRUK_DOT",    naam: "Drukknoop RVS - DOT", prijs: 1.25 },
      fasnap: { id: "ID_DRUK_FASNAP", naam: "Drukknoop Fasnap", prijs: 1.40 },
      prym:   { id: "ID_DRUK_PRYM",   naam: "Drukknoop Prym", prijs: 1.35 }
    },

    zeilkous_carmo: {
      wit: { id: "ID_CARMO_WIT", naam: "Carmo kunststof zeilkous - Wit", prijs: 0.55 }
    },
    holpijp:        { id: "ID_HOLPIJP",    naam: "Holpijp (om gaten te slaan)", prijs: 12.95 },
    stansblok:      { id: "ID_STANSBLOK",  naam: "Stansblok (slagonderlegger)", prijs: 9.95 },
    koord: {
      wit_6:   { id: "ID_KOORD_WIT_6",   naam: "Elastisch koord 6mm - Wit", prijs: 2.25 },
      wit_8:   { id: "ID_KOORD_WIT_8",   naam: "Elastisch koord 8mm - Wit", prijs: 2.75 },
      zwart_6: { id: "ID_KOORD_ZWART_6", naam: "Elastisch koord 6mm - Zwart", prijs: 2.25 },
      zwart_8: { id: "ID_KOORD_ZWART_8", naam: "Elastisch koord 8mm - Zwart", prijs: 2.75 }
    },
    rijgknop: {
      rondknop: { id: "ID_RONDKNOP",    naam: "Rondknop (kunststof)", prijs: 0.75 },
      noorse:   { id: "ID_NOORSE_KNOP", naam: "Noorse knop (RVS)", prijs: 1.95 }
    }
  };

  var DRUK_MERKEN = {
    rvs:   [{ key: "ykk", label: "YKK" }, { key: "dot", label: "DOT" }],
    koper: [{ key: "fasnap", label: "Fasnap (koper/vernikkeld)" }, { key: "prym", label: "Prym (antraciet)" }]
  };

  /* Draaisluiting: uitvoering is voor beide merken gelijk */
  var DRAAI_UITVOERINGEN = [
    { key: "koper", label: "Koper-Vernikkeld (zilver)" },
    { key: "messing", label: "Messing (goud)" }
  ];

  var RITS_LENGTES = ["1.5", "2", "2.5", "3", "3.5", "4", "6"];

  var TOTAL_INPUT_STEPS = 6;
  var RESULT_STEP = 7;

  /* -------------------- STATE -------------------- */
  var state;
  function resetState() {
    state = {
      currentStep: 1,
      toepassing: null,
      boot_type: null,
      boot_lengte: 7.0,
      boot_breedte: 2.5,
      doek_type: null,
      kleur: null,
      wil_garen: true,

      extra_ramen: false,
      extra_ritsen: false,
      rits_type: null,
      rits_lengte: null,
      rits_aantal: 1,
      extra_trekbandjes: false,
      trekband_sets: 1,
      trekband_beugel: null,   // 'kunststof_zwart' | 'kunststof_wit' | 'rvs'

      bevestiging: null,
      loxx_materiaal: null,
      loxx_schroef: null,      // 'zelftapper' | 'bout_moer'
      draai_merk: null,        // 'prym' | 'mh'
      draai_uitvoering: null,  // 'koper' | 'messing'
      druk_materiaal: null,
      druk_merk: null,
      koord_kleur: null,
      koord_dikte: null,
      rijgknop_type: null,
      carmo_kleur: null,       // 'wit'
      zeil_holpijp: false,
      zeil_stansblok: false,

      bundle: {}
    };
  }

  /* -------------------- HELPERS -------------------- */
  var root;
  function $(id) { return document.getElementById(id); }
  function money(n) { return n.toFixed(2).replace('.', ','); }

  /* -------------------- HTML-TEMPLATE -------------------- */
  function wizardHTML() {
    return '' +
    '<div class="esails-wizard-header">' +
      '<h2>Bootkap &amp; Dekzeil Keuzehulp</h2>' +
      '<p>Stel in een paar stappen jouw ideale materiaalpakket samen</p>' +
      '<div class="esails-progress-wrapper"><div class="esails-progress-bar" id="esailsProgressBar" style="width:16.6%;"></div></div>' +
      '<div class="esails-step-indicator" id="esailsStepIndicator">Stap 1 van 6: Toepassing</div>' +
    '</div>' +

    '<div class="esails-wizard-step active" data-step="1">' +
      '<h3>Wat wil je gaan maken of vervangen?</h3>' +
      '<div class="esails-card-grid">' +
        card('toepassing','buiskap','⛵','Buiskap / Achtertent','Luxe, ademende bescherming voor dagelijks intensief gebruik.') +
        card('toepassing','dekzeil','⚓','Dekzeil / Winterkleed','Heavy-duty, 100% waterdichte bescherming tegen extreme weersinvloeden.') +
        card('toepassing','bimini','☀️','Bimini / Zonnedek','Lichtgewicht UV-bescherming en schaduw voor warme zomerdagen.') +
      '</div>' +
    '</div>' +

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
      '<div class="esails-slider-wrapper">' +
        '<label for="esailsBootBreedte">Breedte (te overspannen): <span id="esailsBreedteWeergave">2.5</span> meter</label>' +
        '<input type="range" id="esailsBootBreedte" min="1" max="6" step="0.1" value="2.5">' +
      '</div>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="3">' +
      '<h3>Kies de prestatieklasse van het doek</h3>' +
      '<div class="esails-card-grid">' +
        cardBadge('doek_type','premium_acryl','Meest gekozen','Premium Maritiem Acryl','Luxe geweven look, ademend (voorkomt schimmel), extreme UV-stabiliteit en kleurvastheid.') +
        cardBadgePlaceholder('doek_type','heavy_pvc','Heavy-Duty PVC','100% waterdicht vrachtwagenzeil-kwaliteit. Oersterk, vlekbestendig en eenvoudig afneembaar.') +
        cardBadge('doek_type','polyester_comfort','Budget','Lichtgewicht Polyester','Soepel, compact op te vouwen en zeer hanteerbaar. Iets minder hoogwaardig, ideaal voor lichtere zomerafdekking.','esails-badge-budget') +
      '</div>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="4">' +
      '<h3>Kies de gewenste kleur</h3>' +
      '<p class="esails-step-subtitle">We koppelen hier automatisch de juiste kleur professioneel zeilmakersgaren aan.</p>' +
      '<div class="esails-color-grid">' +
        colorCard('jet_black','#1a1a1a','Jet Black (Zwart)','') +
        colorCard('navy_blue','#0f1c3f','Navy Blue (Donkerblauw)','') +
        colorCard('dark_grey','#4a4a4a','Antraciet / Grijs','') +
        colorCard('ecru','#e8e3d3','Ecru / Hennep','border:1px solid #ccc;') +
      '</div>' +
      '<div class="esails-garen-keuze" id="esailsGarenKeuze">' +
        '<div class="esails-garen-info">' +
          '<strong>Bijpassend garen bestellen?</strong>' +
          '<span>Professioneel UV-bestendig zeilmakersgaren in de kleur van je doek. Aanbevolen.</span>' +
        '</div>' +
        '<button type="button" class="esails-pill esails-toggle active" data-toggle="wil_garen"><span class="esails-check">✓</span> Garen toevoegen</button>' +
      '</div>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="5">' +
      '<h3>Extra opties en toevoegingen</h3>' +
      '<p class="esails-step-subtitle">Selecteer de extra componenten die je wilt toevoegen. Meerdere keuzes mogelijk.</p>' +
      '<div class="esails-card-grid">' +
        multiCard('extra_ramen','🪟','Premium Raamfolie','Voeg hoogwaardige, UV-gestabiliseerde vensterfolie toe voor optimaal zicht.') +
        multiCardSub('extra_ritsen','🤐','Ritsen','Deelbare ritsen voor een achterdeur of oprolbare delen.', ritsenSubHTML()) +
        multiCardSub('extra_trekbandjes','🎗️','Trekbandjes met Gespen','Polyester 1366 band (25mm) met RVS klemgesp om de kap strak te fixeren.', trekbandSubHTML()) +
      '</div>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="6">' +
      '<h3>Welk bevestigingssysteem gebruik je?</h3>' +
      '<div class="esails-card-grid">' +
        cardSub('bevestiging','loxx','Loxx Systeem','Zelfborgende drukknoppen. Kunnen niet losscheuren door wind.', loxxSubHTML()) +
        cardSub('bevestiging','draaisluiting','Draaisluitingen / Tourniquets','Klassieke draaiers. Inclusief bijbehorende kousen en ringen in het doek.', draaiSubHTML()) +
        cardSub('bevestiging','drukknoop','Drukknopen','Maritieme drukknopen voor snelle montage.', drukSubHTML()) +
        cardSub('bevestiging','zeiloog_koord','Zeilringen &amp; Elastisch Koord','Ideaal voor vlakke dekzeilen en winterafdekkingen.', zeilSubHTML()) +
      '</div>' +
    '</div>' +

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

    '<div class="esails-wizard-navigation" id="esailsNav">' +
      '<button type="button" class="esails-btn esails-btn-secondary" id="esailsBtnPrev" disabled>Vorige</button>' +
      '<button type="button" class="esails-btn esails-btn-primary" id="esailsBtnNext" disabled>Volgende</button>' +
    '</div>';
  }

  /* ---------- sub-option HTML ---------- */
  function lengteOpties() {
    var labels = { "1.5":"1,5m", "2":"2m", "2.5":"2,5m", "3":"3m", "3.5":"3,5m", "4":"4m", "6":"6m" };
    var h = '';
    for (var i = 0; i < RITS_LENGTES.length; i++) { var l = RITS_LENGTES[i]; h += pill('rits_lengte', l, labels[l]); }
    return h;
  }
  function ritsenSubHTML() {
    return '<div class="esails-sub">' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Type:</span>' +
        pill('rits_type','bloktand','Bloktand') + pill('rits_type','spiraal','Spiraalrits') + '</div>' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Lengte:</span>' + lengteOpties() + '</div>' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Aantal:</span>' + stepper('rits_aantal', 1) + '</div>' +
    '</div>';
  }
  function trekbandSubHTML() {
    return '<div class="esails-sub">' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Aantal sets:</span>' + stepper('trekband_sets', 1) + '</div>' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Bandbeugel (op boot/dek):</span>' +
        pill('trekband_beugel','kunststof_zwart','Kunststof zwart') +
        pill('trekband_beugel','kunststof_wit','Kunststof wit') +
        pill('trekband_beugel','rvs','RVS (luxe)') + '</div>' +
      '<p class="esails-sub-note">1 set = 1 meter band + 1 klemgesp.</p>' +
    '</div>';
  }
  function loxxSubHTML() {
    return '<div class="esails-sub">' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Materiaal:</span>' +
        pill('loxx_materiaal','rvs','RVS') + pill('loxx_materiaal','koper','Koper/Vernikkeld') + '</div>' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Bevestiging:</span>' +
        pill('loxx_schroef','zelftapper','Zelftapper (schroef)') + pill('loxx_schroef','bout_moer','Bout en moer') + '</div></div>';
  }
  function draaiSubHTML() {
    return '<div class="esails-sub">' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Merk:</span>' +
        pill('draai_merk','prym','Prym') + pill('draai_merk','mh','MH') + '</div>' +
      '<div class="esails-sub-row" id="esailsDraaiUitvRow" style="display:none;"><span class="esails-sub-label">Uitvoering:</span><span id="esailsDraaiUitvOpts"></span></div>' +
      '<p class="esails-sub-note">Kousen en tegenringen worden automatisch meegeleverd.</p></div>';
  }
  function drukSubHTML() {
    return '<div class="esails-sub">' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Materiaal:</span>' +
        pill('druk_materiaal','rvs','RVS') + pill('druk_materiaal','koper','Koper/Vernikkeld') + '</div>' +
      '<div class="esails-sub-row" id="esailsDrukMerkRow" style="display:none;"><span class="esails-sub-label">Merk:</span><span id="esailsDrukMerkOpts"></span></div></div>';
  }
  function zeilSubHTML() {
    return '<div class="esails-sub">' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Koord kleur:</span>' +
        pill('koord_kleur','wit','Wit') + pill('koord_kleur','zwart','Zwart') + '</div>' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Koord dikte:</span>' +
        pill('koord_dikte','6','6mm') + pill('koord_dikte','8','8mm') + '</div>' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Rijgknop op boot:</span>' +
        pill('rijgknop_type','rondknop','Rondknop (kunststof)') + pill('rijgknop_type','noorse','Noorse knop (RVS)') + '</div>' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Gereedschap:</span>' +
        toggle('zeil_holpijp','Holpijp') + toggle('zeil_stansblok','Stansblok') + '</div>' +
      '<div class="esails-sub-row"><span class="esails-sub-label">Carmo zeilkous kleur:</span>' +
        pill('carmo_kleur','wit','Wit') + '</div></div>';
  }

  /* ---------- bouwstenen ---------- */
  function card(key, val, icon, titel, tekst) {
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '">' +
      '<div class="esails-card-icon">' + icon + '</div><h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }
  function cardSimple(key, val, titel) {
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '"><h4>' + titel + '</h4></div>';
  }
  function cardSimpleDesc(key, val, titel, tekst) {
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '"><h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }
  function cardBadge(key, val, badge, titel, tekst, extraClass) {
    var cls = 'esails-badge' + (extraClass ? ' ' + extraClass : '');
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '">' +
      '<span class="' + cls + '">' + badge + '</span><h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }
  function cardBadgePlaceholder(key, val, titel, tekst) {
    return '<div class="esails-selection-card" data-key="' + key + '" data-value="' + val + '">' +
      '<span class="esails-badge esails-badge-placeholder">&nbsp;</span><h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }
  function colorCard(val, hex, titel, extraStyle) {
    return '<div class="esails-color-card" data-key="kleur" data-value="' + val + '">' +
      '<div class="esails-color-swatch" style="background-color:' + hex + ';' + extraStyle + '"></div><span>' + titel + '</span></div>';
  }
  function multiCard(extraKey, icon, titel, tekst) {
    return '<div class="esails-selection-card esails-multi-card" data-extra-key="' + extraKey + '">' +
      '<div class="esails-card-icon">' + icon + '</div><h4>' + titel + '</h4><p>' + tekst + '</p></div>';
  }
  function multiCardSub(extraKey, icon, titel, tekst, subHTML) {
    return '<div class="esails-selection-card esails-multi-card esails-has-sub" data-extra-key="' + extraKey + '">' +
      '<div class="esails-card-icon">' + icon + '</div><h4>' + titel + '</h4><p>' + tekst + '</p>' + subHTML + '</div>';
  }
  function cardSub(key, val, titel, tekst, subHTML) {
    return '<div class="esails-selection-card esails-has-sub" data-key="' + key + '" data-value="' + val + '">' +
      '<h4>' + titel + '</h4><p>' + tekst + '</p>' + subHTML + '</div>';
  }
  function pill(subKey, val, label) {
    return '<button type="button" class="esails-pill" data-subkey="' + subKey + '" data-subval="' + val + '">' + label + '</button>';
  }
  function toggle(subKey, label) {
    return '<button type="button" class="esails-pill esails-toggle" data-toggle="' + subKey + '">' + label + '</button>';
  }
  function stepper(subKey, startVal) {
    return '<span class="esails-stepper">' +
      '<button type="button" data-step-key="' + subKey + '" data-step-delta="-1">-</button>' +
      '<input type="text" id="esails-stepper-' + subKey + '" value="' + startVal + '" readonly>' +
      '<button type="button" data-step-key="' + subKey + '" data-step-delta="1">+</button></span>';
  }

  /* -------------------- INIT -------------------- */
  function init() {
    root = $('esails-wizard-mount');
    if (!root) return false;
    if (root.getAttribute('data-ready') === '1') return true;

    resetState();
    root.innerHTML = wizardHTML();
    root.setAttribute('data-ready', '1');

    bindEvents();
    updateSliderLabel('lengte', state.boot_lengte);
    updateSliderLabel('breedte', state.boot_breedte);
    renderCurrentStep();
    return true;
  }

  /* -------------------- EVENTS -------------------- */
  function bindEvents() {
    root.addEventListener('click', function (e) {
      var pillBtn = e.target.closest('.esails-pill');
      if (pillBtn && root.contains(pillBtn)) {
        e.stopPropagation();
        if (pillBtn.hasAttribute('data-toggle')) onToggle(pillBtn);
        else onPill(pillBtn);
        return;
      }
      var stepBtn = e.target.closest('button[data-step-key]');
      if (stepBtn && root.contains(stepBtn)) {
        e.stopPropagation();
        onStepper(stepBtn.getAttribute('data-step-key'), parseInt(stepBtn.getAttribute('data-step-delta'), 10));
        return;
      }
      var c = e.target.closest('.esails-selection-card[data-key], .esails-color-card[data-key]');
      if (c && root.contains(c) && !c.classList.contains('esails-multi-card')) { onSelect(c); return; }
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

    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'esailsBootLengte') updateSliderLabel('lengte', e.target.value);
      if (e.target && e.target.id === 'esailsBootBreedte') updateSliderLabel('breedte', e.target.value);
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

  function onPill(btn) {
    var subKey = btn.getAttribute('data-subkey');
    var subVal = btn.getAttribute('data-subval');
    state[subKey] = subVal;
    var siblings = root.querySelectorAll('.esails-pill[data-subkey="' + subKey + '"]');
    for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove('active');
    btn.classList.add('active');
    if (subKey === 'druk_materiaal') { state.druk_merk = null; renderDrukMerken(subVal); }
    if (subKey === 'draai_merk') { state.draai_uitvoering = null; renderDraaiUitvoeringen(); }
    evaluateNavButtons();
  }

  function onToggle(btn) {
    var key = btn.getAttribute('data-toggle');
    state[key] = !state[key];
    btn.classList.toggle('active', state[key]);
    if (key === 'wil_garen') updateGarenButton(btn);
    evaluateNavButtons();
  }

  function updateGarenButton(btn) {
    if (!btn) btn = root.querySelector('[data-toggle="wil_garen"]');
    if (!btn) return;
    if (state.wil_garen) {
      btn.classList.add('active');
      btn.classList.remove('esails-toggle-off');
      btn.innerHTML = '<span class="esails-check">✓</span> Garen toevoegen';
    } else {
      btn.classList.remove('active');
      btn.classList.add('esails-toggle-off');
      btn.innerHTML = '<span class="esails-cross">✕</span> Geen garen';
    }
  }

  function onStepper(key, delta) {
    var v = state[key] + delta;
    if (v < 1) v = 1;
    state[key] = v;
    var input = $('esails-stepper-' + key);
    if (input) input.value = v;
    evaluateNavButtons();
  }

  function renderDrukMerken(materiaal) {
    var row = $('esailsDrukMerkRow');
    var opts = $('esailsDrukMerkOpts');
    if (!row || !opts) return;
    var merken = DRUK_MERKEN[materiaal] || [];
    var h = '';
    for (var i = 0; i < merken.length; i++) h += pill('druk_merk', merken[i].key, merken[i].label);
    opts.innerHTML = h;
    row.style.display = merken.length ? 'flex' : 'none';
  }

  function renderDraaiUitvoeringen() {
    var row = $('esailsDraaiUitvRow');
    var opts = $('esailsDraaiUitvOpts');
    if (!row || !opts) return;
    var h = '';
    for (var i = 0; i < DRAAI_UITVOERINGEN.length; i++) {
      h += pill('draai_uitvoering', DRAAI_UITVOERINGEN[i].key, DRAAI_UITVOERINGEN[i].label);
    }
    opts.innerHTML = h;
    row.style.display = 'flex';
  }

  function updateSliderLabel(which, val) {
    if (which === 'lengte') {
      state.boot_lengte = parseFloat(val);
      var l = $('esailsLengteWeergave');
      if (l) l.innerText = parseFloat(val).toFixed(1);
    } else {
      state.boot_breedte = parseFloat(val);
      var b = $('esailsBreedteWeergave');
      if (b) b.innerText = parseFloat(val).toFixed(1);
    }
    evaluateNavButtons();
  }

  /* -------------------- VALIDATIE / NAVIGATIE -------------------- */
  function isStepValid(step) {
    switch (step) {
      case 1: return !!state.toepassing;
      case 2: return !!state.boot_type;
      case 3: return !!state.doek_type;
      case 4: return !!state.kleur;
      case 5: return step5Valid();
      case 6: return step6Valid();
      default: return true;
    }
  }
  function step5Valid() {
    if (state.extra_ritsen) { if (!state.rits_type || !state.rits_lengte) return false; }
    return true;
  }
  function step6Valid() {
    if (!state.bevestiging) return false;
    if (state.bevestiging === 'loxx') return !!state.loxx_materiaal && !!state.loxx_schroef;
    if (state.bevestiging === 'draaisluiting') return !!state.draai_merk && !!state.draai_uitvoering;
    if (state.bevestiging === 'drukknoop') return !!state.druk_materiaal && !!state.druk_merk;
    if (state.bevestiging === 'zeiloog_koord') return !!state.koord_kleur && !!state.koord_dikte && !!state.rijgknop_type && !!state.carmo_kleur;
    return false;
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
    if (state.currentStep > 1) { state.currentStep--; renderCurrentStep(); }
  }

  function renderCurrentStep() {
    var steps = root.querySelectorAll('.esails-wizard-step');
    for (var i = 0; i < steps.length; i++) steps[i].classList.remove('active');
    var active = root.querySelector('.esails-wizard-step[data-step="' + state.currentStep + '"]');
    if (active) active.classList.add('active');

    var shown = Math.min(state.currentStep, TOTAL_INPUT_STEPS);
    var bar = $('esailsProgressBar');
    if (bar) bar.style.width = ((shown / TOTAL_INPUT_STEPS) * 100) + '%';

    var names = ["Toepassing", "Vaartuig & Afmetingen", "Materiaalkeuze", "Kleurstelling", "Extra Opties", "Bevestigingsmethode"];
    var ind = $('esailsStepIndicator');
    if (ind) {
      ind.innerText = state.currentStep <= TOTAL_INPUT_STEPS
        ? 'Stap ' + state.currentStep + ' van ' + TOTAL_INPUT_STEPS + ': ' + names[state.currentStep - 1]
        : 'Jouw Maatwerk Advies';
    }
    evaluateNavButtons();
    /* GEEN scrollIntoView meer. */
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

  /* -------------------- BUNDEL -------------------- */
  function addLine(key, obj, qty, notitie) {
    state.bundle[key] = {
      id: obj.id, naam: obj.naam, prijs: obj.prijs,
      qty: qty, unit: obj.unit || 'stuks', notitie: notitie || ''
    };
  }

  function buildBundle() {
    state.bundle = {};

    var factor = 1.2;
    if (state.toepassing === 'dekzeil') factor = 1.6;
    if (state.toepassing === 'bimini') factor = 0.9;

    var doekBreedteM = DOEK_BREEDTE_CM / 100;
    var oppervlak = state.boot_lengte * state.boot_breedte * factor;
    var metersDoek = Math.ceil(oppervlak / doekBreedteM);
    if (metersDoek < 1) metersDoek = 1;

    var doekObj = CONFIG.stoffen[state.doek_type][state.kleur];
    addLine('stof', doekObj, metersDoek,
      'Berekend op ' + state.boot_lengte + 'm x ' + state.boot_breedte + 'm, doekbreedte ' + DOEK_BREEDTE_CM + 'cm.');

    if (state.wil_garen) {
      var klossen = metersDoek > 12 ? 2 : 1;
      var garenObj = CONFIG.garen[state.kleur];
      addLine('garen', garenObj, klossen, 'UV-bestendig garen in de kleur van je doek, tegen rotting op de naden.');
    }

    if (state.extra_ramen) {
      addLine('vensterfolie', CONFIG.vensterfolie, Math.ceil(state.boot_lengte * 0.4),
        'Krasbestendige en UV-gestabiliseerde raamfolie.');
    }
    if (state.extra_ritsen && state.rits_type && state.rits_lengte) {
      var ritsObj = CONFIG.ritsen[state.rits_type][state.rits_lengte];
      addLine('rits', { id: ritsObj.id, naam: ritsObj.naam, prijs: ritsObj.prijs, unit: 'stuks' },
        state.rits_aantal, 'Deelbare rits voor achterdeur of oprolbaar deel.');
    }
    if (state.extra_trekbandjes) {
      addLine('trekband', CONFIG.trekband, state.trekband_sets, '1 set = 1 meter band + 1 klemgesp.');
      if (state.trekband_beugel) {
        var beugelObj = CONFIG.bandbeugel[state.trekband_beugel];
        addLine('bandbeugel', { id: beugelObj.id, naam: beugelObj.naam, prijs: beugelObj.prijs, unit: 'stuks' },
          state.trekband_sets, 'Bandbeugel om op de boot/dek te bevestigen.');
      }
    }

    var basis = Math.ceil((state.boot_lengte + state.boot_breedte) * 2);
    if (basis < 4) basis = 4;

    if (state.bevestiging === 'loxx') {
      var loxxObj = CONFIG.loxx[state.loxx_materiaal];
      addLine('loxx', { id: loxxObj.id, naam: loxxObj.naam, prijs: loxxObj.prijs, unit: 'stuks' }, basis, 'Zelfborgende Loxx drukknopen.');
      var schroefObj = CONFIG.loxx_schroef[state.loxx_schroef];
      addLine('loxx_schroef', { id: schroefObj.id, naam: schroefObj.naam, prijs: schroefObj.prijs, unit: 'stuks' }, basis, 'Bevestigingsmateriaal voor de Loxx-onderdelen.');
    } else if (state.bevestiging === 'draaisluiting') {
      var draaiObj = CONFIG.draaisluiting[state.draai_merk][state.draai_uitvoering];
      var draaiAantal = Math.ceil(basis * 0.8);
      addLine('draaisluiting', { id: draaiObj.id, naam: draaiObj.naam, prijs: draaiObj.prijs, unit: 'stuks' }, draaiAantal, 'Traditionele draaier.');
      addLine('draai_kous', CONFIG.draai_kous, draaiAantal, 'Bijbehorende kous in het doek.');
      addLine('draai_ring', CONFIG.draai_ring, draaiAantal, 'Bijbehorende tegenring.');
    } else if (state.bevestiging === 'drukknoop') {
      var drukObj = CONFIG.drukknoop[state.druk_merk];
      addLine('drukknoop', { id: drukObj.id, naam: drukObj.naam, prijs: drukObj.prijs, unit: 'stuks' }, basis, 'Maritieme drukknoop.');
    } else if (state.bevestiging === 'zeiloog_koord') {
      var koordObj = CONFIG.koord[state.koord_kleur + '_' + state.koord_dikte];
      var koordMeters = Math.ceil((state.boot_lengte + state.boot_breedte) * 2.5);
      addLine('koord', { id: koordObj.id, naam: koordObj.naam, prijs: koordObj.prijs, unit: 'meter' }, koordMeters, 'Elastisch schokkoord langs de rand.');
      addLine('carmo_kous', CONFIG.zeilkous_carmo[state.carmo_kleur], basis, 'Carmo kunststof zeilkousen in het doek.');
      var knopObj = CONFIG.rijgknop[state.rijgknop_type];
      addLine('rijgknop', { id: knopObj.id, naam: knopObj.naam, prijs: knopObj.prijs, unit: 'stuks' }, basis, 'Knoppen op de boot om het koord omheen te rijgen.');
      if (state.zeil_holpijp) addLine('holpijp', CONFIG.holpijp, 1, 'Voor het slaan van de gaten.');
      if (state.zeil_stansblok) addLine('stansblok', CONFIG.stansblok, 1, 'Slagonderlegger.');
    }

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
    Object.keys(state.bundle).forEach(function (key) { total += state.bundle[key].qty * state.bundle[key].prijs; });
    var el = $('esailsTotalAmount');
    if (el) el.innerText = '€ ' + money(total);
  }

  /* -------------------- WINKELWAGEN -------------------- */
  function submitToLightspeed() {
    var btn = $('esailsBtnAddToCart');
    if (!btn) return;
    var btnText = btn.querySelector('.btn-text');
    var loader = btn.querySelector('.esails-loader');
    btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (loader) loader.style.display = 'block';

    var items = Object.keys(state.bundle).map(function (k) { return state.bundle[k]; })
      .filter(function (it) { return it.qty > 0; });

    var bad = items.find(function (it) { return /^ID_/.test(String(it.id)); });
    if (bad) {
      alert('Configuratiefout: product-ID "' + bad.id + '" is nog een placeholder.\n' +
            'Vervang in wizard.js (CONFIG) alle "ID_..."-waarden door echte Lightspeed product-ID\'s.');
      btn.disabled = false;
      if (btnText) btnText.style.display = 'block';
      if (loader) loader.style.display = 'none';
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
    setTimeout(finish, 1500);
  }

  function hidden(name, value) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    return input;
  }

  return { init: init };
})();

/* -------------------- STARTER -------------------- */
(function () {
  var tries = 0;
  function start() {
    if (window.esailsWizard.init()) return;
    if (tries++ < 40) setTimeout(start, 150);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
