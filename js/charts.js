// Hand-drawn SVG charts: the night timeline and the trend across nights.
import { timelineBins, TIERS } from "./analysis.js";
import { clock, dayLabel, duration, pct } from "./format.js";

const NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
}

// Column with a rounded top and a square baseline.
function columnPath(x, y, w, base) {
  const r = Math.min(4, w / 2, base - y);
  if (base - y < 0.5) return "";
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

// Shows a tooltip for the hovered or tapped column; a tap elsewhere hides it.
function attachTooltip(wrap, svg, targets, onPick) {
  const tip = document.createElement(onPick ? "button" : "div");
  tip.className = "chart-tip";
  tip.hidden = true;
  wrap.appendChild(tip);
  let active = null;
  if (onPick) tip.addEventListener("click", () => active && onPick(active.night));
  const show = (t) => {
    if (active) active.mark?.classList.remove("is-active");
    active = t;
    t.mark?.classList.add("is-active");
    tip.innerHTML = t.html;
    tip.hidden = false;
    const box = wrap.getBoundingClientRect();
    const svgBox = svg.getBoundingClientRect();
    const cx = svgBox.left - box.left + (t.cx / svg.viewBox.baseVal.width) * svgBox.width;
    const left = Math.max(0, Math.min(box.width - tip.offsetWidth, cx - tip.offsetWidth / 2));
    tip.style.left = `${left}px`;
  };
  const hide = () => {
    active?.mark?.classList.remove("is-active");
    active = null;
    tip.hidden = true;
  };
  const pick = (e) => {
    const svgBox = svg.getBoundingClientRect();
    const x = ((e.clientX - svgBox.left) / svgBox.width) * svg.viewBox.baseVal.width;
    return targets.find((t) => x >= t.x0 && x < t.x1);
  };
  svg.addEventListener("pointermove", (e) => {
    const t = pick(e);
    if (t) show(t);
  });
  svg.addEventListener("pointerdown", (e) => {
    const t = pick(e);
    if (t) show(t);
  });
  svg.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && hide());
  document.addEventListener("pointerdown", (e) => !wrap.contains(e.target) && hide());
}

// Snoring across one night, in bins of 2, 5 or 10 minutes, coloured by the loudest snoring.
export function timelineChart(wrap, night, { compact = false } = {}) {
  wrap.textContent = "";
  const total = Math.max(1, Math.ceil(((night.end || night.lastBeat) - night.start) / 60000));
  const binMin = total <= 120 ? 2 : total <= 360 ? 5 : 10;
  const bins = timelineBins(night, binMin);
  const W = Math.max(280, wrap.clientWidth || 340);
  const H = compact ? 56 : 168;
  const pad = compact ? { l: 0, r: 0, t: 4, b: 0 } : { l: 40, r: 6, t: 10, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const base = pad.t + ih;
  const slot = iw / bins.length;
  const gap = slot > 4 ? 2 : 1;
  const bw = Math.min(24, slot - gap);
  const y = (share) => base - share * ih;

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img" });
  svg.setAttribute("aria-label", `Snoring timeline, ${clock(night.start)} to ${clock(night.end || night.lastBeat)}`);

  if (!compact) {
    for (const v of [0, 0.5, 1]) {
      el("line", { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, svg);
      const t = el("text", { x: pad.l - 6, y: y(v) + 4, "text-anchor": "end", class: "tick" }, svg);
      t.textContent = `${v * 100}%`;
    }
  } else {
    el("line", { x1: 0, x2: W, y1: base, y2: base, class: "axis" }, svg);
  }

  // Stretches the microphone was not running.
  for (const b of bins) {
    if (b.recorded >= b.len / 2) continue;
    el("rect", { x: pad.l + slot * bins.indexOf(b), y: pad.t, width: slot, height: ih, class: "gap-band" }, svg);
  }

  const targets = [];
  bins.forEach((b, i) => {
    const x = pad.l + slot * i + (slot - bw) / 2;
    const share = b.snoring / b.len;
    const mark = share > 0 ? el("path", { d: columnPath(x, y(share), bw, base), class: `col tier-${b.tier}` }, svg) : null;
    const from = night.start + b.start * 60000;
    const to = from + b.len * 60000;
    const tier = TIERS.find((t) => t.id === b.tier);
    const state = b.recorded < b.len / 2 ? "Not recorded" : b.snoring ? `${b.snoring} of ${b.len} min snoring · ${tier.name}` : "No snoring";
    targets.push({ x0: pad.l + slot * i, x1: pad.l + slot * (i + 1), cx: x + bw / 2, mark, html: `<strong>${clock(from)}–${clock(to)}</strong><span>${state}</span>` });
  });

  if (!compact) {
    // Hour ticks in clock time ("23", or "11 PM" on 12-hour phones), spaced so they don't touch.
    const hour = new Intl.DateTimeFormat([], { hour: "numeric" });
    const widest = hour.format(new Date(2026, 0, 1, 22)).length * 7 + 16;
    const step = Math.max(1, Math.ceil(widest / ((iw / total) * 60)));
    const firstHour = Math.ceil(night.start / 3600000) * 3600000;
    for (let h = firstHour, k = 0; h <= night.start + total * 60000; h += 3600000, k++) {
      if (k % step) continue;
      const x = pad.l + ((h - night.start) / 60000 / total) * iw;
      if (x < pad.l + 8 || x > W - pad.r - 14) continue;
      const t = el("text", { x, y: H - 6, "text-anchor": "middle", class: "tick" }, svg);
      t.textContent = hour.format(h);
    }
  }

  wrap.appendChild(svg);
  if (!compact) attachTooltip(wrap, svg, targets);
}

// Share of each night spent snoring, oldest on the left.
export function trendChart(wrap, nights, onPick) {
  wrap.textContent = "";
  const list = nights.filter((n) => n.summary).slice(0, 30).reverse();
  const W = Math.max(280, wrap.clientWidth || 340);
  const H = 160;
  const pad = { l: 40, r: 6, t: 10, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const base = pad.t + ih;
  const maxPct = Math.max(0.2, ...list.map((n) => n.summary.snoringPct));
  const top = Math.ceil(maxPct * 10) / 10;
  const y = (v) => base - (v / top) * ih;
  const slot = iw / Math.max(list.length, 7);
  const bw = Math.min(24, slot - 2);

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Share of each night spent snoring" });
  for (const v of [0, top / 2, top]) {
    el("line", { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, svg);
    const t = el("text", { x: pad.l - 6, y: y(v) + 4, "text-anchor": "end", class: "tick" }, svg);
    t.textContent = pct(v);
  }
  const targets = [];
  const labelEvery = Math.ceil(list.length / 6);
  list.forEach((n, i) => {
    const x = pad.l + slot * i + (slot - bw) / 2;
    const s = n.summary;
    const mark = s.snoringPct > 0 ? el("path", { d: columnPath(x, y(s.snoringPct), bw, base), class: "col trend" }, svg) : null;
    targets.push({
      x0: pad.l + slot * i,
      x1: pad.l + slot * (i + 1),
      cx: x + bw / 2,
      mark,
      night: n,
      html: `<strong>${dayLabel(n.start)}</strong><span>${pct(s.snoringPct)} · ${duration(s.snoringMin)} snoring</span>${onPick ? "<em>Open night ›</em>" : ""}`,
    });
    if ((list.length - 1 - i) % labelEvery === 0) {
      const t = el("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle", class: "tick" }, svg);
      t.textContent = new Date(n.start).getDate();
    }
  });
  wrap.appendChild(svg);
  attachTooltip(wrap, svg, targets, onPick);
}
