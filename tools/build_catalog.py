#!/usr/bin/env python3
"""Genereert src/catalog.js uit een crawl van esails.nl (listing.json [+ detail3.json]).

Gebruik:  python3 -I tools/build_catalog.py <crawl-map>
De crawl-map bevat listing.json (alle producten, default-variant) en optioneel
detail3.json (varianten van multi-variant producten).
Alle productkeuzes staan in SPEC hieronder: wijzig daar, draai opnieuw.
"""
import json, re, sys, os

CRAWL = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'catalog.js')
L = json.load(open(os.path.join(CRAWL, 'listing.json')))
D = {}
p3 = os.path.join(CRAWL, 'detail3.json')
if os.path.exists(p3):
    D = json.load(open(p3))

# index: vid -> info
V = {}
for p in L.values():
    V[str(p['vid'])] = dict(vid=str(p['vid']), url=p['url'], titel=re.sub(r'\s+', ' ', p['title']).strip(),
                            variant=p['variant'], prijs=p['price'], op=p['avail'], img=p.get('image'))
for p in D.values():
    if 'variants' not in p: continue
    for k, v in p['variants'].items():
        base = V.get(k, {})
        V[k] = dict(vid=k, url=p['url'], titel=p['title'], variant=v['title'], prijs=v['price'],
                    op=bool(v['avail']), img=base.get('img'))

def find(rx, ex=None):
    out = []
    for p in L.values():
        t = re.sub(r'\s+', ' ', p['title'])
        if re.search(rx, t, re.I) and not re.search(r'sample', t, re.I) and not (ex and re.search(ex, t, re.I)):
            out.append(V[str(p['vid'])])
    return sorted(out, key=lambda x: x['titel'])

def prod(vid, naam=None, unit='st', **kw):
    vid = str(vid)
    if vid not in V:
        raise SystemExit('Onbekend variant-ID: ' + vid)
    v = V[vid]
    d = dict(vid=vid, url=v['url'], naam=naam or v['titel'], prijs=v['prijs'], unit=unit)
    if v.get('img'): d['img'] = v['img']
    d.update(kw)
    return d

# ---------------------------------------------------------------- kleuren
HEX = [
    ('captain navy|dark navy|admiral|marine|navy|azul marino', '#1d2740'), ('zwart|black|negro|noir', '#1c1c1e'),
    ('antraci|charcoal|graphite|grafito|basalt|dark smoke|carbon|coal', '#3d4043'), ('wit|white|blanco|parelwit', '#f4f3ee'),
    ('ivoor|ivory|natural|naturel|ecru|oyster|linen|crudo', '#ece4cf'), ('beige|dune|flax|sand|arena|taupe|vison|cafe|camel', '#c8b48f'),
    ('zilver|silver|lichtgrijs|plata|glacier|moonstone|howlite|marble|cadet', '#b8babb'), ('grijs|grey|gris|gray|rock|agaat|fjord', '#8c8f92'),
    ('bordeaux|burgundy|granate|karmijn|rood|red|rojo', '#8e1f2a'), ('oranje|orange|naranja', '#e06a1b'),
    ('groen|green|verde|forest|olijf|mos|nile', '#2f4a36'), ('kobalt|koningsblauw|konings|royal|ocean|atlantic|azul|blue|blauw|pacific|como', '#24508f'),
    ('bruin|brown|marron|cacao|chocolate', '#5a4031'), ('geel|yellow|amarillo|sunflower', '#e8c547'), ('pink|roze|rosa', '#d89aa8'),
]
GAREN_MAP = [  # kleurwoord -> garen-sleutel (Coats Terko M36)
    ('captain navy|dark navy', 'captain_navy'), ('navy|admiral|marine|azul marino', 'marine_blauw'), ('zwart|black|negro', 'zwart'),
    ('antraci|charcoal|graphite|grafito|basalt|dark smoke|carbon|coal', 'antraciet'), ('wit|white|blanco', 'wit'),
    ('ivoor|ivory|natural|naturel|ecru|oyster|linen|crudo', 'naturel'), ('taupe|vison|cafe', 'taupe'),
    ('beige|dune|flax|sand|arena|camel', 'beige'), ('zilver|silver|grijs|grey|gris|rock|agaat|glacier|moonstone|howlite|marble|fjord', 'lichtgrijs'),
    ('bordeaux|burgundy|granate|karmijn|rood|red|rojo', 'bordeaux'), ('groen|green|verde|olijf|mos|nile', 'olijfgroen'),
    ('bruin|brown|marron|cacao', 'donkerbruin'),
    ('blue|blauw|azul|kobalt|konings|marino|indigo|armada|regata|commodore|midnight|ocean|atlantic|celestial|arctic|acqua|como|faroe', 'marine_blauw'),
    ('oranje|naranja|amarillo|geel|sunset|teja|sienna|gobi|papyrus|avena|vanil|perla|shell|seda|mineral|piedra|optik|steel|titanium|flanelle|carbon|coal|ebène|ebene', 'lichtgrijs'),
    ('jade|eucalyptus|botella|rotala', 'olijfgroen'), ('rioja|lila|pink|brasserie|racing', 'bordeaux'),
]
def match(table, s, default):
    for rx, val in table:
        if re.search(rx, s, re.I): return val
    return default

def kleurnaam(titel, rx):
    m = re.search(rx, titel)
    return (m.group(1) if m else titel).strip(' |')

def kleuren(items, rx, garen=True):
    out = []
    for v in items:
        n = kleurnaam(v['titel'], rx)
        k = dict(vid=v['vid'], url=v['url'], naam=n, prijs=v['prijs'], hex=match(HEX, n, '#9a9a9a'))
        if v.get('img'): k['img'] = v['img']
        if garen: k['garen'] = match(GAREN_MAP, n, 'naturel')
        out.append(k)
    return out

# ---------------------------------------------------------------- SPEC
garen_items = find(r'Coats Terko \| Garen \| +M36')
GAREN = {}
for v in garen_items:
    n = kleurnaam(v['titel'], r'M36 \| ([^#|]+)')
    key = re.sub(r'[^a-z]+', '_', n.lower()).strip('_')
    GAREN[key] = prod(v['vid'], 'Coats Terko M36 garen — ' + n, 'st', hex=match(HEX, n, '#999'))

DOEKEN = {
  'sunbrella_plus': dict(naam='Sunbrella Plus', merk='Sunbrella', soort='acryl', rolCm=152, gewicht='320 g/m²',
     badge='Meest gekozen', oms='Premium maritiem acryl. Ademend (voorkomt schimmel), extreem UV- en kleurvast, 10 jaar garantie.',
     kleuren=kleuren(find(r'Sunbrella \| Plus \|.*152 cm'), r'Plus \| ([^#|]+)')),
  'sauleda_seastar': dict(naam='Sauleda Sea Star Special', merk='Sauleda', soort='acryl', rolCm=153, gewicht='330 g/m²',
     badge='Voordelig alternatief', oms='Geweven acryl met vergelijkbare eigenschappen als Sunbrella, scherper geprijsd. Ademend en UV-bestendig.',
     kleuren=kleuren(find(r'Sauleda \| Sea Star Special \| Bootdoek \| Breedte 153'), r'Kleur (?:# ?)?\d+ ([^|]+)')),
  'poly_marine': dict(naam='Poly Marine polyester', merk='Poly Marine', soort='polyester', rolCm=150, gewicht='290 g/m²',
     badge='Budget', badgeType='budget', oms='Soepel en licht polyester. Compact op te vouwen, ideaal voor lichtere zomerafdekking.',
     kleuren=kleuren(find(r'Poly Marine \| Polyester Doek'), r'Polyester Doek \| ([^|]+)')),
  'ferrari_705': dict(naam='Serge Ferrari 705 PVC', merk='Serge Ferrari', soort='pvc', rolCm=270, gewicht='670 g/m²',
     badge='Premium', oms='Précontraint PVC: 100% waterdicht, scheurvast en maatvast. Te lijmen of te naaien.',
     kleuren=kleuren(find(r'Ferrari \| 705 \| PVC Doek'), r'Kleur ([^#|]+)')),
  'mehler_8205': dict(naam='Mehler Polymar 8205 PVC', merk='Mehler', soort='pvc', rolCm=250, gewicht='680 g/m²',
     badge='Waterdicht', oms='Robuust PVC-doek, 100% waterdicht en vlekbestendig. Breed (250 cm), dus weinig naden.',
     kleuren=kleuren(find(r'Polymar \| PVC Doek \| 8205'), r'8205 \| 680 gr/m2 \| ([^#|]+)')),
  'mehler_8940': dict(naam='Mehler Polymar 8940/8948 PVC', merk='Mehler', soort='pvc', rolCm=204, gewicht='600–680 g/m²',
     badge='Scherp geprijsd', badgeType='budget', oms='Waterdicht PVC-doek op 204 cm breedte. Prima prijs/kwaliteit voor afdekzeilen.',
     kleuren=kleuren(find(r'Polymar \| PVC Doek \| 89(40|48).*204 cm'), r'gr/m2 \| ([^#|]+)')),
  'ferrari_602n': dict(naam='Serge Ferrari 602N PVC (brandvertragend)', merk='Serge Ferrari', soort='pvc', rolCm=267, gewicht='620 g/m²',
     badge='Brandvertragend', oms='Brandvertragend PVC (M2/B1). Voor afdekkingen bij bbq, terrasverwarming of in bedrijfsomgeving.',
     kleuren=kleuren(find(r'Ferrari \| 602N'), r'Kleur ([^#|]+)')),
  'mehler_gaas': dict(naam='Mehler Polymar PVC-gaasweefsel', merk='Mehler', soort='gaas', rolCm=250, gewicht='285 g/m²',
     badge='Zon- en windwerend', oms='Open PVC-gaasweefsel: houdt zon en warmte tegen, je kijkt er doorheen en het laat wind door. Rafelt niet.',
     kleuren=kleuren(find(r'Polymar \| PVC Gaasweefsel'), r'gr/m2 \| ([^#|]+)', garen=False)),
  'ferrari_362': dict(naam='Serge Ferrari 362 PVC-gaasdoek', merk='Serge Ferrari', soort='gaas', rolCm=267, gewicht='430 g/m²',
     badge='Brandvertragend', oms='Brandvertragend PVC-gaasdoek van Serge Ferrari. Schaduw en privacy, laat wind door.',
     kleuren=kleuren(find(r'Ferrari \| 362 \| PVC Gaasdoek'), r'gr/m2 \| ([^#|]+)', garen=False)),
}

P = {}
def add(key, vid, naam=None, unit='st', **kw): P[key] = prod(vid, naam, unit, **kw)

# --- Loxx
add('loxx_kop_rvs', 253532240, 'Loxx kop — RVS'); add('loxx_kop_kv', 265497536, 'Loxx kop — koper-vernikkeld')
add('loxx_kop_chroom', 288360367, 'Loxx kop — messing-verchroomd'); add('loxx_kop_zwart', 262542520, 'Loxx kop — zwart')
add('loxx_zelftapper_rvs', 253532032, 'Loxx zelftapper RVS 12 mm (op de boot)'); add('loxx_zelftapper_kv', 255590166, 'Loxx zelftapper koper-vernikkeld 4,2 × 12 mm (op de boot)')
add('loxx_bout_rvs', 255769033, 'Loxx bout RVS M5 × 10 mm (op de boot)'); add('loxx_moer_rvs', 255769886, 'Loxx moer RVS M5 (voor de bout)')
add('loxx_doekdeel_kv', 253531985, 'Loxx ontvanger/doekdeel koper-vernikkeld (doek-op-doek)')
add('loxx_sleutel', 253911895, 'Loxx montagesleutel', perOrder=True)
add('loxx_holpijp', 316670607, 'Holpijp 9 mm voor Loxx', perOrder=True, tool=True)
# --- Tourniquets (draaier + kous&ring per merk, matchend formaat)
add('draai_prym', 257993275, 'Prym tourniquet draaier #9065 messing-vernikkeld (15 × 9 mm)')
add('draai_prym_kous', 258015200, 'Prym tourniquet kous & ring F370 (15 × 9 mm)')
add('draai_mh', 260022585, 'MH tourniquet draaier messing-vernikkeld (17 × 11 mm)')
add('draai_mh_kous', 260024359, 'MH tourniquet kous & ring messing-vernikkeld (17 × 11 mm)')
add('draai_prym_holpijp', 257995106, 'Prym holpijp tourniquet 16 × 9 mm', perOrder=True, tool=True)
add('draai_prym_stempel', 257994150, 'Prym stempel tourniquet type 370 (15 × 9 mm)', perOrder=True, tool=True)
add('draai_mh_holpijp', 259989808, 'Paffrath holpijp tourniquet 17 × 11 mm', perOrder=True, tool=True)
add('draai_mh_stempel', 260002692, 'MH stempel tourniquet 17 × 11 mm', perOrder=True, tool=True)
# --- Drukknopen A/B (in het doek) + C (op de boot)
for merk, ids in {'ykk': (319599669, 319599676, 319599686), 'dot': (257994841, 257994829, 257994859),
                  'fasnap': (286980532, 286980536, 286980544), 'prym': (257994790, 257994796, 257994803)}.items():
    for deel, vid in zip('abc', ids): add('druk_%s_%s' % (merk, deel), vid)
add('druk_dot_c_bout', 258002241, 'DOT drukknoop deel C — bout RVS M5 × 9 mm')
add('druk_dot_c_popnagel', 257994867, 'DOT drukknoop deel C — popnagel RVS 8 mm')
add('druk_dot_c_raamclip', 257997395, 'DOT drukknoop deel C — raamclip RVS 24 mm')
add('druk_holpijp', 313343275, 'Paffrath holpijp rond 3 mm', perOrder=True, tool=True)
add('druk_stempel', 256701648, 'Osborne stempel voor drukknopen (229-24)', perOrder=True, tool=True)
# --- Zeilringen + gereedschap (ringmaat = setmaat)
for din, rvs, messing, setvid in ((10, 260094625, 260094491, 313445757), (12, 260095659, 260095620, 313482374), (16, 260096214, 260096117, 313482376)):
    add('ring_%d_rvs' % din, rvs, 'MH zeilring DIN %d — RVS' % din); add('ring_%d_messing' % din, messing, 'MH zeilring DIN %d — messing' % din)
    add('ring_%d_set' % din, setvid, 'Holpijp & stempel %d mm + gratis stansblok' % din, perOrder=True, tool=True)
# --- Koord, haken, knoppen
for k, vid in {'6_zwart': 259527665, '6_wit': 259527590, '8_zwart': 259419002, '8_wit': 259527714}.items():
    add('shock_' + k, vid, 'Shockcord / elastiek %s mm — %s' % tuple(k.split('_')), 'm')
add('koordhaak', 302548075, 'Koordhaak nylon wit (6–10 mm koord)')
add('musketon', 259143564, 'Musketonhaak nylon zwart (8 mm)')
add('koordklem', 277045622, 'Koordklem rond RVS 8 mm (koordeinden afwerken)')
add('rondknop', 259998021, 'MH rondknop asymmetrisch zwart 30 × 24 mm'); add('noorse_knop', 257072753, 'Marinetech Noorse knop RVS 11 × 10 mm')
# --- Klittenband (naaibaar, per meter)
for w, haak, lus in ((25, 260597286, 260606379), (50, 260607937, 260609573)):
    add('klit_%d_haak' % w, haak, 'Klittenband zwart %d mm — haak (hard)' % w, 'm'); add('klit_%d_lus' % w, lus, 'Klittenband zwart %d mm — lus (zacht)' % w, 'm')
# --- Bootkap extra's
add('raamfolie', 293617490, 'Achilles Vinistar Super raamfolie 0,4 mm (137 cm breed)', 'm', rolCm=137)
add('raamfolie_05', 323098115, 'Achilles Vinistar Smoke Tint raamfolie 0,5 mm (137 cm breed)', 'm', rolCm=137)
add('tape_6', 302835931, 'Seam Stick dubbelzijdig tape 6 mm (rol 50 m)', perOrder=True)
add('tape_9', 297791084, 'Seam Stick dubbelzijdig tape 9 mm (rol 50 m)', perOrder=True)
add('tape_12', 297791091, 'Seam Stick dubbelzijdig tape 12 mm (rol 50 m)', perOrder=True)
add('mallendoek', 325737735, 'Mallendoek LDPE gerecycled 0,18 mm, 300 cm breed', 'm', rolCm=300)
add('mallendoek_rol', 325737733, 'Mallendoek LDPE gerecycled 0,18 mm, 300 cm breed — rol 50 m', 'st', rolLengteM=50)
add('band_25_zwart', 325093988, 'Polyesterband 1366 zwart 25 mm', 'm'); add('klemgesp', 313387985, 'Klemgesp RVS 25 mm')
add('beugel_zwart', 269081614, 'Bandbeugel nylon zwart 25 mm'); add('beugel_wit', 269081652, 'Bandbeugel nylon wit 25 mm'); add('beugel_rvs', 256947996, 'Bandbeugel RVS luxe 25 mm')
add('glaspotlood', 267142123, 'Staedtler glaspotlood wit', perOrder=True)
# --- Lijmen / onderhoud / zonwering
add('saba_250', 282388634, 'Saba Sabacontact 70T PVC-lijm 250 ml', perOrder=True)
add('saba_1l', 253895183, 'Saba Sabacontact 70T PVC-lijm 1 liter', perOrder=True)
add('sabaclean', 253891984, 'Sabaclean 21 reiniger voor 70T — 1 liter', perOrder=True)
add('griffon_cleaner', 253891969, 'Griffon cleaner 250 ml (PVC ontvetter)', perOrder=True)
add('ferrari_cleaner', 259191434, 'Serge Ferrari cleaner & stain remover (PVC) 500 ml', perOrder=True)
add('fabric_guard', 252696033, '303 Fabric Guard impregneer 946 ml', perOrder=True)
add('multi_cleaner', 284824378, '303 Multi Surface Cleaner', perOrder=True)
add('zeilnaalden', 255046148, 'Prym zeilnaalden (set van 5)', perOrder=True)
add('zuignap', 314190231, 'Zuignap met lip 50 mm transparant (M4)')
add('stansblok', 299203891, 'Nylon stansblok 15 × 15 cm', perOrder=True, tool=True)
# --- ritsen (deelbaar, zwart) — lengtes uit detail3
def ritsen(rx):
    out = {}
    for p in D.values():
        if 'variants' in p and re.search(rx, p['title'], re.I):
            for k, v in p['variants'].items():
                m = re.search(r'([\d,]+)\s*(cm|m)', v['title'])
                if not m: continue
                n = float(m.group(1).replace(',', '.')); cm = n if m.group(2) == 'cm' else n * 100
                out[str(int(round(cm)))] = dict(vid=k, url=p['url'], naam=p['title'].split('|')[1].strip() + ' — ' + v['title'], prijs=v['price'], unit='st')
    return dict(sorted(out.items(), key=lambda x: float(x[0])))
RITSEN = {'bloktand': ritsen(r'Rits Bloktand \| 10V \| Deelbaar \| 10mm \| Zwart'), 'spiraal': ritsen(r'Rits Spiraal \| 10C \| Deelbaar \| 10mm \| Zwart$|Rits Spiraal \| 10C \| Deelbaar \| 10mm \| Zwart')}

STATUS = {k: V[v['vid']]['op'] for k, v in P.items()}
for d in DOEKEN.values():
    for k in d['kleuren']: STATUS['doek:' + k['vid']] = V[k['vid']]['op']

cat = dict(versie=__import__('datetime').date.today().isoformat(),
           imgBase='https://cdn.webshopapp.com/shops/317184/files/', doeken=DOEKEN, garen=GAREN, p=P, ritsen=RITSEN)
js = ('/* AUTOMATISCH GEGENEREERD door tools/build_catalog.py — niet met de hand wijzigen.\n'
      '   Prijzen zijn alleen fallback: de tool haalt live prijs + voorraad op uit de shop. */\n'
      '(function (root, factory) {\n  var c = factory();\n  if (typeof module === "object" && module.exports) module.exports = c;\n  else root.EsailsCatalog = c;\n'
      '})(typeof self !== "undefined" ? self : this, function () {\n  return ' + json.dumps(cat, ensure_ascii=False, indent=1) + ';\n});\n')
open(OUT, 'w').write(js)
json.dump(dict(status=STATUS), open(os.path.join(CRAWL, 'status.json'), 'w'))
print('doeken', {k: len(v['kleuren']) for k, v in DOEKEN.items()}, 'garen', len(GAREN), 'producten', len(P),
      'ritsen', {k: list(v) for k, v in RITSEN.items()})
print('NIET OP VOORRAAD:', [k for k, ok in STATUS.items() if not ok and not k.startswith('doek:')])
