const tips = [4, 8, 12, 16, 20];
const distance = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);

// Summarise hand shape and position in three successive phases. Coordinates
// are relative to the nose or wrist so the camera framing may vary.
export function motionFeatures(sequence, reflect = false) {
  const frames = sequence.map(([nose, hands]) => {
    const direction = reflect ? -1 : 1;
    const sorted = [...hands].sort((a,b) => direction*(a[0][0]-b[0][0]));
    const row = [sorted.length];
    for (let index=0; index<2; index++) {
      const hand=sorted[index];
      if (!hand) {
        row.push(...Array(21).fill(0));
        continue;
      }
      const wrist=hand[0];
      const scale=Math.max(0.035, distance(wrist,hand[9]), distance(hand[5],hand[17]));
      row.push(direction*(wrist[0]-nose[0])/scale,(wrist[1]-nose[1])/scale);
      for (const k of tips) {
        row.push(direction*(hand[k][0]-wrist[0])/scale,(hand[k][1]-wrist[1])/scale,distance(hand[k],hand[k-3])/scale);
      }
      for(const k of tips.slice(1)) row.push(distance(hand[4],hand[k])/scale);
    }
    return row;
  });
  const result=[];
  for(let phase=0;phase<3;phase++) {
    const start=Math.floor(phase*frames.length/3);
    const end=Math.max(start+1,Math.floor((phase+1)*frames.length/3));
    for(let col=0;col<frames[0].length;col++) {
      const values=frames.slice(start,end).map(row=>row[col]).sort((a,b)=>a-b);
      result.push(values[Math.floor(values.length/2)]);
    }
  }
  return result;
}
export function classifyMotion(sequence, model) {
  return rankForest([motionFeatures(sequence, false), motionFeatures(sequence, true)], model);
}
export function rankForest(featureSets, model) {
  const scores = new Array(model.words.length).fill(0);
  for (const features of featureSets) {
    for (const tree of model.trees) {
      let node=tree[0];
      while (node.length===4) node=tree[features[node[0]]<=node[1] ? node[2] : node[3]];
      for (let i=0;i<scores.length;i++) scores[i]+=node[i];
    }
  }
  return model.words.map((word,i)=>({word,score:scores[i]/(featureSets.length*255*model.trees.length)})).sort((a,b)=>b.score-a.score);
}
