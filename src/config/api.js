// Single source of truth for the backend location.
//
// Port 8000 is a popular default and is easily taken by an unrelated local
// service; when that happens every request silently hits the wrong server and
// returns 404. Keep the port configurable (VITE_API_URL) so it can be moved
// without touching call sites, and default to a less contested port.
export const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

// Same host/port as the REST API, over the WebSocket scheme.
export const WS_API = API.replace(/^http/, 'ws');

export default API;
