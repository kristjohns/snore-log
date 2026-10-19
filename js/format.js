// Display formatting, in the phone's own locale.

export function clock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// "Sat 18 Oct" for the night that started on that evening.
export function dayLabel(ms) {
  return new Date(ms).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

// Nights started after midnight belong to the previous evening.
export function nightLabel(ms) {
  const d = new Date(ms);
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

export function duration(minutes) {
  minutes = Math.round(minutes);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function pct(share) {
  return `${Math.round(share * 100)}%`;
}

export function megabytes(bytes) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(0.1, bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0)} MB`;
}
