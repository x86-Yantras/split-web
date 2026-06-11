// Google Sign-In — single OAuth token-client flow.
//
// One popup does everything: the user picks an account, grants Drive/Sheets +
// profile scopes, and we get back an access token. Identity (email/name/picture)
// comes from the userinfo endpoint using that same token. We intentionally do NOT
// use Google One Tap (id.prompt) — combining it with the token client showed two
// popups and tripped the FedCM "third-party sign-in disabled" path.

(function () {
  const CLIENT_ID =
    "987069794128-abmfv8o5c1mvgbgdjh98j53gn7j9jbmo.apps.googleusercontent.com";
  const STORAGE_KEY = "splitsplit.user.v1";
  const TOKEN_KEY = "splitsplit.token.v1";
  // Identity scopes (openid/email/profile) + the Drive/Sheets data scopes.
  const SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
  ].join(" ");

  let initialized = false;
  let onChangeCallbacks = [];
  let tokenClient = null;

  function persistUser(profile) {
    if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(STORAGE_KEY);
    onChangeCallbacks.forEach((cb) => cb(profile));
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function init() {
    if (initialized) return;
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) return; // GIS not loaded yet
    initialized = true;
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {}, // overwritten per request
    });
  }

  // ---- access-token cache (sessionStorage, 60s safety buffer) ----
  function cacheToken(resp) {
    try {
      const ttl = (Number(resp.expires_in) || 3600) * 1000;
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: resp.access_token, expiresAt: Date.now() + ttl }));
    } catch (e) {}
  }
  function readCachedToken() {
    try {
      const raw = sessionStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const t = JSON.parse(raw);
      if (t && t.token && t.expiresAt && t.expiresAt - 60000 > Date.now()) return t.token;
    } catch (e) {}
    return null;
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  // Fetch the signed-in user's profile with an access token (no extra popup).
  async function fetchProfile(accessToken) {
    const res = await window.fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!res.ok) throw new Error("userinfo " + res.status);
    const d = await res.json();
    return {
      sub: d.sub,
      email: d.email,
      name: d.name || d.email,
      givenName: d.given_name || (d.name || "").split(" ")[0] || (d.email || "").split("@")[0],
      picture: d.picture || null,
      signedInAt: Date.now(),
    };
  }

  // Single entry point: one popup that signs in + grants Drive/Sheets access.
  function signIn() {
    init();
    if (!window.google || !tokenClient) {
      alert("Google Sign-In didn't load. Check your network.");
      return Promise.reject(new Error("gis not ready"));
    }
    return new Promise((resolve, reject) => {
      tokenClient.callback = async (resp) => {
        if (resp.error) return reject(resp);
        cacheToken(resp);
        try {
          persistUser(await fetchProfile(resp.access_token));
          resolve(getUser());
        } catch (e) { reject(e); }
      };
      // Force the account chooser + consent on an explicit sign-in.
      tokenClient.requestAccessToken({ prompt: getUser() ? "" : "consent" });
    });
  }

  function signOut() {
    clearToken();
    persistUser(null);
  }

  // Access token for Drive/Sheets. Cached token first; only prompts when expired.
  // Uses prompt:'' so a still-valid Google session refreshes silently (no popup).
  function getAccessToken() {
    init();
    const cached = readCachedToken();
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject(new Error("token client not ready"));
      tokenClient.callback = (resp) => {
        if (resp.error) return reject(resp);
        cacheToken(resp);
        resolve(resp.access_token);
      };
      tokenClient.requestAccessToken({ prompt: "" });
    });
  }

  function onChange(cb) {
    onChangeCallbacks.push(cb);
    return () => {
      onChangeCallbacks = onChangeCallbacks.filter((c) => c !== cb);
    };
  }

  window.SSAuth = {
    init,
    signIn,
    signOut,
    getUser,
    onChange,
    getAccessToken,
    clearToken,
    CLIENT_ID,
  };

  // Auto-init when GIS finishes loading.
  if (window.google && window.google.accounts) init();
  else window.addEventListener("load", () => setTimeout(init, 100));
})();
