const isDev = import.meta.env.DEV;

export const API_BASE = isDev
  ? `http://${window.location.hostname}:3001`
  : window.location.origin;

export const WS_BASE = isDev
  ? `ws://${window.location.hostname}:3001`
  : `ws://${window.location.host}`;
