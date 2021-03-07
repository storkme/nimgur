const letters =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateString(): string {
  return Array.from({ length: 6 })
    .map(() => letters[Math.floor(Math.random() * letters.length)])
    .join("");
}
