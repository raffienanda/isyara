import { useLayoutEffect } from "react";
import { gsap } from "gsap";

export { gsap };

// Respect both the OS setting and the in-app "Kurangi animasi" toggle.
export const reduced = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("kurangi-gerak");

const AUTO = "[data-a], .display, .btn-lg, .tile-link, .card, .card-tua, .card-mint, .card-peach, .choice, .chip, .letter, .word-row";

/* Every page fades and rises in, element by element. Nested matches are skipped so a
   card animates as one piece, and elements with their own inline transform are left alone. */
export function usePageIn(ref, key) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced()) return;
    let ctx, observer;
    // Pages that fetch data first show a loading state; wait until the real content is in.
    const play = () => {
      if (root.querySelector("[data-loading]")) return false;
      if (root.querySelector("[data-manual]")) return true;
      ctx = gsap.context(() => {
        const all = [...root.querySelectorAll(AUTO)];
        const els = all.filter(el => !el.style.transform && !all.some(other => other !== el && other.contains(el)));
        gsap.from(els, { y: 26, opacity: 0, duration: 0.7, ease: "power3.out", stagger: { amount: Math.min(0.7, els.length * 0.05) }, clearProps: "transform,opacity" });
        root.querySelectorAll("[data-count]").forEach(el => countUp(el, Number(el.dataset.count)));
      }, root);
      return true;
    };
    if (!play()) {
      observer = new MutationObserver(() => { if (play()) observer.disconnect(); });
      observer.observe(root, { childList: true, subtree: true });
    }
    return () => { observer?.disconnect(); ctx?.revert(); };
  }, [ref, key]);
}

export function countUp(el, to, duration = 1.2) {
  if (!el || !Number.isFinite(to)) return;
  if (reduced()) { el.textContent = String(to); return; }
  const state = { v: 0 };
  gsap.to(state, { v: to, duration, ease: "power2.out", onUpdate: () => { el.textContent = String(Math.round(state.v)); } });
}

const PAPER = ["#FFD66B", "#F28C38", "#FFF6E5", "#70D6A8", "#70FFD2", "#1F6B4A"];

function piece(color, size) {
  const el = document.createElement("span");
  const round = Math.random() < 0.5;
  Object.assign(el.style, {
    position: "fixed", left: "0", top: "0", zIndex: "60", pointerEvents: "none",
    width: size + "px", height: (round ? size : size * 0.45) + "px",
    borderRadius: round ? "50%" : "3px", background: color,
    boxShadow: "0 2px 4px rgba(21,56,42,.25)",
  });
  document.body.appendChild(el);
  return el;
}

/* Paper confetti bursting out of an element, used when a letter is matched. */
export function burst(target, count = 22) {
  if (!target || reduced()) return;
  const r = target.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const el = piece(PAPER[i % PAPER.length], 8 + Math.random() * 10);
    const angle = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 170;
    gsap.set(el, { x: cx, y: cy, rotate: Math.random() * 180, scale: 0.4 });
    gsap.timeline({ onComplete: () => el.remove() })
      .to(el, { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, rotate: "+=" + (180 + Math.random() * 360), scale: 1, duration: 0.6, ease: "power3.out" })
      .to(el, { y: "+=" + (60 + Math.random() * 80), opacity: 0, duration: 0.6, ease: "power1.in" }, ">-0.1");
  }
}

/* Confetti falling over the whole screen, used on the level complete screen. */
export function rain(count = 70) {
  if (reduced()) return () => {};
  const els = [];
  for (let i = 0; i < count; i++) {
    const el = piece(PAPER[i % PAPER.length], 8 + Math.random() * 12);
    els.push(el);
    const x = Math.random() * innerWidth;
    gsap.set(el, { x, y: -40 - Math.random() * innerHeight * 0.6, rotate: Math.random() * 360 });
    gsap.to(el, { y: innerHeight + 60, x: x + (Math.random() - 0.5) * 240, rotate: "+=" + (360 + Math.random() * 540), duration: 2.4 + Math.random() * 2.2, delay: Math.random() * 0.8, ease: "power1.in", onComplete: () => el.remove() });
  }
  return () => els.forEach(el => { gsap.killTweensOf(el); el.remove(); });
}

/* Re-run a small entrance when `key` changes, e.g. a new letter or a picked card. */
export function useSwap(ref, key, from = { x: 70, rotate: 10, opacity: 0, scale: 0.85 }) {
  useLayoutEffect(() => {
    if (!ref.current || reduced()) return;
    const tween = gsap.fromTo(ref.current, from, { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1, duration: 0.65, ease: "back.out(1.7)" });
    return () => tween.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/* Gentle idle motion for decorative hands. */
export function useFloat(ref, { y = 14, rotate = 4, duration = 3 } = {}) {
  useLayoutEffect(() => {
    if (!ref.current || reduced()) return;
    const tween = gsap.to(ref.current, { y: -y, rotate: "+=" + rotate, duration, ease: "sine.inOut", yoyo: true, repeat: -1 });
    return () => tween.kill();
  }, [ref, y, rotate, duration]);
}
