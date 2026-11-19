#!/usr/bin/env python3
"""Crawlt esails.nl (alleen lezen) voor de catalogus-generator.

Gebruik:  python3 -I tools/crawl.py <map>
Schrijft  <map>/listing.json  (alle producten, default-variant, prijs, voorraad, afbeelding)
          <map>/detail3.json  (alle varianten van relevante multi-variant producten + stalen)
Daarna:   python3 -I tools/build_catalog.py <map>

Rustig tempo (de shop rate-limit bij te veel verzoeken): ~0,7 s per product.
"""
import json, os, re, ssl, sys, time, urllib.error, urllib.request

BASE = 'https://www.esails.nl/'
MAP = sys.argv[1] if len(sys.argv) > 1 else 'crawl'
os.makedirs(MAP, exist_ok=True)
CA = os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None)
CTX = ssl.create_default_context(cafile=CA) if CA else ssl.create_default_context()
UA = {'User-Agent': 'esails-keuzehulp-catalog/1.0', 'Accept': 'application/json'}

RELEVANT = re.compile(r'doek|garen|rits|loxx|tourniquet|drukkno|zeilring|zeilkous|shockcord|elastiek|klittenband|holpijp|stempel|'
                      r'saba|303|lijm|zuignap|raamfolie|mallendoek|tape|ferrari|sunbrella|sauleda|mehler|polymar|gaas|koord', re.I)
STAAL = re.compile(r'(Sunbrella \| Plus .*SAMPLES|Sauleda \| Sea Star Special \| Bootdoek \| Sample)', re.I)


def get(path, tries=6):
    for a in range(tries):
        try:
            req = urllib.request.Request(BASE + path, headers=UA)
            return json.load(urllib.request.urlopen(req, context=CTX, timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(10 * (a + 1)); continue
            raise
        except Exception:
            time.sleep(3)
    raise RuntimeError('mislukt: ' + path)


def main():
    # 1. listing
    listing, page, pages = {}, 1, 1
    while page <= pages:
        c = get('collection/page%d.html?format=json&limit=100' % page)['collection']
        pages = c.get('pages') or 1
        for p in c['products'].values():
            listing[str(p['id'])] = dict(id=p['id'], vid=p['vid'], url=p['url'], title=p['fulltitle'], variant=p['variant'],
                                         price=p['price']['price_incl'], avail=p['available'], image=p.get('image'))
        print('listing pagina %d/%d — %d producten' % (page, pages, len(listing)), flush=True)
        page += 1
        time.sleep(0.5)
    json.dump(listing, open(os.path.join(MAP, 'listing.json'), 'w'))

    # 2. details: multi-variant relevante producten + stalen
    todo = [p for p in listing.values()
            if (RELEVANT.search(p['title']) and p['variant'] not in ('Default', None, False, '') and not re.search('sample', p['title'], re.I))
            or STAAL.search(re.sub(r'\s+', ' ', p['title']))]
    detail = {}
    for n, p in enumerate(todo, 1):
        try:
            d = get(p['url'] + '?format=json')['product']
        except Exception as e:
            detail[str(p['id'])] = dict(url=p['url'], error=str(e)); continue
        vs = d.get('variants') or {}
        var = {k: dict(title=v['title'], price=v['price']['price_incl'], avail=v['stock']['available'], level=v['stock'].get('level'))
               for k, v in vs.items()}
        if not var:
            var = {str(d['vid']): dict(title=d.get('variant') or 'Default', price=d['price']['price_incl'], avail=d['stock']['available'])}
        detail[str(p['id'])] = dict(id=d['id'], url=p['url'], title=re.sub(r'\s+', ' ', d['fulltitle']), variants=var)
        if n % 20 == 0: print('details %d/%d' % (n, len(todo)), flush=True)
        time.sleep(0.7)
    json.dump(detail, open(os.path.join(MAP, 'detail3.json'), 'w'))
    fout = [d for d in detail.values() if 'error' in d]
    print('klaar: %d producten, %d met varianten, %d fouten' % (len(listing), len(detail) - len(fout), len(fout)))


if __name__ == '__main__':
    main()
