const key = "gadgetaid:last-chunk-recovery";
export function recoverPreload(event, { storage, reload, now, online }) {
  if (online === false) return false;
  try {
    const previous = Number(storage.getItem(key));
    if (previous > 0 && now - previous < 60000) return false;
    storage.setItem(key, String(now));
  } catch {
    // Without durable tab state, leave the manual error-page recovery in place.
    return false;
  }
  event.preventDefault();
  reload();
  return true;
}
