const TOKEN_KEY = 'eis_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Calls the backend. Pass `body` for JSON or `form` (FormData) for file uploads. */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && path !== '/auth/login') {
    tokenStore.clear();
    window.location.assign('/login');
  }
  if (!res.ok) {
    throw new Error(data.message || (res.status >= 500 ? 'Server error. Is the backend running?' : `Request failed (${res.status})`));
  }
  return data;
}

/** Downloads an uploaded PDF (the request carries the login token) and returns a local object URL. */
export async function fetchPdfUrl(fileName) {
  const res = await fetch(`/api/files/${encodeURIComponent(fileName)}`, {
    headers: { Authorization: `Bearer ${tokenStore.get()}` },
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || 'Could not open the file');
  }
  return URL.createObjectURL(await res.blob());
}
