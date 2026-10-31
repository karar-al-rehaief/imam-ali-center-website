export function photoWeek(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now).map(part => [part.type, part.value]));
  const day = Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day));
  return Math.floor((day - Date.UTC(2026,9,5)) / (7*86400000));
}
export function weeklyPhotos(library, now = new Date()) {
  if (!Array.isArray(library) || library.length <= 5) return library;
  const start = ((photoWeek(now)*5) % library.length + library.length) % library.length;
  return Array.from({length:5}, (_,i) => library[(start+i)%library.length]);
}
