const TOKEN_KEY = "lavastese_token";
const USER_KEY  = "lavastese_user";

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

// Aggiunge Authorization header a ogni fetch autenticato
export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// fetch con token automatico
export async function apiFetch(url, options = {}) {
  const isFormData = options.body instanceof FormData;

  const headers = {
    // Non impostare Content-Type per FormData: il browser lo gestisce
    // con il boundary multipart corretto
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...authHeaders(),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Token scaduto o non valido → logout automatico
  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Sessione scaduta");
  }

  return res;
}
