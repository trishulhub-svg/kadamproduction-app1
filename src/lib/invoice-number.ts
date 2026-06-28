// src/lib/invoice-number.ts
// Order number format: KP + year + 4-digit sequence (e.g. KP20260001)
// After 9999, cycles with letter suffix: 0001A, 0002A, ... 9999A, 0001B, ...
export function formatOrderNumber(orderId: number, createdAt?: Date | string | number): string {
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = date.getFullYear();
  const prefix = `KP${year}`;
  const seq = orderId;
  if (seq <= 9999) {
    return `${prefix}${String(seq).padStart(4, "0")}`;
  }
  const cycle = Math.floor((seq - 1) / 9999);
  const within = ((seq - 1) % 9999) + 1;
  const suffix = String.fromCharCode(65 + cycle - 1);
  return `${prefix}${String(within).padStart(4, "0")}${suffix}`;
}

// Backward-compatible alias
export function invoiceNumber(orderId: number, createdAt?: Date | string | number): string {
  return formatOrderNumber(orderId, createdAt);
}
