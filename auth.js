// Shared Google sign-in helper used by every page.
window.PAI = (() => {
  const state = { user: null, clientId: null, ready: null };
  let gsiLoaded = null;

  function loadGsi() {
    if (gsiLoaded) return gsiLoaded;
    gsiLoaded = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load Google sign-in. Check your internet connection."));
      document.head.appendChild(s);
    });
    return gsiLoaded;
  }

  async function load() {
    if (state.ready) return state.ready;
    state.ready = (async () => {
      try {
        const [cfg, me] = await Promise.all([
          fetch("api/config").then((r) => r.json()),
          fetch("api/me").then((r) => r.json())
        ]);
        state.clientId = cfg.googleClientId || null;
        state.user = me.user || null;
      } catch (e) { state.ready = null; /* server not reachable; allow retry */ }
      return state;
    })();
    return state.ready;
  }

  // Draws the official Google button inside `el`. Calls onSignedIn(user) on success.
  async function renderButton(el, { lang = "en", onSignedIn, onError, size = "large", width } = {}) {
    await load();
    if (!el) return false;
    if (!state.clientId) {
      // Server not reachable (e.g. page opened as a file). Show a message, never a link to another page.
      el.innerHTML = "";
      const m = document.createElement("span");
      m.className = "gmsg";
      m.textContent = lang === "pa"
        ? "ਸਰਵਰ ਚਾਲੂ ਨਹੀਂ ਹੈ। start.bat ਚਲਾਓ ਅਤੇ http://localhost:3000 ਖੋਲ੍ਹੋ।"
        : "Server is not running. Run start.bat, then open http://localhost:3000";
      el.appendChild(m);
      onError && onError(m.textContent);
      return false;
    }
    try { await loadGsi(); } catch (e) { onError && onError(e.message); return false; }
    google.accounts.id.initialize({
      client_id: state.clientId,
      ux_mode: "popup",
      callback: async (resp) => {
        try {
          const res = await fetch("api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: resp.credential })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Sign-in failed.");
          state.user = data.user;
          onSignedIn && onSignedIn(data.user);
        } catch (e) { onError && onError(e.message); }
      }
    });
    el.innerHTML = "";
    google.accounts.id.renderButton(el, {
      theme: "outline", size, shape: "pill", text: "continue_with", logo_alignment: "left",
      locale: lang === "pa" ? "pa" : "en", ...(width ? { width } : {})
    });
    return true;
  }

  async function logout() {
    try { await fetch("api/logout", { method: "POST" }); } catch (e) {}
    state.user = null;
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
  }

  const initial = (u) => (u?.name || u?.email || "?").trim().charAt(0).toUpperCase();

  // Builds a small round avatar element (photo if available, else the first letter).
  function avatar(u, cls = "avatar") {
    const wrap = document.createElement("span");
    wrap.className = cls;
    if (u.picture) {
      const img = document.createElement("img");
      img.src = u.picture; img.alt = ""; img.referrerPolicy = "no-referrer";
      img.onerror = () => { img.remove(); wrap.textContent = initial(u); };
      wrap.appendChild(img);
    } else wrap.textContent = initial(u);
    return wrap;
  }

  return { state, load, renderButton, logout, avatar };
})();

// Register the service worker so Punjab AI can be installed on a phone.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
