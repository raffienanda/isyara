"""Render the A–Z practice illustrations with one scale and material."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

import render_hands as renderer
import render_letter_d

POSES = Path(__file__).with_name("alphabet_poses.json")
OUTPUT = renderer.ROOT / "public" / "alfabet-3d"
SIZE = 600
STAGE = 800
PADDING = 46
PALM_SIZE = 196
CREAM = (255, 246, 222)
GREEN = (24, 154, 112)
PAIR = ((23, 112, 91), (99, 202, 151))


def render_pose(rows):
    hands = np.asarray(rows, dtype=float)
    low = hands[:, :, :2].min(axis=(0, 1))
    high = hands[:, :, :2].max(axis=(0, 1))
    palm = np.median(np.linalg.norm(hands[:, 9, :2] - hands[:, 0, :2], axis=1))
    # Keep a common palm scale. Only spread-out poses need to scale down.
    scale = min(PALM_SIZE / palm, (SIZE - 2 * PADDING - 98) / max(high - low))
    width = palm * scale * .185
    hands *= scale
    hands[:, :, :2] += STAGE / 2 - (low + high) * scale / 2
    frame = np.full((STAGE, STAGE, 3), CREAM, dtype=np.uint8)
    for hand, color in zip(hands, PAIR if len(hands) == 2 else (GREEN,)):
        renderer.hand_mesh(frame, hand, color, hand_width=width, tip_roundness=.92, separate_folds=True, sculpted=True)
    yy, xx = np.where(np.any(frame != CREAM, axis=2))
    assert min(xx.min(), yy.min(), STAGE-1-xx.max(), STAGE-1-yy.max()) > 0
    hand_image = Image.fromarray(frame[yy.min():yy.max()+1, xx.min():xx.max()+1])
    hand_image.thumbnail((SIZE-2*PADDING, SIZE-2*PADDING), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (SIZE, SIZE), CREAM)
    canvas.paste(hand_image, ((SIZE-hand_image.width)//2, (SIZE-hand_image.height)//2))
    return canvas


if __name__ == "__main__":
    renderer.WIDTH = renderer.HEIGHT = STAGE
    poses = json.loads(POSES.read_text())
    for letter, landmarks in poses.items():
        if letter == "D":
            render_letter_d.render(CREAM, PAIR, SIZE, PADDING).save(OUTPUT / "D-lembut.webp", lossless=True)
        else:
            render_pose(landmarks).save(OUTPUT / f"{letter}-lembut.webp", lossless=True)
