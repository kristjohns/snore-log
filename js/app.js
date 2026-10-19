// Screens and interactions.
import { loadClassifier, Listener } from "./listener.js";
import { NightSession, newNight } from "./session.js";
import { NoiseFloor, SENSITIVITY, TIERS, factorEffects, summarize } from "./analysis.js";
import { timelineChart, trendChart } from "./charts.js";
import { clock, dayLabel, duration, megabytes, nightLabel, pct } from "./format.js";
import * as db from "./db.js";

const $ = (id) => document.getElementById(id);
const DEFAULT_TAGS = ["Alcohol", "Late meal", "Blocked nose", "Very tired", "Sleep medication", "Side sleeping", "Nasal strip", "Mouth tape", "Mouthguard"];
const SENSITIVITY_HINTS = {
  low: "Counts only clear snoring. Choose this if heavy breathing or other sounds get counted.",
  normal: "Works for most people. Changes apply from the next night.",
  high: "Also catches quiet snoring, but heavy breathing may be counted too.",
};

// localStorage can be unavailable (private mode); the app still works without it.
const prefs = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

const settings = { sensitivity: "normal", saveClips: true, keepClipsDays: 30, ...prefs.get("settings", {}) };
const saveSettings = () => prefs.set("settings", settings);
const tonightTags = new Set(prefs.get("tonightTags", []));

let session = null; // the night being recorded
let currentNight = null; // the night shown in the report

function allTags(extra = []) {
  return [...new Set([...DEFAULT_TAGS, ...prefs.get("customTags", []), ...extra])];
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3500);
}

// Asks for a second tap before doing something destructive.
function confirmTap(button, label, confirmLabel, action) {
  button.textContent = label;
  button.classList.remove("is-confirming");
  button.onclick = async () => {
    if (!button.classList.contains("is-confirming")) {
      button.classList.add("is-confirming");
      button.textContent = confirmLabel;
      setTimeout(() => {
        button.classList.remove("is-confirming");
        button.textContent = label;
      }, 4000);
      return;
    }
    button.classList.remove("is-confirming");
    button.textContent = label;
    await action();
  };
}

/* Navigation */

function show(view) {
  for (const v of document.querySelectorAll(".view")) v.hidden = v.id !== `view-${view}`;
  const tab = $(`view-${view}`).dataset.tab;
  for (const b of document.querySelectorAll(".tabbar button")) {
    if (b.dataset.go === tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  window.scrollTo(0, 0);
}

const renderers = { tonight: renderTonight, history: renderHistory, settings: renderSettings };
for (const b of document.querySelectorAll(".tabbar button")) {
  b.addEventListener("click", () => {
    show(b.dataset.go);
    renderers[b.dataset.go]();
  });
}

/* Tags */

function renderChips(container, selected, onChange) {
  container.textContent = "";
  for (const tag of allTags([...selected])) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = tag;
    b.setAttribute("aria-pressed", selected.has(tag));
    b.addEventListener("click", () => {
      if (selected.has(tag)) selected.delete(tag);
      else selected.add(tag);
      b.setAttribute("aria-pressed", selected.has(tag));
      onChange(selected);
    });
    container.appendChild(b);
  }
}

$("add-tag-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("add-tag-input");
  const tag = input.value.trim().replace(/\s+/g, " ");
  if (!tag) return;
  const custom = prefs.get("customTags", []);
  if (!allTags().some((t) => t.toLowerCase() === tag.toLowerCase())) prefs.set("customTags", [...custom, tag]);
  tonightTags.add(allTags().find((t) => t.toLowerCase() === tag.toLowerCase()) || tag);
  prefs.set("tonightTags", [...tonightTags]);
  input.value = "";
  renderTonightTags();
});

function renderTonightTags() {
  renderChips($("tonight-tags"), tonightTags, (sel) => prefs.set("tonightTags", [...sel]));
}

/* Tonight */

async function renderTonight() {
  $("tonight-date").textContent = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  renderTonightTags();

  const nights = await db.allNights();
  const unfinished = nights.find((n) => n.status === "recording" && n.id !== session?.night.id);
  $("unfinished").hidden = !unfinished;
  if (unfinished) {
    const recent = Date.now() - unfinished.lastBeat < 6 * 3600 * 1000;
    $("unfinished-text").textContent = `The recording that started at ${clock(unfinished.start)} on ${dayLabel(unfinished.start)} stopped at ${clock(unfinished.lastBeat)}, probably because the screen locked or the app was closed.`;
    $("unfinished-continue").hidden = !recent;
    $("unfinished-continue").onclick = () => startNight(unfinished);
    $("unfinished-finish").onclick = () => finishNight(unfinished);
  }

  const last = nights.find((n) => n.status === "done");
  $("last-night").hidden = !last;
  if (last) {
    const s = last.summary || summarize(last);
    $("last-snoring").textContent = s.snoringMin ? `${duration(s.snoringMin)} snoring` : "No snoring";
    $("last-sub").textContent = `${pct(s.snoringPct)} of ${duration(s.recordedMin)} · ${dayLabel(last.start)}`;
    $("last-night").onclick = () => openNight(last.id);
    requestAnimationFrame(() => timelineChart($("last-chart"), last, { compact: true }));
  }
}

async function finishNight(night) {
  night.end = night.lastBeat;
  night.status = "done";
  night.summary = summarize(night);
  await db.putNight(night);
  openNight(night.id);
}

async function prepareDetector() {
  const status = $("model-status");
  try {
    await loadClassifier();
    status.textContent = "Snore detector ready";
    status.classList.add("is-ready");
    $("start").disabled = false;
  } catch (e) {
    console.error(e);
    status.textContent = "The snore detector didn't load. Check your connection, then reload the page.";
  }
}

function micError(e) {
  if (e?.name === "NotAllowedError") return "Snore Log can't use the microphone. Allow microphone access when asked. If you blocked it, open Safari's website settings (the aA button in the address bar), set Microphone to Allow, then try again.";
  if (e?.name === "NotFoundError") return "No microphone was found.";
  return `Recording couldn't start: ${e?.message || e}`;
}

$("start").addEventListener("click", () => startNight());

async function startNight(existing) {
  $("start-error").hidden = true;
  $("start").disabled = true;
  const night = existing || newNight({ tags: [...tonightTags], settings });
  const s = new NightSession(night, settings);
  try {
    await s.start();
  } catch (e) {
    console.error(e);
    s.listener.stop();
    $("start-error").textContent = micError(e);
    $("start-error").hidden = false;
    $("start").disabled = false;
    return;
  }
  session = s;
  session.onChange = scheduleRecRender;
  if (!existing) {
    tonightTags.clear();
    prefs.set("tonightTags", []);
  }
  $("start").disabled = false;
  openRecording();
  navigator.storage?.persist?.().catch(() => {});
}

/* Night screen */

let wakeLock = null;
let clockTimer = 0;
let dimTimer = 0;
let recFrame = 0;

async function keepAwake() {
  const warn = $("rec-warning");
  if (!("wakeLock" in navigator)) {
    warn.textContent = "This browser can't keep the screen on. Set Auto-Lock to Never (Settings › Display & Brightness) for tonight.";
    warn.hidden = false;
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => (wakeLock = null));
    warn.hidden = true;
  } catch {
    warn.textContent = "The screen may turn off by itself. Set Auto-Lock to Never (Settings › Display & Brightness) for tonight.";
    warn.hidden = false;
  }
}

function openRecording() {
  $("recording").hidden = false;
  $("rec-notice").hidden = true;
  document.documentElement.style.overflow = "hidden";
  keepAwake();
  tick();
  clockTimer = setInterval(tick, 1000);
  undim();
}

const clockFormat = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });

function tick() {
  const parts = clockFormat.formatToParts(new Date());
  $("rec-clock").textContent = parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim();
  $("rec-period").textContent = parts.find((p) => p.type === "dayPeriod")?.value || "";
  renderRec();
}

function scheduleRecRender() {
  if (!recFrame) recFrame = requestAnimationFrame(() => {
    recFrame = 0;
    renderRec();
  });
}

function renderRec() {
  if (!session) return;
  const minutes = (Date.now() - session.night.start) / 60000;
  const n = session.snores;
  $("rec-meta").textContent = `${minutes < 1 ? "Started" : duration(minutes)} · ${n} snore${n === 1 ? "" : "s"}`;
  const above = session.floorDb === null ? 0 : session.lastDb - session.floorDb;
  $("rec-level").style.width = `${Math.max(0, Math.min(1, above / 40)) * 100}%`;
  const paused = session.state !== "running" && session.state !== "starting";
  $("rec-paused").hidden = !paused;
  $("recording").classList.toggle("is-paused", paused);
  $("rec-state").textContent = paused ? "Paused" : "Listening";
}

function undim() {
  $("recording").classList.remove("is-dim");
  clearTimeout(dimTimer);
  dimTimer = setTimeout(() => $("recording").classList.add("is-dim"), 15000);
}
$("recording").addEventListener("pointerdown", undim);

$("rec-resume").addEventListener("click", async () => {
  try {
    await session.resume();
    session.state = session.listener.running ? "running" : "interrupted";
    renderRec();
  } catch (e) {
    $("rec-paused-text").textContent = micError(e);
  }
});

const hold = $("hold-stop");
let holdTimer = 0;
hold.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  hold.classList.add("is-holding");
  holdTimer = setTimeout(endNight, 1200);
});
for (const type of ["pointerup", "pointerleave", "pointercancel"]) {
  hold.addEventListener(type, () => {
    hold.classList.remove("is-holding");
    clearTimeout(holdTimer);
  });
}
hold.addEventListener("click", (e) => e.detail === 0 && endNight()); // keyboard
hold.addEventListener("contextmenu", (e) => e.preventDefault());

async function endNight() {
  const s = session;
  if (!s) return;
  session = null;
  hold.classList.remove("is-holding");
  clearInterval(clockTimer);
  clearTimeout(dimTimer);
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  const night = await s.stop();
  $("recording").hidden = true;
  document.documentElement.style.overflow = "";
  if (night.summary.recordedMin < 1) {
    await db.deleteNight(night.id);
    show("tonight");
    renderTonight();
    toast("Night discarded: it was shorter than a minute.");
    return;
  }
  openNight(night.id);
}

document.addEventListener("visibilitychange", () => {
  if (!session) return;
  if (document.hidden) {
    session.save();
    return;
  }
  keepAwake();
  const since = session.lastLevelAt;
  if (since && Date.now() - since > 10000) {
    $("rec-notice").textContent = `Recording stopped from ${clock(since)} to ${clock(Date.now())} while the screen was off. That time shows as a gap in the report.`;
    $("rec-notice").hidden = false;
  }
  setTimeout(() => {
    if (session && !session.listener.running) {
      session.state = "interrupted";
      renderRec();
    }
  }, 1500);
});

window.addEventListener("beforeunload", (e) => {
  if (session) e.preventDefault();
});

/* Night report */

async function openNight(id) {
  const night = await db.getNight(id);
  if (!night) return;
  if (!night.summary) night.summary = summarize(night);
  currentNight = night;
  show("night");
  renderNight();
}

$("night-back").addEventListener("click", () => {
  stopAudio();
  show("history");
  renderHistory();
});

function renderNight() {
  const n = currentNight;
  const s = n.summary;
  $("night-title").textContent = nightLabel(n.start);
  $("night-times").textContent = `${clock(n.start)}–${clock(n.end)} · ${duration((n.end - n.start) / 60000)}`;

  const hero = $("night-hero");
  if (s.snoringMin) {
    hero.innerHTML = `<p class="hero-figure"></p><p class="hero-sub"></p>`;
    hero.children[0].textContent = duration(s.snoringMin);
    hero.children[1].textContent = `snoring, ${pct(s.snoringPct)} of the ${duration(s.recordedMin)} recorded`;
  } else {
    hero.innerHTML = `<p class="hero-figure">No snoring</p><p class="hero-sub"></p>`;
    hero.children[1].textContent = `None detected in ${duration(s.recordedMin)} of recording.`;
  }

  const stat = (label, value, small = "") => `<div><dt>${label}</dt><dd>${value}${small ? `<br><small>${small}</small>` : ""}</dd></div>`;
  $("night-stats").innerHTML = [
    stat("Loudest snoring", s.loudestDb === null ? "–" : `+${s.loudestDb} dB`, s.loudestDb === null ? "" : "above room noise"),
    stat("Snoring episodes", s.episodes, s.episodes ? `longest ${duration(s.longestEpisodeMin)}` : ""),
    stat("Snore sounds", s.events.toLocaleString()),
    stat("Recorded", duration(s.recordedMin), s.gaps.length ? `${s.gaps.length} gap${s.gaps.length > 1 ? "s" : ""}` : "no gaps"),
  ].join("");

  $("night-legend").innerHTML =
    TIERS.map((t) => `<span><i class="swatch-${t.id}"></i>${t.name} ${s.tiers[t.id]} min</span>`).join("") +
    (s.gaps.length ? `<span><i class="swatch-gap"></i>Not recorded</span>` : "");
  requestAnimationFrame(() => timelineChart($("night-chart"), n));

  renderClips(n);

  $("sounds-block").hidden = !s.sounds.length;
  $("sounds").textContent = "";
  for (const [label, count] of s.sounds) {
    const chip = document.createElement("span");
    chip.className = "sound";
    chip.textContent = `${label} `;
    const b = document.createElement("b");
    b.textContent = `×${count}`;
    chip.appendChild(b);
    $("sounds").appendChild(chip);
  }

  renderChips($("night-tags"), new Set(n.tags || []), (sel) => {
    n.tags = [...sel];
    db.putNight(n);
  });
  $("night-note").value = n.note || "";

  confirmTap($("night-delete"), "Delete this night", "Tap again to delete", async () => {
    stopAudio();
    await db.deleteNight(n.id);
    toast("Night deleted.");
    show("history");
    renderHistory();
  });
}

let noteTimer = 0;
$("night-note").addEventListener("input", () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    currentNight.note = $("night-note").value;
    db.putNight(currentNight);
  }, 500);
});

/* Clips */

const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>';
const PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
let audio = null;
let playing = null; // { button, bar, url }

function stopAudio() {
  if (!playing) return;
  audio.pause();
  URL.revokeObjectURL(playing.url);
  playing.button.innerHTML = PLAY;
  playing.button.setAttribute("aria-label", "Play");
  playing.bar.style.width = "0";
  playing = null;
}

function togglePlay(clip, button, bar) {
  const same = playing?.button === button;
  stopAudio();
  if (same) return;
  audio ??= new Audio();
  const url = URL.createObjectURL(clip.blob);
  playing = { button, bar, url };
  audio.src = url;
  audio.ontimeupdate = () => (bar.style.width = `${(audio.currentTime / (audio.duration || clip.duration)) * 100}%`);
  audio.onended = stopAudio;
  button.innerHTML = PAUSE;
  button.setAttribute("aria-label", "Pause");
  audio.play().catch(stopAudio);
}

async function renderClips(night) {
  const list = $("clips");
  list.textContent = "";
  const clips = await db.clipsForNight(night.id);
  if (!clips.length) {
    const li = document.createElement("li");
    li.className = "hint";
    const age = (Date.now() - night.start) / 86400000;
    li.textContent = !settings.saveClips
      ? "Saving clips is turned off in Settings."
      : settings.keepClipsDays && age > settings.keepClipsDays
        ? `Clips are deleted after ${settings.keepClipsDays} days.`
        : night.summary.events
          ? "No clips were saved this night."
          : "No snoring, so no clips.";
    list.appendChild(li);
    return;
  }
  for (const clip of clips) {
    const li = document.createElement("li");
    li.className = "clip";
    li.innerHTML = `<button class="play" type="button" aria-label="Play">${PLAY}</button>
      <span class="clip-info"><span class="clip-time"></span><span class="clip-meta"></span></span>
      <button class="clip-delete" type="button">Delete</button>
      <span class="clip-progress"><span></span></span>`;
    li.querySelector(".clip-time").textContent = clock(clip.time);
    li.querySelector(".clip-meta").textContent = `${Math.round(clip.duration)} s · +${clip.peakAboveRoom} dB above room`;
    const button = li.querySelector(".play");
    const bar = li.querySelector(".clip-progress span");
    button.addEventListener("click", () => togglePlay(clip, button, bar));
    li.querySelector(".clip-delete").addEventListener("click", async () => {
      if (playing?.button === button) stopAudio();
      await db.deleteClip(clip.id);
      li.remove();
      toast("Clip deleted.");
    });
    list.appendChild(li);
  }
}

/* History */

async function renderHistory() {
  const nights = (await db.allNights()).filter((n) => n.status === "done");
  for (const n of nights) n.summary ??= summarize(n);
  $("history-empty").hidden = nights.length > 0;
  $("history-content").hidden = nights.length === 0;
  if (!nights.length) return;

  requestAnimationFrame(() => trendChart($("trend-chart"), nights, (n) => openNight(n.id)));

  const effects = $("effects");
  effects.textContent = "";
  const rows = factorEffects(nights);
  if (nights.length < 3 || !rows.length) {
    effects.innerHTML = `<p class="hint">Tag your nights on the Tonight tab. Once some nights have a tag and some don't, this compares how much you snored.</p>`;
  } else {
    effects.className = "effects";
    const max = Math.max(...rows.flatMap((r) => [r.withPct, r.withoutPct]), 0.01);
    for (const r of rows) {
      const div = document.createElement("div");
      div.className = "effect";
      div.innerHTML = `<div class="effect-head"><b></b><span></span></div>
        <div class="effect-bars">
          <div class="effect-bar"><span>With</span><i style="width:${(r.withPct / max) * 100}%"></i><b>${pct(r.withPct)}</b></div>
          <div class="effect-bar is-without"><span>Without</span><i style="width:${(r.withoutPct / max) * 100}%"></i><b>${pct(r.withoutPct)}</b></div>
        </div>`;
      div.querySelector(".effect-head b").textContent = r.tag;
      div.querySelector(".effect-head span").textContent = `${r.withN} night${r.withN > 1 ? "s" : ""} with, ${r.withoutN} without`;
      effects.appendChild(div);
    }
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Share of recorded time spent snoring. With only a few nights, differences can be chance.";
    effects.appendChild(note);
  }

  const list = $("night-list");
  list.textContent = "";
  for (const n of nights) {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button"><span class="nl-date"></span><span class="nl-value"></span><span class="nl-sub"></span><span class="nl-sub"></span><span class="nl-tags"></span></button>`;
    const [date, value, times, snoring, tags] = li.querySelectorAll("span");
    date.textContent = dayLabel(n.start);
    value.textContent = pct(n.summary.snoringPct);
    times.textContent = `${clock(n.start)}–${clock(n.end)}`;
    snoring.textContent = n.summary.snoringMin ? `${duration(n.summary.snoringMin)} snoring` : "No snoring";
    tags.textContent = (n.tags || []).join(" · ");
    tags.hidden = !(n.tags || []).length;
    li.firstChild.addEventListener("click", () => openNight(n.id));
    list.appendChild(li);
  }
}

/* Settings */

async function renderSettings() {
  for (const b of $("sensitivity").querySelectorAll("button")) b.setAttribute("aria-checked", b.dataset.value === settings.sensitivity);
  $("sensitivity-hint").textContent = SENSITIVITY_HINTS[settings.sensitivity];
  $("save-clips").checked = settings.saveClips;
  $("keep-clips").value = String(settings.keepClipsDays);
  $("keep-clips").disabled = !settings.saveClips;
  try {
    const { usage } = await navigator.storage.estimate();
    $("storage-used").textContent = `Snore Log uses ${megabytes(usage)} on this phone.`;
  } catch {}
}

for (const b of $("sensitivity").querySelectorAll("button")) {
  b.addEventListener("click", () => {
    settings.sensitivity = b.dataset.value;
    saveSettings();
    renderSettings();
  });
}
$("save-clips").addEventListener("change", (e) => {
  settings.saveClips = e.target.checked;
  saveSettings();
  renderSettings();
});
$("keep-clips").addEventListener("change", async (e) => {
  settings.keepClipsDays = Number(e.target.value);
  saveSettings();
  await pruneOldClips();
  renderSettings();
});

async function pruneOldClips() {
  if (settings.keepClipsDays > 0) await db.pruneClips(Date.now() - settings.keepClipsDays * 86400000);
}

$("export").addEventListener("click", async () => {
  const nights = await db.allNights();
  const data = JSON.stringify({ app: "snore-log", version: 1, exported: new Date().toISOString(), nights });
  const name = `snore-log-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([data], name, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
});

$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const status = $("backup-status");
  try {
    const data = JSON.parse(await file.text());
    const nights = (data.nights || []).filter((n) => typeof n.id === "string" && Number.isFinite(n.start) && Array.isArray(n.minutes));
    if (!nights.length) throw new Error("no nights");
    let added = 0;
    for (const n of nights) {
      if (await db.getNight(n.id)) continue;
      if (n.status !== "done") {
        n.status = "done";
        n.end ??= n.lastBeat;
      }
      n.summary = summarize(n);
      await db.putNight(n);
      added++;
    }
    status.textContent = `Imported ${added} night${added === 1 ? "" : "s"}${nights.length > added ? `; ${nights.length - added} were already here` : ""}.`;
  } catch {
    status.textContent = "That file isn't a Snore Log backup.";
  }
});

confirmTap($("delete-all"), "Delete all data", "Tap again to delete everything", async () => {
  await db.clearAll();
  toast("All nights and recordings deleted.");
  renderSettings();
});

/* Microphone test */

let check = null;

$("open-check").addEventListener("click", async () => {
  const sheet = $("check");
  sheet.hidden = false;
  $("check-error").hidden = true;
  $("check-count").textContent = "";
  const threshold = SENSITIVITY[settings.sensitivity];
  $("check-threshold").style.left = `${threshold * 100}%`;
  const listener = new Listener();
  const floor = new NoiseFloor(30);
  let snores = 0;
  let wasSnore = false;
  listener.onLevel = (t, dbfs) => {
    floor.push(dbfs);
    const above = Math.max(0, dbfs - floor.value);
    $("check-level").textContent = `+${Math.round(above)} dB`;
    $("check-level-bar").style.width = `${Math.min(1, above / 40) * 100}%`;
  };
  listener.onFrame = (t, snore, label, score) => {
    $("check-snore").textContent = `${Math.round(snore * 100)}%`;
    $("check-snore-bar").style.width = `${snore * 100}%`;
    $("check-label").textContent = `${label} (${Math.round(score * 100)}%)`;
    const isSnore = snore >= threshold;
    if (isSnore && !wasSnore) {
      snores++;
      $("check-count").textContent = `${snores} snore${snores === 1 ? "" : "s"} detected`;
    }
    wasSnore = isSnore;
  };
  check = listener;
  try {
    await listener.start();
  } catch (e) {
    $("check-error").textContent = micError(e);
    $("check-error").hidden = false;
  }
});

function closeCheck() {
  check?.stop();
  check = null;
  $("check").hidden = true;
}
$("check-close").addEventListener("click", closeCheck);
$("check").addEventListener("click", (e) => e.target === $("check") && closeCheck());

/* Start-up */

const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
$("install-hint").hidden = !isIOS || standalone || prefs.get("installHintDismissed", false);
$("install-dismiss").addEventListener("click", () => {
  prefs.set("installHintDismissed", true);
  $("install-hint").hidden = true;
});
$("checklist").open = !prefs.get("checklistSeen", false);
$("checklist").addEventListener("toggle", () => prefs.set("checklistSeen", true));

if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  // A new version took over: reload to use it, unless a night is being recorded.
  navigator.serviceWorker.addEventListener("controllerchange", () => hadController && !session && location.reload());
}

prepareDetector();
pruneOldClips().catch(() => {});
renderTonight();
