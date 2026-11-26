export function completionId(hash = location.hash): number | null {
  const m = hash.match(/^#checkout\/complete\/([1-9][0-9]{0,14})$/);
  return m && Number.isSafeInteger(Number(m[1])) ? Number(m[1]) : null;
}
export function showCompletion(id: number) {
  history.replaceState(null, "", "#checkout/complete/" + id);
  dispatchEvent(new HashChangeEvent("hashchange"));
}
