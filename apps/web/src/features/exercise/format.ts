/** Keep short activities visible rather than rounding a recorded duration to zero minutes. */
export function exerciseDuration(seconds: number) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return [
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
    remainder || !total ? `${remainder}s` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
