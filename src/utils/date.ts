export function today() {
  return localDate(new Date());
}
export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDate(d);
}
export function niceDate(date: string, short = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(
    "es-AR",
    short
      ? { day: "numeric", month: "short" }
      : { weekday: "long", day: "numeric", month: "long" },
  );
}
export function rangeDates(end: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftDate(end, i - count + 1));
}
export function rounded(n: number) {
  return Math.round(n).toLocaleString("es-AR");
}
