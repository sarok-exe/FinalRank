export function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(7);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}
