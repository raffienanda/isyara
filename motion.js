import { classifyMotion } from "./motionfeatures.js";
let loading;
export function loadMotionBank() {
  if (!loading) loading = fetch("./kosakata-gerak.json").then(r => {
    if (!r.ok) throw Error();
    return r.json();
  }).catch(error => { loading = null; throw error; });
  return loading;
}
export function describeMotion(sequence, mirror = false) {
  return Array.from({length:12}, (_,i) => {
    const [nose,hands] = sequence[Math.round(i*(sequence.length-1)/11)];
    const sign = mirror ? -1 : 1;
    const vectors = hands.map(points => {
      const [x,y] = points[0];
      const scale = Math.max(.035, Math.hypot(points[9][0]-x,points[9][1]-y));
      const data = [(x-nose[0])*sign*4,(y-nose[1])*4];
      for (const k of [4,8,12,16,20,5,17]) data.push((points[k][0]-x)*sign/scale,(points[k][1]-y)/scale);
      return data;
    }).sort((a,b)=>a[0]-b[0]);
    return vectors;
  });
}
function cost(a,b) {
  let sum=0;
  for(let i=0;i<a.length;i++) {
    if(a[i].length!==b[i].length) {sum+=1.25;continue;}
    let error=0;
    for(let j=0;j<a[i].length;j++) {
      const v=a[i][j], w=b[i][j];
      for(let k=0;k<v.length;k++) error+=Math.min(4,(v[k]-w[k])**2);
    }
    sum+=Math.sqrt(error/(a[i].length*16));
  }
  return sum/a.length;
}
const prepared=new WeakMap();
export function rankMotion(sequence,bank) {
  let references=prepared.get(bank);
  if(!references) {
    references=Object.entries(bank).map(([word,clips])=>[word,clips.map(seq=>describeMotion(seq))]);
    prepared.set(bank,references);
  }
  const forward=describeMotion(sequence), reflected=describeMotion(sequence,true);
  return references.map(([word,clips])=>({word, distance:Math.min(...clips.map(clip=>Math.min(cost(forward,clip),cost(reflected,clip))))})).sort((a,b)=>a.distance-b.distance);
}


let classifier;
export async function loadWordModels() {
  if (!classifier) {
    classifier = fetch("./model-kosakata.json").then(response => {
      if (!response.ok) throw new Error("Model kosakata gagal dimuat.");
      return response.json();
    }).catch(error => { classifier = null; throw error; });
  }
  const [bank,model] = await Promise.all([loadMotionBank(),classifier]);
  return {bank,model};
}

export function compareWord(sequence, {bank,model}) {
  const ranked = classifyMotion(sequence,model);
  const [first,second] = ranked;
  const [nearest] = rankMotion(sequence,bank);
  const agreed = first.word === nearest.word && nearest.distance <= 0.45;
  const clear = first.score >= 0.75 ||
    (agreed && first.score >= 0.45 && first.score-second.score >= 0.18);
  const candidates = ranked.filter(item => item.score >= 0.2 && first.score-item.score <= 0.25).slice(0,3);
  return {word:first.word, clear, candidates};
}
