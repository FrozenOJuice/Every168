export function formatRestDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return [
    minutes ? `${minutes}m` : "",
    remainder || !minutes ? `${remainder}s` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
