import { rankForest } from "./motionfeatures.js";
export const twoHanded = new Set("ABDFGHKMNPQSTWXY");

export function describeHands(result) {
  const hands = result.landmarks;
  if (!hands?.length) return null;
  // Sort by wrist position so classifier input is independent of detector order.
  const pts = [...hands].sort((a, b) => a[0].x - b[0].x);
  const v = [];
  for (const h of pts) {
    const base = h[0],
      scale = Math.max(0.01, Math.hypot(h[9].x - base.x, h[9].y - base.y));
    for (const p of h) v.push((p.x - base.x) / scale, (p.y - base.y) / scale);
  }
  if (pts.length === 2) {
    const a = pts[0],
      b = pts[1],
      s = Math.max(0.02, Math.hypot(a[9].x - a[0].x, a[9].y - a[0].y));
    v.push((b[0].x - a[0].x) / s, (b[0].y - a[0].y) / s);
  }
  return v.map((n) => Math.round(n * 1000) / 1000);
}
function mirrorHands(vector) {
  const reflect = hand => hand.map((value, index) => index % 2 ? value : -value);
  const first = vector.slice(0, 42);
  if (vector.length === 42) return reflect(first);
  const second = vector.slice(42, 84);
  // The inter-wrist offset is normalized by the leftmost hand after reflection.
  const scale = Math.max(.01, Math.hypot(second[18], second[19]));
  return [...reflect(second), ...reflect(first), vector[84] / scale, -vector[85] / scale];
}

const fingertips = new Set([4, 8, 12, 16, 20]);
function fingerStraightness(hand, base) {
  const lengthBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
  const [knuckle, middle, joint, tip] = hand.slice(base, base + 4);
  const length = lengthBetween(knuckle, middle) + lengthBetween(middle, joint) + lengthBetween(joint, tip);
  return lengthBetween(knuckle, tip) / Math.max(.001, length);
}

// Distances in a shared coordinate system preserve contacts when one hand
// looks larger than the other. The training and camera paths use the same features.
export function overlapFeatures(hands) {
  if (hands?.length !== 2 || hands.some(hand => hand.length !== 21)) return null;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const scales = hands.map(hand => distance(hand[0], hand[9]));
  if (Math.min(...scales) <= .01) return null;
  const scale = (scales[0] + scales[1]) / 2;
  const features = [distance(hands[0][0], hands[1][0]) / scale, scales[0] / scale];
  const palm = [0, 5, 9, 13, 17];
  for (let index = 0; index < 2; index++) {
    const hand = hands[index], other = hands[1 - index];
    for (const tip of fingertips) {
      const base = tip === 4 ? 2 : tip - 3;
      const curled = distance(hand[tip], hand[base]) / scales[index];
      features.push(curled, distance(hand[0], hand[tip]) / scales[index]);
      for (const anchor of palm) features.push(distance(hand[tip], other[anchor]) / scale);
    }
  }
  for (const tip of fingertips) {
    for (const otherTip of fingertips) features.push(distance(hands[0][tip], hands[1][otherTip]) / scale);
  }
  for (const hand of hands) {
    for (const base of [5, 9, 13, 17]) {
      features.push(fingerStraightness(hand, base));
    }
  }
  for (let index = 0; index < 2; index++) {
    const hand = hands[index], other = hands[1 - index];
    const px = other[9].x - other[0].x, py = other[9].y - other[0].y;
    const tx = hand[12].x - hand[0].x, ty = hand[12].y - hand[0].y;
    features.push(
      (px * tx + py * ty) / Math.max(.001, scales[1 - index] * Math.hypot(tx, ty)),
      distance(other[8], other[20]) / scales[1 - index],
      distance(hand[8], hand[12]) / scale,
    );
  }
  return features;
}

export function recognizesOverlap(hands, expected, model) {
  if (!model) return false;
  const forward = overlapFeatures(hands);
  if (!forward || forward.length !== model.featureCount) return false;
  // N uses two contacting fingers. Two straight ring fingers indicate a
  // conflicting pose such as M, even if the forest finds a similar overlap.
  if (expected === "N" && hands.every(hand => fingerStraightness(hand, 13) > .93)) return false;
  const [best, second] = rankForest([forward, overlapFeatures([hands[1], hands[0]])], model);
  const margin = best.score - second.score;
  return best.word === expected && (
    (best.score >= .66 && margin >= .20) ||
    (expected === "Y" && best.score >= .54 && margin >= .33)
  );
}

export function alphabetFeatures(hands, reflected = false, angle = 0) {
  if (!hands?.length || hands.length > 2 || hands.some(hand => hand.length !== 21)) return null;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const oriented = hands.map(hand => hand.map(({ x, y, z }) => {
    const px = reflected ? 1 - x : x;
    return { x: px * cosine - y * sine, y: px * sine + y * cosine, z };
  })).sort((a, b) => a[0].x - b[0].x);
  const features = describeHands({ landmarks: oriented });
  for (const hand of oriented) {
    const wrist = hand[0];
    const scale = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y);
    if (scale <= .01) return null;
    for (const tip of fingertips) features.push(((hand[tip].z ?? 0) - (wrist.z ?? 0)) / scale);
    for (const base of [5, 9, 13, 17]) features.push(fingerStraightness(hand, base));
  }
  return oriented.length === 2 ? [...features, ...overlapFeatures(oriented)] : features;
}

export function classifyAlphabet(hands, models) {
  const model = models?.[hands?.length - 1];
  if (!model) return null;
  const front = alphabetFeatures(hands);
  const reflected = alphabetFeatures(hands, true);
  if (front?.length !== model.featureCount || reflected?.length !== model.featureCount) return null;
  const [best, second] = rankForest([front, reflected], model);
  const [confidence, separation] = hands.length === 1 ? [.80, .28] : [.65, .22];
  // A has its own contact test. N and Y have a separate overlap verifier.
  if ("ANY".includes(best.word) || best.score < confidence || best.score - second.score < separation) return null;
  return best.word;
}

// Distances between the fingertips of both hands distinguish shapes
// with similar fingers but different contacts and spacing.
function fingertipDistances(v) {
  const distances = [];
  if (v.length !== 86) return distances;
  for (const i of fingertips) {
    for (const j of fingertips) {
      distances.push(Math.hypot(v[2*i]-v[42+2*j]-v[84], v[2*i+1]-v[43+2*j]-v[85]));
    }
  }
  return distances;
}

export function touchesA(result) {
  if (result.landmarks?.length !== 2) return false;
  const [left, right] = [...result.landmarks].sort((a,b)=>a[0].x-b[0].x);
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const scale = (distance(left[0],left[9])+distance(right[0],right[9]))/2;
  if (scale <= .01) return false;
  const indexHeight = (left[8].y+right[8].y)/2;
  const thumbHeight = (left[4].y+right[4].y)/2;
  // Validate the triangle relative to the wrists. Its position in the
  // frame and the position of the signer's head are irrelevant.
  return distance(left[8],right[8])/scale <= .20 &&
    distance(left[4],right[4])/scale <= .52 &&
    (thumbHeight-indexHeight)/scale >= .35 &&
    (right[0].x-left[0].x)/scale >= 1.1 &&
    (left[8].x-left[0].x)/scale >= .3 &&
    (right[0].x-right[8].x)/scale >= .3 &&
    [left,right].every(hand => (hand[5].y-hand[8].y)/scale >= .19);
}

const descriptors = new WeakMap();
function poseError(query, reference, queryTips, referenceTips) {
  const contacts = queryTips.reduce((sum,d,i) => sum + Math.min(4,(d-referenceTips[i]) ** 2), 0);
  return .7 * contacts + query.reduce((sum, value, index) => {
    const weight = index >= 84 ? .45 : fingertips.has(Math.floor((index % 42) / 2)) ? 1.8 : 1;
    return sum + weight * (value - reference[index]) ** 2;
  }, 0);
}

export function matchLetter(vector, bank, expected) {
  if (!vector) return null;
  const reflected = mirrorHands(vector);
  const tips = fingertipDistances(vector);
  const reflectedTips = fingertipDistances(reflected);
  let samples = descriptors.get(bank);
  if (!samples) {
    samples = bank.map(sample => ({...sample, tips:fingertipDistances(sample.v)}));
    descriptors.set(bank,samples);
  }
  const distances = new Map();
  for (const sample of samples) {
    if (sample.v.length !== vector.length) continue;
    const distance = Math.sqrt(Math.min(poseError(vector, sample.v, tips, sample.tips), poseError(reflected, sample.v, reflectedTips, sample.tips)) / vector.length);
    if (distance < (distances.get(sample.letter) ?? Infinity)) distances.set(sample.letter, distance);
  }
  const [best, second] = [...distances].sort((a, b) => a[1] - b[1]);
  if (best?.[0] === expected && (expected === "N" || expected === "Y") && vector.length === 86) {
    // In a guided exercise the target must still rank ahead of every other letter.
    if (second && best[1] <= .38 && best[1] < .94 * second[1]) return best[0];
  }
  if (!second || best[1] > .27 || best[1] >= (vector.length === 86 ? .73 : .7) * second[1]) return null;
  return best[0];
}
