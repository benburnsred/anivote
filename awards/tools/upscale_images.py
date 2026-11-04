"""Upscale small awards pictures (awards/img/<year>/*) with Real-ESRGAN.

Pictures cut from presentation slides are only 150-400px wide, which looks soft on large cards. Each picture
narrower than MIN_WIDTH gets a 4x upscaled copy saved next to it as <name>-hd.<ext> (shrunk to at most
MAX_WIDTH), and the year's data tables are pointed at it. Originals are kept, pictures that already have an
-hd copy are skipped, and trophies and host portraits (already large) are left alone, so this is safe to rerun.
Round profile pictures (*-avatar.png) get their circle re-cut at full resolution.

    python3 upscale_images.py --pending   # list pictures still to upscale
    python3 upscale_images.py             # upscale them (needs torch, spandrel and the model weights)
    python3 upscale_images.py --dry       # same flow with a plain resize instead of the model, for testing

Runs in the Pages workflow, which installs torch only when --pending prints something.
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # awards/
SCALE = 4
MIN_WIDTH = 400
MAX_WIDTH = 800
SKIP_PREFIXES = ('trophy-', 'host-')
MODELS = os.environ.get('MODELS_DIR', '/tmp/esrgan')
ANIME_MODEL = 'RealESRGAN_x4plus_anime_6B.pth'
PHOTO_MODEL = 'RealESRGAN_x4plus.pth'
# Real photos rather than illustrations get the general model (file names without extension or -avatar).
PHOTOS = {'jang', 'meowmie', 'midnightsun27', 'sorrow', 'totto', 'aljurians', 'reawaker', 'kakumei-douchuu',
          '2-22-25-pangit-meet-up', 'ova13', 'tekken-8'}


def hd_path(path):
    base, ext = os.path.splitext(path)
    return base + '-hd' + ext


def pending():
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'img', '[0-9]*', '*'))):
        name = os.path.basename(path)
        if os.path.splitext(name)[0].endswith('-hd') or name.startswith(SKIP_PREFIXES) or os.path.exists(hd_path(path)):
            continue
        if not name.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            continue
        if Image.open(path).width < MIN_WIDTH:
            out.append(path)
    return out


def load_models():
    import torch
    from spandrel import ModelLoader
    torch.set_grad_enabled(False)
    return {name: ModelLoader().load_from_file(os.path.join(MODELS, name)).eval() for name in (ANIME_MODEL, PHOTO_MODEL)}


def upscale(img, model):
    import numpy as np
    import torch
    t = torch.from_numpy(np.asarray(img, dtype=np.float32) / 255).permute(2, 0, 1).unsqueeze(0)
    out = model(t).clamp(0, 1).squeeze(0).permute(1, 2, 0).numpy()
    return Image.fromarray((out * 255).round().astype('uint8'))


def main():
    todo = pending()
    if '--pending' in sys.argv:
        print('\n'.join(todo))
        return 0
    if not todo:
        print('images: nothing to upscale')
        return 0
    dry = '--dry' in sys.argv
    models = None if dry else load_models()
    done = {}
    for path in todo:
        stem = os.path.splitext(os.path.basename(path))[0]
        name = stem[:-len('-avatar')] if stem.endswith('-avatar') else stem
        avatar = stem.endswith('-avatar')
        src = Image.open(path).convert('RGBA')
        # Fill transparent areas (avatar corners) with the average colour so the model doesn't invent a dark halo.
        flat = Image.new('RGB', src.size, tuple(int(v) for v in src.convert('RGB').resize((1, 1)).getpixel((0, 0))))
        flat.paste(src.convert('RGB'), mask=src.split()[3])
        if dry:
            big = flat.resize((src.width * SCALE, src.height * SCALE), Image.LANCZOS)
        else:
            big = upscale(flat, models[PHOTO_MODEL if name in PHOTOS else ANIME_MODEL])
        if big.width > MAX_WIDTH:
            big = big.resize((MAX_WIDTH, round(big.height * MAX_WIDTH / big.width)), Image.LANCZOS)
        out = hd_path(path)
        if avatar:
            # Re-cut the circle at full resolution, slightly inside the old edge, with a smooth (supersampled) border.
            w, h = big.size
            mask = Image.new('L', (w * 4, h * 4), 0)
            inset = SCALE * 4 * 2
            ImageDraw.Draw(mask).ellipse((inset, inset, w * 4 - inset - 1, h * 4 - inset - 1), fill=255)
            big.putalpha(mask.resize((w, h), Image.LANCZOS))
            big.save(out, optimize=True)
        elif out.lower().endswith('.png'):
            big.save(out, optimize=True)
        else:
            big.save(out, quality=88)
        done[os.path.relpath(path, ROOT)] = os.path.relpath(out, ROOT)
        print(f'upscaled {os.path.relpath(path, ROOT)} -> {big.width}px')
    # Point the data tables at the new files ("../img/2025/x.jpg" -> "../img/2025/x-hd.jpg").
    for csv_path in glob.glob(os.path.join(ROOT, '*', 'data', '*.csv')):
        text = open(csv_path, encoding='utf-8').read()
        new = text
        for old, hd in done.items():
            new = new.replace('../' + old.replace(os.sep, '/') + ',', '../' + hd.replace(os.sep, '/') + ',')
            new = new.replace('../' + old.replace(os.sep, '/') + '\n', '../' + hd.replace(os.sep, '/') + '\n')
        if new != text:
            open(csv_path, 'w', encoding='utf-8').write(new)
            print(f'updated {os.path.relpath(csv_path, ROOT)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
