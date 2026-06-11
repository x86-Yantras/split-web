// Google Sign-In wiring — Identity Services + token client for Drive.

(function () {
  const CLIENT_ID =
    "987069794128-abmfv8o5c1mvgbgdjh98j53gn7j9jbmo.apps.googleusercontent.com";
  const STORAGE_KEY = "splitsplit.user.v1";
  // Scopes we'll need once Sheets/Drive operations are wired.
  const DRIVE_SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
  ].join(" ");

  let initialized = false;
  let onChangeCallbacks = [];
  let tokenClient = null;

  function decodeJwt(token) {
    try {
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(payload))));
    } catch (e) {
      console.error("Bad credential JWT:", e);
      return null;
    }
  }

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
    if (!window.google || !window.google.accounts) return; // GIS not loaded yet
    initialized = true;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Lazy-init the token client (only when we need Drive scopes).
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPES,
      callback: () => {}, // overwritten per-call
    });
  }

  function handleCredentialResponse(response) {
    const data = decodeJwt(response.credential);
    if (!data) return;
    const profile = {
      sub: data.sub,
      email: data.email,
      name: data.name || data.email,
      givenName:
        data.given_name ||
        (data.name || "").split(" ")[0] ||
        data.email.split("@")[0],
      picture: data.picture || null,
      idToken: response.credential,
      signedInAt: Date.now(),
    };
    persistUser(profile);
  }

  // Prompt the user to sign in. Uses One Tap when possible; falls back to
  // a popup-style button render at the supplied anchor element.
  function signIn(opts = {}) {
    init();
    if (!window.google) {
      alert("Google Sign-In didn't load. Check your network.");
      return;
    }

    // Try One Tap first
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: render the official Sign In button into a hidden anchor
        // and programmatically click it (One Tap may be blocked by FedCM).
        if (opts.anchorEl) {
          opts.anchorEl.innerHTML = "";
          window.google.accounts.id.renderButton(opts.anchorEl, {
            theme: "filled_black",
            size: "large",
            type: "standard",
            shape: "pill",
            text: "continue_with",
          });
        }
      }
    });
  }

  function signOut() {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
    clearToken();
    persistUser(null);
  }

  // Access-token cache. GIS access tokens last ~1h but live only in memory, so
  // without this every page reload re-runs the consent/account popup. Persist
  // to sessionStorage (cleared when the tab closes) with a 60s safety buffer.
  const TOKEN_KEY = "splitsplit.token.v1";
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

  // Request an OAuth access token for Drive/Sheets. Promise-based.
  // Returns the cached token when still valid; only prompts when missing/expired.
  function getAccessToken() {
    init();
    const cached = readCachedToken();
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject(new Error("token client not ready"));
      tokenClient.callback = (resp) => {
        if (resp.error) return reject(resp);
        try {
          const ttl = (Number(resp.expires_in) || 3600) * 1000;
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: resp.access_token, expiresAt: Date.now() + ttl }));
        } catch (e) {}
        resolve(resp.access_token);
      };
      // 'consent' on first call, '' subsequently if cached.
      tokenClient.requestAccessToken({ prompt: getUser() ? "" : "consent" });
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
