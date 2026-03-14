const STORAGE_KEY = 'craftomation_device_id';

export function getDeviceId(): string {
  // Use sessionStorage so each browser tab gets its own unique device ID.
  // This survives page reloads (for rejoin) but is unique per tab,
  // which is important when multiple clients run on the same machine.
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
