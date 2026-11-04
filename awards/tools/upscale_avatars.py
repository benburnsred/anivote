"""Upscale small round profile pictures (awards/img/<year>/*-avatar.png) 4x with Real-ESRGAN.

Each upscaled copy is saved next to the original as *-avatar-hd.png, and the nominees tables are pointed at
it. Originals are kept, and avatars that already have an -hd copy are skipped, so this is safe to rerun.

    python3 upscale_avatars.py --pending   # print avatars still to upscale (no torch needed)
    python3 upscale_avatars.py             # upscale them (needs torch, spandrel and the model weights)
    python3 upscale_avatars.py --dry       # same flow with a plain resize instead of the model, for testing

Runs in the Pages workflow, which installs the dependencies only when --pending prints something.
"""
import glob
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # awards/
SCALE = 4
MODELS = os.environ.get('MODELS_DIR', '/tmp/esrgan')
ANIME_MODEL = 'RealESRGAN_x4plus_anime_6B.pth'
PHOTO_MODEL = 'RealESRGAN_x4plus.pth'
# Avatars that are real photos rather than illustrations get the general model (file names without -avatar.png).
PHOTOS = {'jang', 'meowmie', 'midnightsun27', 'sorrow', 'totto'}


def pending():
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'img', '*', '*-avatar.png'))):
        if not os.path.exists(path[:-4] + '-hd.png'):
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
    from PIL import Image
    t = torch.from_numpy(np.asarray(img, dtype=np.float32) / 255).permute(2, 0, 1).unsqueeze(0)
    out = model(t).clamp(0, 1).squeeze(0).permute(1, 2, 0).numpy()
    return Image.fromarray((out * 255).round().astype('uint8'))


def main():
    todo = pending()
    if '--pending' in sys.argv:
        print('\n'.join(todo))
        return 0
    if not todo:
        print('avatars: nothing to upscale')
        return 0
    from PIL import Image, ImageDraw  # only needed for real work, so --pending runs without Pillow
    dry = '--dry' in sys.argv
    models = None if dry else load_models()
    done = {}
    for path in todo:
        name = os.path.basename(path)[:-len('-avatar.png')]
        src = Image.open(path).convert('RGBA')
        # Fill the transparent corners with the average edge colour so the model doesn't invent a dark halo.
        flat = Image.new('RGB', src.size, tuple(int(v) for v in src.convert('RGB').resize((1, 1)).getpixel((0, 0))))
        flat.paste(src.convert('RGB'), mask=src.split()[3])
        if dry:
            big = flat.resize((src.width * SCALE, src.height * SCALE), Image.LANCZOS)
        else:
            big = upscale(flat, models[PHOTO_MODEL if name in PHOTOS else ANIME_MODEL])
        # Re-cut the circle at full resolution, slightly inside the old edge, with a smooth (supersampled) border.
        w, h = big.size
        mask = Image.new('L', (w * 4, h * 4), 0)
        inset = SCALE * 4 * 2
        ImageDraw.Draw(mask).ellipse((inset, inset, w * 4 - inset - 1, h * 4 - inset - 1), fill=255)
        big.putalpha(mask.resize((w, h), Image.LANCZOS))
        out = path[:-4] + '-hd.png'
        big.save(out, optimize=True)
        done[os.path.relpath(path, ROOT)] = os.path.relpath(out, ROOT)
        print(f'upscaled {os.path.relpath(path, ROOT)} -> {big.size[0]}px')
    # Point the nominees tables at the new files ("../img/2025/x-avatar.png" -> "../img/2025/x-avatar-hd.png").
    for csv_path in glob.glob(os.path.join(ROOT, '*', 'data', '*.csv')):
        text = open(csv_path, encoding='utf-8').read()
        new = text
        for old, hd in done.items():
            new = new.replace('../' + old.replace(os.sep, '/'), '../' + hd.replace(os.sep, '/'))
        if new != text:
            open(csv_path, 'w', encoding='utf-8').write(new)
            print(f'updated {os.path.relpath(csv_path, ROOT)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
