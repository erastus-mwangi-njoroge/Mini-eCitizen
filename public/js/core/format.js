const TZ = "Africa/Nairobi";
const dateFmt = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const shortFmt = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", timeZone: TZ });

export const formatDate = (iso) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso) => dateTimeFmt.format(new Date(iso));
export const formatShortDate = (iso) => shortFmt.format(new Date(iso));

/** 78.8 -> "3 d 7 h", 5 -> "5 h" */
export function formatDuration(hours) {
  if (hours == null) return "–";
  if (hours < 1) return "< 1 h";
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return rest ? `${days} d ${rest} h` : `${days} d`;
}
