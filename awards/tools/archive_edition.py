"""Freeze an awards edition that reads a Google Sheet into a permanent copy inside the repo.

    python3 archive_edition.py 2026

Reads NOMINEES_CSV and SETTINGS_CSV from awards/<year>/index.html. If they're published Google Sheet links, it
downloads both into awards/<year>/data/, turns voting off in the saved settings, downloads nominee pictures
hosted elsewhere into awards/img/<year>/, and points the page back at the saved files. After that the edition
no longer depends on the Sheet, like 2025. Running it again on an archived edition changes nothing.

Run from the Pages workflow (Actions -> Deploy -> Run workflow -> archive year), which has internet access.
"""
import csv
import io
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # awards/
UA = {'User-Agent': 'axa-awards-archiver'}


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


def slug(s):
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', s.lower()))[:60]


def main():
    year = sys.argv[1] if len(sys.argv) > 1 else ''
    if not re.fullmatch(r'\d{4}', year) or not os.path.isdir(os.path.join(ROOT, year)):
        print(f'archive: no edition folder awards/{year}')
        return 1
    page_path = os.path.join(ROOT, year, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    urls = dict(re.findall(r"const (NOMINEES_CSV|SETTINGS_CSV) = '([^']*)';", page))
    if not all(u.startswith('http') for u in urls.values()) or len(urls) != 2:
        print(f'archive: {year} already reads saved files, nothing to do')
        return 0
    data_dir = os.path.join(ROOT, year, 'data')
    img_dir = os.path.join(ROOT, 'img', year)
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(img_dir, exist_ok=True)

    # Settings: voting is over once an edition is archived.
    settings = list(csv.reader(io.StringIO(fetch(urls['SETTINGS_CSV']).decode('utf-8'))))
    if not settings or [h.strip().lower() for h in settings[0][:2]] != ['key', 'value']:
        raise SystemExit('archive: Settings link did not return the Settings tab (is it published as CSV?)')
    for r in settings[1:]:
        if r and r[0].strip() == 'vote_open':
            r[1] = 'FALSE'

    # Nominees: keep every column; download pictures hosted elsewhere so they can't disappear.
    rows = list(csv.reader(io.StringIO(fetch(urls['NOMINEES_CSV']).decode('utf-8'))))
    if not rows or 'category' not in [h.strip().lower() for h in rows[0]]:
        raise SystemExit('archive: Site link did not return the Site tab (is it published as CSV?)')
    head = [h.strip().lower() for h in rows[0]]
    ii, ni, ci = head.index('image') if 'image' in head else -1, head.index('nominee'), head.index('category')
    saved = 0
    for r in rows[1:]:
        r += [''] * (len(head) - len(r))
        if ii < 0 or not r[ii].startswith('http'):
            continue
        ext = os.path.splitext(urllib.parse.urlparse(r[ii]).path)[1].lower()
        ext = ext if ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif') else '.jpg'
        name = slug(r[ni] or r[ci]) + ext
        try:
            data = fetch(r[ii])
            if len(data) < 1024:
                raise ValueError('image too small')
            with open(os.path.join(img_dir, name), 'wb') as f:
                f.write(data)
            r[ii] = f'../img/{year}/{name}'
            saved += 1
        except Exception as e:  # keep the original link rather than fail the archive
            print(f'  could not download picture for {r[ni]!r}: {e}')

    with open(os.path.join(data_dir, 'settings.csv'), 'w', newline='', encoding='utf-8') as f:
        csv.writer(f, lineterminator='\n').writerows(settings)
    with open(os.path.join(data_dir, 'nominees.csv'), 'w', newline='', encoding='utf-8') as f:
        csv.writer(f, lineterminator='\n').writerows(rows)

    page = re.sub(r"(// Published Site and Settings tabs[^\n]*\n)?const NOMINEES_CSV = '[^']*';",
                  "const NOMINEES_CSV = 'data/nominees.csv';", page, count=1)
    page = re.sub(r"const SETTINGS_CSV = '[^']*';", "const SETTINGS_CSV = 'data/settings.csv';", page, count=1)
    with open(page_path, 'w', encoding='utf-8') as f:
        f.write(page)
    print(f'archive: saved {len(rows) - 1} nominee rows, {len(settings) - 1} settings and {saved} pictures for {year}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
