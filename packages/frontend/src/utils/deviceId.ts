const STORAGE_KEY = 'craftomation_device_id';

function generateId(): string {
  // crypto.randomUUID() is only available in secure contexts (HTTPS/localhost).
  // Fall back to a manual approach for plain HTTP on LAN.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getDeviceId(): string {
  // Use sessionStorage so each browser tab gets its own unique device ID.
  // This survives page reloads (for rejoin) but is unique per tab,
  // which is important when multiple clients run on the same machine.
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateId();
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
