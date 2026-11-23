// Small, dependency-free charts for the learner and companion dashboards.
// Every chart is single-series (one hue); identity never depends on colour alone,
// values show on hover or focus, and a hidden table carries the same numbers for screen readers.
import React from "react";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const dayName = offset => (offset === 0 ? "Hari ini" : DAYS[new Date(Date.now() + offset * 86400000).getDay()]);

export function Stat({ value, unit, label, note }) {
  return (
    <div className="stat">
      <span className="stat-v">{value}{unit && <small>{unit}</small>}</span>
      <span className="stat-l">{label}</span>
      {note && <span className="stat-n">{note}</span>}
    </div>
  );
}

// Seven daily values, oldest first. A dashed line marks the daily target when there is one.
export function Bars({ values, target, unit = "menit", label, height = 150 }) {
  const max = Math.max(1, target || 0, ...values);
  const peak = values.indexOf(Math.max(...values));
  return (
    <figure className="bars" aria-label={label}>
      <div className="bars-plot" style={{ height }}>
        {target > 0 && (
          <div className="bars-target" style={{ bottom: (target / max) * 100 + "%" }} aria-hidden="true">
            <span>Target {target} {unit}</span>
          </div>
        )}
        {values.map((v, i) => (
          <div key={i} className="bars-col" tabIndex={0} data-tip={`${dayName(i - 6)}: ${v} ${unit}`} aria-label={`${dayName(i - 6)}: ${v} ${unit}`}>
            <span className={"bars-bar" + (i === 6 ? " now" : "") + (v ? "" : " empty")} style={{ height: v ? `max(4px, ${(v / max) * 100}%)` : 2 }}>
              {(i === 6 || (i === peak && v > 0)) && <span className="bars-val">{v}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="bars-x" aria-hidden="true">{values.map((_, i) => <span key={i}>{dayName(i - 6)}</span>)}</div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{values.map((v, i) => <tr key={i}><th>{dayName(i - 6)}</th><td>{v} {unit}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

// Tiny trend line for a table row. Seven values, oldest first.
export function Sparkline({ values, label, w = 92, h = 28 }) {
  const max = Math.max(1, ...values);
  const x = i => 3 + (i * (w - 6)) / (values.length - 1);
  const y = v => h - 3 - (v / max) * (h - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <line x1="3" x2={w - 3} y1={h - 3} y2={h - 3} className="spark-base" />
      <path d={d} className="spark-line" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="3.5" className="spark-dot" />
    </svg>
  );
}

export function Meter({ value, max, label, locked }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="meter" data-tip={`${label}: ${value} dari ${max}`}>
      <div className="row between small"><strong>{label}</strong><span className="muted">{locked ? "Terkunci" : `${value}/${max}`}</span></div>
      <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} style={{ height: 10 }}>
        <span style={{ width: pct + "%", opacity: locked ? 0.35 : 1 }} />
      </div>
    </div>
  );
}

// A–Z grid shaded by how many learners mastered each letter (one green, light to dark).
export function Heat({ letters, total, label }) {
  return (
    <figure className="heat-wrap" aria-label={label}>
      <div className="heat">
        {letters.map(l => {
          const p = total ? l.mastered / total : 0;
          return (
            <div key={l.letter} className="heat-cell" tabIndex={0}
              data-tip={`${l.letter}: ${l.mastered} dari ${total} pelajar menguasai${l.skips ? `, dilewati ${l.skips} kali` : ""}`}
              style={{ background: `rgba(28, 124, 84, ${(0.08 + p * 0.92).toFixed(2)})`, color: p > 0.5 ? "#fff" : "var(--teks)" }}>
              <strong>{l.letter}</strong><small>{l.mastered}/{total}</small>
            </div>
          );
        })}
      </div>
      <div className="heat-key small muted" aria-hidden="true">
        <span>0 pelajar</span><span className="heat-ramp" /><span>semua pelajar</span>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{letters.map(l => <tr key={l.letter}><th>{l.letter}</th><td>{l.mastered} dari {total} menguasai</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
