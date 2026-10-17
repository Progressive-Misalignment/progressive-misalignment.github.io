#!/usr/bin/env python3
"""Rename "Phi-4" to "Phi-4 14B" in the thread animations, frame by frame.

Usage: python3 scripts/relabel_phi4.py SRC_DIR DST_DIR [--preview]
SRC_DIR and DST_DIR may be the same folder. Run it only on freshly rendered
animations: on already relabelled files it would add "14B" a second time.

The Manim sources of these animations are not in this repository, so the
labels are edited in the rendered frames. The original "Phi-4" pixels are
kept in every frame (so fades are untouched), and " 14B" is copied from the
"14B" glyphs of the neighbouring "Qwen3-14B" label (same font and size),
moved onto the baseline of "Phi-4", recoloured, and shown with the Phi-4
label's opacity in that frame.
Needs ffmpeg, numpy and Pillow.
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 1920, 1080
# For each video: the "Phi-4" labels to extend. Boxes are (x0, y0, x1, y1) in the
# 1920x1080 frame; "qwen" is the label whose "14B" glyphs are copied; "center"
# keeps the new label centred on the old one (labels under bars), otherwise it
# keeps its left edge (legend entries).
JOBS = {
    '5_data_selection': [
        {'phi': (1186, 962, 1270, 991), 'qwen': (920, 962, 1110, 991), 'center': True},
        {'phi': (1717, 962, 1800, 991), 'qwen': (1450, 962, 1640, 991), 'center': True},
    ],
    '2_main_results': [
        # The legend entries after it move right to keep even spacing.
        {'phi': (1052, 87, 1130, 113), 'qwen': (820, 87, 990, 113), 'center': False,
         'push': ((1200, 80, 1880, 122), 24)},
    ],
}
SPACE = 12  # px between "Phi-4" and "14B", about a word space at this size


def coverage(region):
    """Ink coverage in [0, 1] of text on white, from the darkest channel."""
    return 1 - region.min(axis=2) / 255


def last_frame(path):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-sseof', '-0.2', '-i', str(path), '-frames:v', '1',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(out, np.uint8).reshape(H, W, 3)


def glyph_runs(cov):
    """Column ranges of connected ink (glyphs) in a label."""
    on = cov.max(axis=0) > 0.15
    runs, start = [], None
    for i, v in enumerate(list(on) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append((start, i))
            start = None
    return runs


def vertical_offset(a, b, up=40, reach=4):
    """How far b must move down (sub-pixel) to match a: cross-correlate after upsampling rows."""
    h = a.shape[0]
    rows = np.linspace(0, h - 1, (h - 1) * up + 1)
    A = np.stack([np.interp(rows, np.arange(h), a[:, c]) for c in range(a.shape[1])], axis=1)
    B = np.stack([np.interp(rows, np.arange(h), b[:, c]) for c in range(b.shape[1])], axis=1)
    w = min(A.shape[1], B.shape[1])
    A, B = A[:, :w], B[:, :w]
    edge = reach * up
    errors = [((A[edge:-edge] - np.roll(B, k, axis=0)[edge:-edge]) ** 2).sum() for k in range(-edge, edge + 1)]
    return (int(np.argmin(errors)) - edge) / up


def shift_rows(img, dy, pad):
    """Move an image down by dy (sub-pixel) inside `pad` extra rows above and below."""
    h, w = img.shape
    out = np.zeros((h + 2 * pad, w))
    whole = int(np.floor(dy))
    frac = dy - whole
    for part, weight in ((whole, 1 - frac), (whole + 1, frac)):
        top = pad + part
        out[top:top + h] += weight * img
    return out


def prepare(final, job):
    x0, y0, x1, y1 = job['phi']
    phi = coverage(final[y0:y1, x0:x1].astype(float))
    ink = final[y0:y1, x0:x1][phi > 0.85]
    colour = np.median(ink, axis=0)
    qx0, qy0, qx1, qy1 = job['qwen']
    pad = 4
    # Measure on taller crops, so baselines are compared in frame coordinates.
    q = coverage(final[qy0 - pad:qy1 + pad, qx0:qx1].astype(float))
    runs = glyph_runs(q)
    s, e = runs[-3][0], runs[-1][1]  # the last three glyphs: "1", "4", "B"
    tail = q[:, s:e]
    tail = tail / max(tail.max(), 1e-6)
    # Put the copied "14B" on the baseline of "Phi-4": match its "4" to the "4" of "Phi-4".
    p = coverage(final[qy0 - pad:qy1 + pad, x0:x1].astype(float))
    f0, f1 = glyph_runs(p)[-1]
    t0, t1 = glyph_runs(tail)[1]
    dy = vertical_offset(p[:, f0:f1], tail[:, t0:t1])
    tail = shift_rows(tail, dy + (qy0 - y0), pad)  # rows now start at y0 - 2 * pad
    width = (x1 - x0) + SPACE + tail.shape[1]
    shift = -((width - (x1 - x0)) // 2) if job['center'] else 0
    return dict(job, phi_cov=phi, colour=colour, tail=tail, tail_top=y0 - 2 * pad, shift=shift, dy=dy)


def patch(frame, p):
    x0, y0, x1, y1 = p['phi']
    region = frame[y0:y1, x0:x1].astype(float)
    cov = coverage(region)
    ref = p['phi_cov']
    alpha = float(np.clip((cov * ref).sum() / max((ref * ref).sum(), 1e-6), 0, 1))
    out = frame
    if p.get('push'):
        (px0, py0, px1, py1), dx = p['push']
        moved = frame[py0:py1, px0:px1].copy()
        out[py0:py1, px0:px1 + dx] = 255
        out[py0:py1, px0 + dx:px1 + dx] = moved
    if alpha < 0.01:
        return alpha
    block = frame[y0:y1, x0:x1].copy()
    if p['shift']:
        out[y0:y1, x0:x1] = 255
        nx0 = x0 + p['shift']
        out[y0:y1, nx0:nx0 + (x1 - x0)] = np.minimum(out[y0:y1, nx0:nx0 + (x1 - x0)], block)
    else:
        nx0 = x0
    tx0 = nx0 + (x1 - x0) + SPACE
    th, tw = p['tail'].shape
    ty = p['tail_top']
    c = (alpha * np.clip(p['tail'], 0, 1))[..., None]
    target = out[ty:ty + th, tx0:tx0 + tw].astype(float)
    out[ty:ty + th, tx0:tx0 + tw] = np.clip(target * (1 - c) + p['colour'] * c, 0, 255).astype(np.uint8)
    return alpha


def run(src, dst, name, preview):
    path = src / f'{name}.mp4'
    final = last_frame(path)
    plans = [prepare(final, job) for job in JOBS[name]]
    print(name, 'baseline shifts:', ', '.join(f"{p['dy']:+.2f} px" for p in plans))
    if preview:
        frame = final.copy()
        for p in plans:
            patch(frame, p)
        Image.fromarray(frame).save(dst / f'{name}-preview.png')
        return
    rate = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate',
                           '-of', 'csv=p=0', str(path)], check=True, capture_output=True, text=True).stdout.strip()
    decode = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    encode = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', rate, '-i', '-',
                               '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                               str(dst / f'{name}.tmp.mp4')], stdin=subprocess.PIPE)
    frames = 0
    while True:
        raw = decode.stdout.read(W * H * 3)
        if len(raw) < W * H * 3:
            break
        frame = np.frombuffer(raw, np.uint8).reshape(H, W, 3).copy()
        for p in plans:
            patch(frame, p)
        encode.stdin.write(frame.tobytes())
        frames += 1
    encode.stdin.close()
    encode.wait()
    decode.wait()
    (dst / f'{name}.tmp.mp4').replace(dst / f'{name}.mp4')
    # The GIF, with the recipe from the thread folder's README.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(dst / f'{name}.mp4'), '-vf',
                    'fps=20,scale=1200:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];'
                    '[b][p]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', str(dst / f'{name}.gif')], check=True)
    print(f'{name}: {frames} frames')


if __name__ == '__main__':
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    for name in JOBS:
        run(src, dst, name, '--preview' in sys.argv)
