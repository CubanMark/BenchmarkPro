/**
 * SVG-Grafiken v5: Wochenring, Heatmap, Körper-Grafik, Kraftkurve. Liefern HTML-Strings.
 */
import { addDays, mondayOf, todayKey, parseKey } from "./engine.js";

const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function fmtDate(key) {
  const d = parseKey(key);
  return `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`;
}
export { MON, WD };

export function ring(k, m, goal, size = 132) {
  const r = 52, c = 2 * Math.PI * r, cx = 66;
  const fk = Math.min(k, goal) / goal;
  const fm = Math.min(m, goal - Math.min(k, goal)) / goal;
  const gap = 0.012 * c;
  const seg = (frac, off, col) => frac > 0
    ? `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${Math.max(frac * c - gap, 0.1)} ${c}" stroke-dashoffset="${-off * c}" transform="rotate(-90 ${cx} ${cx})"/>`
    : "";
  const t = k + m;
  return `<svg class="ring" viewBox="0 0 132 132" width="${size}" height="${size}" role="img" aria-label="${t} von ${goal} Punkten">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--h0)" stroke-width="14"/>
    ${seg(fk, 0, "var(--accent)")}${seg(fm, fk, "var(--mob)")}
    <text x="66" y="66" text-anchor="middle" font-size="40" fill="var(--ink)" font-weight="700" font-family="var(--display)">${t}<tspan font-size="20" fill="var(--muted)">/${goal}</tspan></text>
    <text x="66" y="88" text-anchor="middle" font-size="13" fill="var(--muted)" letter-spacing="1">PUNKTE</text></svg>`;
}

/** Heatmap über `weeks` Wochen bis zur aktuellen Woche. selected: markierter Tag. */
export function heatmap(dayMap, weeks, { selected = null, interactive = false } = {}) {
  const today = todayKey();
  const start = addDays(mondayOf(today), -(weeks - 1) * 7);
  let cells = "", months = "", lastM = -1;
  for (let w = 0; w < weeks; w++) {
    const d0 = parseKey(addDays(start, w * 7));
    if (d0.getMonth() !== lastM) {
      months += `<span style="grid-column:${w + 1}">${MON[d0.getMonth()]}</span>`;
      lastM = d0.getMonth();
    }
    for (let i = 0; i < 7; i++) {
      const key = addDays(start, w * 7 + i);
      if (key > today) { cells += '<span class="c fut"></span>'; continue; }
      const o = dayMap.get(key);
      const l = o ? o.total : 0;
      const sp = o && o.sports.length ? " sp" : "";
      const label = `${fmtDate(key)}: ${l ? l + (l === 1 ? " Punkt" : " Punkte") : "kein Training"}${sp ? " · " + o.sports.map((a) => a.kind).join(", ") : ""}`;
      const tag = interactive ? "button" : "span";
      cells += `<${tag} class="c${sp}${key === selected ? " sel" : ""}${key === today ? " today" : ""}" data-l="${Math.min(l, 4)}" ${interactive ? `data-action="day" data-day="${key}"` : ""} title="${esc(label)}" aria-label="${esc(label)}"></${tag}>`;
    }
  }
  return `<div class="months" style="grid-template-columns:repeat(${weeks},1fr)">${months}</div><div class="hm" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div>`;
}

export const hmLegend = `<div class="hm-legend"><span>Punkte pro Tag</span><span class="row tight"><span class="sw" style="background:var(--h0)"></span><span class="sw" style="background:var(--h1)"></span><span class="sw" style="background:var(--h2)"></span><span class="sw" style="background:var(--h3)"></span><span class="sw" style="background:var(--h4)"></span></span><span>0 bis 4</span><span class="row tight"><span class="dot s"></span>Sport</span></div>`;

/** Körper-Grafik. frac(areaId) -> Anteil 0..1 vom Ziel. */
export function bodySvg(back, frac, names) {
  const col = (f) => f <= 0 ? "var(--h0)" : f < 0.34 ? "var(--h1)" : f < 0.67 ? "var(--h2)" : f < 1 ? "var(--h3)" : "var(--h4)";
  const r = (id, shape) => `<g fill="${col(frac(id))}"><title>${esc(names[id] || id)}</title>${shape}</g>`;
  const base = `<g class="body-base"><circle cx="60" cy="18" r="13"/><rect x="53" y="30" width="14" height="10" rx="4"/><rect x="40" y="130" width="40" height="18" rx="6"/><rect x="38" y="206" width="18" height="50" rx="8"/><rect x="64" y="206" width="18" height="50" rx="8"/></g>`;
  const arms = r("arme", '<rect x="18" y="58" width="14" height="70" rx="7"/><rect x="88" y="58" width="14" height="70" rx="7"/>');
  const shoulders = r("schultern", '<ellipse cx="27" cy="50" rx="12" ry="11"/><ellipse cx="93" cy="50" rx="12" ry="11"/>');
  const front = shoulders + arms
    + r("brust", '<rect x="36" y="42" width="23" height="28" rx="8"/><rect x="61" y="42" width="23" height="28" rx="8"/>')
    + r("rumpf", '<rect x="40" y="73" width="40" height="55" rx="9"/>')
    + r("beine", '<rect x="37" y="150" width="21" height="54" rx="10"/><rect x="62" y="150" width="21" height="54" rx="10"/>');
  const rear = shoulders + arms
    + r("ruecken", '<path d="M38 40h44l-4 50H42z"/>')
    + r("rumpf", '<rect x="44" y="93" width="32" height="32" rx="8"/>')
    + r("huefte", '<rect x="38" y="128" width="21" height="26" rx="10"/><rect x="61" y="128" width="21" height="26" rx="10"/>')
    + r("beine", '<rect x="37" y="157" width="21" height="47" rx="10"/><rect x="62" y="157" width="21" height="47" rx="10"/>');
  return `<svg viewBox="0 0 120 262" role="img" aria-label="${back ? "Rückseite" : "Vorderseite"}">${base}${back ? rear : front}</svg>`;
}

/**
 * Linienchart: points [{date, v}] chronologisch. Lücken > 40 Tage werden als Pause gezeigt.
 * Liefert { svg, geo } für den Hover-Tooltip.
 */
export function lineChart(points, unit) {
  const W = 340, H = 170, L = 36, R = 12, T = 16, B = 26;
  if (!points.length) return { svg: "", geo: null };
  const t = (p) => parseKey(p.date).getTime();
  let x0 = t(points[0]);
  const x1 = Math.max(parseKey(todayKey()).getTime(), t(points[points.length - 1]));
  if (x1 - x0 < 14 * 864e5) x0 = x1 - 14 * 864e5;
  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.08, 1);
  lo = Math.max(0, lo - pad); hi = hi + pad;
  const niceStep = (span) => { const raw = span / 4; const p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw); };
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X = (tt) => L + (tt - x0) / Math.max(1, x1 - x0) * (W - L - R);
  const Y = (v) => T + (hi - v) / Math.max(1e-9, hi - lo) * (H - T - B);

  let grid = "";
  for (let v = lo; v <= hi + 1e-9; v += step) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="var(--muted)">${String(Math.round(v * 10) / 10).replace(".", ",")}</text>`;
  }
  let mlab = "";
  const first = new Date(x0), last = new Date(x1);
  const monthsSpan = (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth();
  const every = monthsSpan > 8 ? 2 : 1;
  for (let d = new Date(first.getFullYear(), first.getMonth() + 1, 1), i = 0; d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1), i++) {
    if (i % every) continue;
    mlab += `<text x="${X(d.getTime())}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--muted)">${MON[d.getMonth()]}</text>`;
  }

  const segs = [[]];
  points.forEach((p, i) => {
    if (i && t(p) - t(points[i - 1]) > 40 * 864e5) segs.push([]);
    segs[segs.length - 1].push(p);
  });
  const paths = segs.map((sg) => {
    const d = sg.map((p, i) => `${i ? "L" : "M"}${X(t(p)).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
    const area = `${d} L${X(t(sg[sg.length - 1])).toFixed(1)} ${H - B} L${X(t(sg[0])).toFixed(1)} ${H - B} Z`;
    return `<path d="${area}" fill="var(--accent)" opacity=".10"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
  }).join("");
  let gapLbl = "";
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1][segs[i - 1].length - 1], b = segs[i][0];
    gapLbl += `<text x="${(X(t(a)) + X(t(b))) / 2}" y="${T + 10}" font-size="10" text-anchor="middle" fill="var(--faint)">Pause</text>`;
  }
  const lastP = points[points.length - 1];
  const dots = points.map((p) => `<circle cx="${X(t(p))}" cy="${Y(p.v)}" r="${p === lastP ? 5 : 3}" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`).join("");
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="lc" role="img" aria-label="Verlauf in ${esc(unit)}">${grid}${mlab}${paths}${gapLbl}${dots}<line class="xh" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" opacity="0"/><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/></svg>`;
  return { svg, geo: { W, H, pts: points.map((p) => ({ x: X(t(p)), y: Y(p.v), date: p.date, v: p.v })) } };
}
