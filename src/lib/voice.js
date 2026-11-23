// Spoken feedback for hearing family members and teachers practising alongside a Deaf learner.
// Uses the browser's own speech engine, so nothing is sent anywhere.
import { getPrefs } from "../api";

// Indonesian letter names, so "C" is read as "ce" and not as an English "see".
const NAMES = {
  A: "a", B: "be", C: "ce", D: "de", E: "e", F: "ef", G: "ge", H: "ha", I: "i", J: "je", K: "ka", L: "el", M: "em",
  N: "en", O: "o", P: "pe", Q: "ki", R: "er", S: "es", T: "te", U: "u", V: "ve", W: "we", X: "eks", Y: "ye", Z: "zet",
};

const supported = typeof window !== "undefined" && "speechSynthesis" in window;
let voice = null;
function pickVoice() {
  const all = speechSynthesis.getVoices();
  const id = all.filter(v => /^id(-|_|$)/i.test(v.lang));
  voice = id.find(v => /google/i.test(v.name)) || id.find(v => v.localService) || id[0] || null;
}
if (supported) {
  pickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

export const canSpeak = () => supported;
export const voiceOn = () => supported && getPrefs().voice !== false;

function say(text, rate) {
  if (!voiceOn() || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = "id-ID";
  u.rate = rate;
  speechSynthesis.speak(u);
}

export const speakLetter = ch => say(NAMES[ch] || ch, 0.95);
export const speakWord = word => say(word.toLowerCase(), 0.85);
export const stopSpeaking = () => { if (supported) speechSynthesis.cancel(); };
