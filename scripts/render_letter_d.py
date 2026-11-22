"""Sculpt letter D from the contours of the two hands in D5.jpg."""

import cv2
import numpy as np
from PIL import Image

from render_hands import surface

# Curves are hand traced from the reference. Wrist ends are rounded just
# beyond the palm so that the same artwork also works without forearms.
CURVED = (
    (56,420),
    (43,407,54,384,67,354),(78,328,70,309,59,291),
    (45,270,51,242,67,228),(79,216,95,211,112,215),
    (125,209,142,211,155,218),(166,215,173,217,181,218),
    (194,201,199,187,222,174),(245,161,278,159,301,165),
    (313,166,313,175,301,180),(278,184,256,180,240,193),
    (223,205,215,218,208,231),(222,245,214,268,199,290),
    (212,307,237,305,260,307),(284,309,307,317,308,330),
    (308,342,284,342,263,344),(235,349,213,354,189,357),
    (149,361,128,388,105,415),(90,433,67,433,56,420),
)
UPRIGHT = (
    (315,167),
    (325,162,332,171,334,189),(335,220,340,252,345,275),
    (349,291,352,298,363,307),(385,317,403,338,422,356),
    (447,380,453,405,451,428),(450,458,440,474,416,480),
    (393,487,368,476,353,457),(329,447,305,429,285,415),
    (266,405,250,390,255,375),(259,360,275,355,289,363),
    (297,351,301,343,303,330),(305,310,305,290,302,269),
    (300,245,297,223,299,205),(299,187,299,172,315,167),
)
LEFT_FOLDS = [
    ((85,231),(102,230,108,251,98,264),(94,270,88,271,82,269)),
    ((114,224),(134,224,143,249,134,265),(129,275,120,279,111,275)),
    ((151,226),(173,225,185,247,175,264),(170,274,158,281,147,277)),
    ((192,296),(179,288,163,291,151,300)),
]
RIGHT_FOLDS = [
    ((316,322),(311,343,307,363,309,382),(311,397,322,401,327,389)),
    ((352,320),(338,343,330,373,329,395),(329,414,348,420,359,408)),
    ((386,344),(368,364,362,395,364,415),(367,432,383,436,395,424)),
    ((416,368),(401,384,397,407,399,428),(402,441,412,448,425,436)),
    ((268,373),(285,362,299,377,308,390),(323,408,331,423,350,435)),
]
SCALE = 1.45
OFFSET = np.array([43, 21])
SIZE = 800


def curve_points(path):
    samples = [np.array(path[0], dtype=float)]
    start = samples[0]
    for segment in path[1:]:
        control1, control2, end = np.array(segment).reshape(3, 2)
        for t in np.linspace(0, 1, 25)[1:]:
            u = 1-t
            samples.append(u**3*start+3*u*u*t*control1+3*u*t*t*control2+t**3*end)
        start = end
    return np.rint(np.array(samples)*SCALE+OFFSET).astype(np.int32)


def paint(frame, outline, creases, color):
    mask = np.zeros((SIZE,SIZE), np.uint8)
    cv2.fillPoly(mask, [curve_points(outline)], 1)
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    # Round the silhouette into a convex hand with shallow creases.
    dome = 33*np.sqrt(1-np.exp(-distance/25))
    fold = np.zeros_like(distance)
    for path in creases:
        cv2.polylines(fold, [curve_points(path)], False, 1, 3, cv2.LINE_AA)
    crease_volume = cv2.GaussianBlur(fold, (0,0), 3.6)
    depth = np.where(mask, dome-19*crease_volume, -1000).astype(np.float32)
    surface(frame, depth, color, glossy=True)
    frame[:] = (frame*(1-.27*crease_volume[:,:,None]*mask[:,:,None])).astype(np.uint8)


def render(background, colors, size, padding):
    frame = np.full((SIZE,SIZE,3), background, np.uint8)
    paint(frame, CURVED, LEFT_FOLDS, colors[0])
    paint(frame, UPRIGHT, RIGHT_FOLDS, colors[1])
    y,x = np.where(np.any(frame!=background,axis=2))
    art = Image.fromarray(frame[y.min():y.max()+1,x.min():x.max()+1])
    art.thumbnail((size-2*padding,size-2*padding), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (size,size), background)
    canvas.paste(art, ((size-art.width)//2,(size-art.height)//2))
    return canvas
