const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = 58n;

export function encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  // Count leading zeros
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  // Convert to big integer
  let num = 0n;
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }

  // Convert to base58
  const chars: string[] = [];
  while (num > 0n) {
    chars.unshift(ALPHABET[Number(num % BASE)]);
    num = num / BASE;
  }

  // Add leading '1's for each leading zero byte
  for (let i = 0; i < zeros; i++) {
    chars.unshift(ALPHABET[0]);
  }

  return chars.join('');
}

export function decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  // Count leading '1's
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;

  // Convert from base58
  let num = 0n;
  for (const char of str) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid base58 character: ${char}`);
    num = num * BASE + BigInt(index);
  }

  // Convert to bytes
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num = num >> 8n;
  }

  // Add leading zero bytes
  for (let i = 0; i < zeros; i++) {
    bytes.unshift(0);
  }

  return new Uint8Array(bytes);
}
