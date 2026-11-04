"""Download cover art for awards nominees and save it in the repo.

For every awards/<year>/data/nominees.csv row that has an `image_search` title but no `image`, look the
title up on AniList (then Jikan / MyAnimeList), download the poster to awards/img/covers/, and fill in
`image` with its path. Pages then load covers from the site itself instead of calling those APIs from
every visitor's browser. Rows that already have an `image` are never touched, so this is safe to rerun.

Runs in the Pages workflow before each deploy; stdlib only.
"""
import csv
import glob
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # awards/
COVERS = os.path.join(ROOT, 'img', 'covers')
UA = {'User-Agent': 'anivote-awards-cover-fetcher'}


def slug(s):
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', s.lower()))


def get_json(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={**UA, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.load(e) if e.code == 404 else None  # AniList answers "not found" with a 404 body
    except Exception as e:  # service down or unreachable: treat as "not found" and carry on
        print(f'  {urllib.parse.urlparse(url).netloc} unavailable: {e}')
        return None


def anilist(title):
    q = 'query($s:String){Media(search:$s,type:ANIME,format_not_in:[SPECIAL,OVA,TV_SHORT,MUSIC]){coverImage{extraLarge large}}}'
    j = get_json('https://graphql.anilist.co', {'query': q, 'variables': {'s': title}}) or {}
    c = ((j.get('data') or {}).get('Media') or {}).get('coverImage') or {}
    return c.get('extraLarge') or c.get('large')


def jikan(title):
    j = get_json('https://api.jikan.moe/v4/anime?limit=1&q=' + urllib.parse.quote(title)) or {}
    imgs = ((j.get('data') or [{}])[0]).get('images') or {}
    return (imgs.get('jpg') or {}).get('large_image_url') or (imgs.get('webp') or {}).get('large_image_url')


def download(url, name):
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
    ext = ext if ext in ('.jpg', '.jpeg', '.png', '.webp') else '.jpg'
    path = os.path.join(COVERS, name + ext)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        data = r.read()
    if len(data) < 1024:
        raise ValueError('image too small')
    with open(path, 'wb') as f:
        f.write(data)
    return os.path.basename(path)


def main():
    os.makedirs(COVERS, exist_ok=True)
    found = {}  # image_search title -> covers file name, shared across years
    missed = []
    for csv_path in sorted(glob.glob(os.path.join(ROOT, '*', 'data', 'nominees.csv'))):
        with open(csv_path, newline='', encoding='utf-8') as f:
            rows = list(csv.reader(f))
        head = [h.strip().lower() for h in rows[0]]
        if 'image_search' not in head or 'image' not in head:
            continue
        si, ii = head.index('image_search'), head.index('image')
        changed = False
        for r in rows[1:]:
            r += [''] * (len(head) - len(r))
            title = r[si].strip()
            if not title or r[ii].strip():
                continue
            if title not in found:
                existing = glob.glob(os.path.join(COVERS, slug(title) + '.*'))
                if existing:
                    found[title] = os.path.basename(existing[0])
                else:
                    url = anilist(title)
                    time.sleep(2.1)  # AniList allows ~30 requests a minute
                    if not url:
                        print(f'  AniList has no match for {title!r}, trying Jikan')
                        url = jikan(title)
                        time.sleep(1)
                    try:
                        found[title] = download(url, slug(title)) if url else None
                    except Exception as e:  # keep going; the page falls back to a live lookup
                        print(f'  download failed for {title!r}: {e}')
                        found[title] = None
            if found[title]:
                # Year pages and the ballot both sit one folder below awards/.
                r[ii] = '../img/covers/' + found[title]
                changed = True
            elif title not in missed:
                missed.append(title)
        if changed:
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                csv.writer(f, lineterminator='\n').writerows(rows)
            print(f'updated {os.path.relpath(csv_path, ROOT)}')
    got = sorted(t for t, v in found.items() if v)
    print(f'covers: {len(got)} found, {len(missed)} not found')
    for t in missed:
        print(f'  not found: {t}')
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as f:
            f.write(f'### Cover art\n{len(got)} found, {len(missed)} not found\n')
            f.writelines(f'- not found: {t}\n' for t in missed)
    return 0


if __name__ == '__main__':
    sys.exit(main())
