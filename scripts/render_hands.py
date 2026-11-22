"""Render the licensed BISINDO landmark clips as local H.264 demonstrations.
Requires numpy, opencv-python, requests and ffmpeg (set FFMPEG to its executable).
"""
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "gerak"
SOURCE = "https://huggingface.co/datasets/sigawari/wl-bisindo-10class/resolve/main/preprocess/landmarks_extracted"
WIDTH, HEIGHT = 512, 384
WORDS = json.loads((ROOT / "public/kosakata-gerak.json").read_text()).keys()
FINGERS = [(1,2,3,4),(5,6,7,8),(9,10,11,12),(13,14,15,16),(17,18,19,20)]


def capsule(depth, a, b, r, end_radius):
    # Project the tapered rounded segment, retaining its front surface depth.
    margin = max(r,end_radius)+2
    x0,y0 = np.maximum(0,np.floor(np.minimum(a[:2],b[:2])-margin)).astype(int)
    x1,y1 = np.minimum([WIDTH,HEIGHT],np.ceil(np.maximum(a[:2],b[:2])+margin)).astype(int)
    if x1<=x0 or y1<=y0: return
    yy,xx=np.ogrid[y0:y1,x0:x1]
    dx,dy,dz=b-a
    t=np.clip(((xx-a[0])*dx+(yy-a[1])*dy)/max(1,dx*dx+dy*dy),0,1)
    rr=r+(end_radius-r)*t
    disk=rr**2-(xx-a[0]-dx*t)**2-(yy-a[1]-dy*t)**2
    front=a[2]+t*dz+np.sqrt(np.maximum(0,disk))
    dest=depth[y0:y1,x0:x1]
    np.maximum(dest,np.where(disk>=0,front,-1000),out=dest)


def surface(image,depth,color, *, glossy=False):
    mask=depth>-900
    if not mask.any():return
    # Smooth the depth only over the hand. Background depth would introduce
    # steep artificial ridges at finger edges and creases between knuckles.
    weight = mask.astype(np.float32)
    sigma = max(1.2, np.sqrt(mask.sum()) * .018)
    support = cv2.GaussianBlur(weight, (0,0), sigma)
    depths = cv2.GaussianBlur(np.where(mask,depth,0), (0,0), sigma)
    smooth = depths / np.maximum(support, .0001)
    if glossy:
        # A rounded outer envelope softens ridges where finger and palm volumes join.
        distance = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
        dome = 33*np.sqrt(1-np.exp(-distance/25))
        smooth = .54*smooth + .46*cv2.GaussianBlur(dome, (0,0), 2.2)
    gy,gx=np.gradient(smooth)
    norm=np.sqrt(gx*gx+gy*gy+1)
    light=np.clip((gx*.42+gy*.60+.65)/norm,0,1)
    spec=np.clip((gx*.22+gy*.35+.91)/norm,0,1)**18
    rgb=np.array(color)[None,None,:]*(.74+.31*light[:,:,None])+spec[:,:,None]*np.array([34,39,32])
    if glossy:
        # Broad reflection and a restrained secondary highlight on the curved surface.
        diffuse = np.clip((gx*.28+gy*.42+.84)/norm, 0, 1)
        reflection = np.clip((gx*.52+gy*.31+.79)/norm, 0, 1)**8
        rim = np.clip((-gx*.65+gy*.30+.62)/norm, 0, 1)**14
        rgb = np.asarray(color)[None,None,:]*(.69+.40*diffuse[:,:,None])
        rgb += reflection[:,:,None]*np.array([48,57,46]) + rim[:,:,None]*np.array([18,34,27])
    coverage=cv2.GaussianBlur(weight,(3,3),.62)[:,:,None]
    image[:]=np.clip(image*(1-coverage)+rgb*coverage,0,255)


def palm_dome(depth, p, thickness, *, fuller=False):
    # Orient the rounded pad from wrist to knuckles, including edge-on poses.
    knuckles=p[[5,9,13,17]].mean(axis=0)
    long=(knuckles-p[0])*(.63 if fuller else .59)
    across=(p[5]-p[17])*(.67 if fuller else .55)
    normal=np.cross(long,across)
    normal*=thickness/max(1e-6,np.linalg.norm(normal))
    axes=np.stack((long,across,normal),axis=1)
    covariance=axes@axes.T
    xy=covariance[:2,:2]+np.eye(2)*.01
    center=.47*p[0]+.53*knuckles
    radii=np.sqrt(np.diag(xy))
    x0,y0=np.maximum(0,np.floor(center[:2]-radii)).astype(int)
    x1,y1=np.minimum([WIDTH,HEIGHT],np.ceil(center[:2]+radii+1)).astype(int)
    if x1<=x0 or y1<=y0:return
    dy,dx=np.ogrid[y0:y1,x0:x1]
    dx=dx-center[0]
    dy=dy-center[1]
    inv=np.linalg.inv(xy)
    tilt=covariance[2,:2]@inv
    height=np.sqrt(max(0,covariance[2,2]-tilt@covariance[:2,2]))
    inside=1-inv[0,0]*dx**2-2*inv[1,0]*dx*dy-inv[1,1]*dy**2
    front=center[2]+tilt[0]*dx+tilt[1]*dy+height*np.sqrt(np.maximum(0,inside))
    dest=depth[y0:y1,x0:x1]
    np.maximum(dest,np.where(inside>=0,front,-1000),out=dest)


def hand_mesh(image,hand,color=(24,154,112), *, hand_width=None, tip_roundness=.69, separate_folds=False, sculpted=False):
    p=hand
    palm=np.linalg.norm(p[9]-p[0])
    width=np.clip(palm*.17,3,32) if hand_width is None else hand_width
    wrist=p[0]
    depth=np.full((HEIGHT,WIDTH),-1000,np.float32)
    # A continuous fan forms the palm and the fleshy base of the thumb.
    for j,k in [(5,9),(9,13),(13,17)]:
        for t in np.linspace(0,1,5):
            top=p[j]*(1-t)+p[k]*t
            base=wrist+(top-p[9])*(.43 if sculpted else .62)
            capsule(depth,base,top,width*1.24,width*.99)
    palm_dome(depth,p,width*(2.65 if sculpted else 1.9),fuller=sculpted)
    capsule(depth,wrist,p[1],width*1.35,width*1.18)
    folded = []
    for i,chain in enumerate(FINGERS):
        fingertip=width*[.94,.85,.89,.80,.65][i]
        points = p[list(chain), :2]
        length = np.linalg.norm(np.diff(points, axis=0), axis=1).sum()
        curled = i >= 2 and np.linalg.norm(points[-1]-points[0]) < .8*length
        finger_depth = depth
        if separate_folds and curled:
            finger_depth = np.full_like(depth, -1000)
            folded.append(finger_depth)
        for n,(j,k) in enumerate(zip(chain,chain[1:])):
            capsule(finger_depth,p[j],p[k],fingertip*[1.18,1.0,.83][n],fingertip*[1.0,.83,tip_roundness][n])
    surface(image,depth,color,glossy=sculpted)
    # A soft contact shadow makes folded fingers legible over the palm.
    occupied = depth > -900
    for finger_depth in reversed(folded):
        mask = finger_depth > -900
        dilated = cv2.dilate(mask.astype(np.float32), np.ones((5,5), np.uint8))
        shadow = cv2.GaussianBlur(dilated, (0,0), 2) * occupied * ~mask
        strength = .19 if sculpted else .32
        image[:] = (image*(1-strength*shadow[:,:,None])).astype(np.uint8)
        surface(image,finger_depth,color,glossy=sculpted)
        occupied |= mask



def render(word,signer):
    key=word.replace(" ","_")
    response=requests.get(f"{SOURCE}/{key}/signer{signer}_sample1.json",timeout=90)
    response.raise_for_status()
    data=response.json()
    frames=[]
    for frame in data["frames"]:
        lm=frame["landmarks"]
        def point(node):
            return np.array([node["x"]*640,node["y"]*480,-node["z"]*640])
        hands={}
        for side in ("left","right"):
            raw=lm.get(side+"_hand") or {}
            if len(raw)!=21:continue
            pts=np.array([point(raw[str(k)]) for k in range(21)])
            if np.ptp(pts[:,:2],axis=0).max()<4:continue
            hands[side]=pts
        if hands:
            frames.append(hands)
    assert frames
    # Keep left and right tracks separate when one hand enters or leaves.
    filtered=[]
    for i,hands in enumerate(frames):
        pose={}
        for side,pts in hands.items():
            before=frames[max(0,i-1)].get(side,pts)
            after=frames[min(len(frames)-1,i+1)].get(side,pts)
            pose[side]=.2*before+.6*pts+.2*after
        filtered.append(pose)
    frames=[]
    for i,hands in enumerate(filtered):
        following=filtered[min(i+1,len(filtered)-1)]
        frames.append(list(hands.values()))
        frames.append([(pts+following.get(side,pts))*.5 for side,pts in hands.items()])

    # Track a smoothed centre so the fingers occupy the stage as the arm moves.
    bounds=[np.concatenate([pts[:,:2] for pts in hs]) for hs in frames]
    centres=np.array([(q.min(0)+q.max(0))/2 for q in bounds])
    padded=np.pad(centres,((3,3),(0,0)),mode="edge")
    centres=np.array([np.mean(padded[j:j+7],axis=0) for j in range(len(frames))])
    radii=np.max([np.max(np.abs(q-centres[i]),axis=0) for i,q in enumerate(bounds)],axis=0)
    scale=min((WIDTH-70)/max(38,2*radii[0]),(HEIGHT-60)/max(38,2*radii[1]),12)
    def project(p):
        q=p*scale
        q[...,:2]+=[WIDTH/2-center[0]*scale,HEIGHT/2-center[1]*scale]
        return q
    bg=np.full((HEIGHT,WIDTH,3),(255,246,222),dtype=np.uint8)
    cmd=[os.environ.get("FFMPEG","ffmpeg"),"-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{WIDTH}x{HEIGHT}","-r",str(2*data["metadata"]["fps"]),"-i","-","-an","-c:v","libx264","-threads","1","-preset","fast","-crf","19","-pix_fmt","yuv420p","-movflags","+faststart",str(OUT/f"{key}-{signer}.mp4")]
    with subprocess.Popen(cmd,stdin=subprocess.PIPE) as proc:
        for frame_index,hands in enumerate(frames):
            center=centres[frame_index]
            image=bg.copy()
            for pts in hands:
                hand_mesh(image,project(pts))
            proc.stdin.write(image.tobytes())
        proc.stdin.close()
        if proc.wait():raise RuntimeError(cmd[-1])
    return key,signer


if __name__=="__main__":
    OUT.mkdir(exist_ok=True)
    with ThreadPoolExecutor(4) as pool:
        for result in pool.map(lambda job:render(*job),[(w,s) for w in WORDS for s in (1,2,3)]):
            print(*result,flush=True)
