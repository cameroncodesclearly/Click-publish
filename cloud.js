// Click Publish — cloud store.
//
// Thin wrapper over the Supabase client (window.sb) that the app's logic class
// talks to. Keeping all Supabase calls here keeps the app logic small and gives
// tests a single seam to stub (inject a fake window.sb before this loads).
//
// If window.sb is absent (no/placeholder config), CloudStore.enabled is false
// and the app falls back to local-only mode (localStorage, no real accounts).

(function () {
  var TABLE = 'app_states';
  var SAVE_DEBOUNCE_MS = 1500;
  var saveTimer = null;
  var pendingData = null;

  var CloudStore = {
    enabled: false,
    _user: null,

    init: function () {
      this.enabled = !!window.sb;
      return this.enabled;
    },

    // Returns the current session's user ({ id, email, name }) or null.
    getSession: function () {
      if (!window.sb) return Promise.resolve(null);
      return window.sb.auth.getSession().then(function (res) {
        var session = res && res.data && res.data.session;
        if (!session || !session.user) { CloudStore._user = null; return null; }
        var u = session.user;
        CloudStore._user = { id: u.id, email: u.email,
          name: (u.user_metadata && u.user_metadata.name) || '' };
        return CloudStore._user;
      }).catch(function () { return null; });
    },

    onAuthChange: function (cb) {
      if (!window.sb) return function () {};
      var sub = window.sb.auth.onAuthStateChange(function (event, session) {
        CloudStore._user = (session && session.user)
          ? { id: session.user.id, email: session.user.email,
              name: (session.user.user_metadata && session.user.user_metadata.name) || '' }
          : null;
        try { cb(event, CloudStore._user); } catch (e) {}
      });
      return function () { try { sub.data.subscription.unsubscribe(); } catch (e) {} };
    },

    // { error?, needsConfirm? }
    signUp: function (opts) {
      if (!window.sb) return Promise.resolve({ error: 'Cloud not configured' });
      return window.sb.auth.signUp({
        email: opts.email, password: opts.password,
        options: { data: { name: opts.name || '' } }
      }).then(function (res) {
        if (res.error) return { error: friendly(res.error) };
        var user = res.data && res.data.user;
        var session = res.data && res.data.session;
        if (user) {
          CloudStore._user = { id: user.id, email: user.email, name: opts.name || '' };
          upsertProfile(user.id, opts.name || '');
        }
        // No session returned => email confirmation is required.
        return { needsConfirm: !session };
      });
    },

    signIn: function (opts) {
      if (!window.sb) return Promise.resolve({ error: 'Cloud not configured' });
      return window.sb.auth.signInWithPassword({
        email: opts.email, password: opts.password
      }).then(function (res) {
        if (res.error) return { error: friendly(res.error) };
        var user = res.data && res.data.user;
        if (user) CloudStore._user = { id: user.id, email: user.email,
          name: (user.user_metadata && user.user_metadata.name) || '' };
        return {};
      });
    },

    signOut: function () {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; pendingData = null; }
      CloudStore._user = null;
      if (!window.sb) return Promise.resolve();
      return window.sb.auth.signOut().catch(function () {});
    },

    requestPasswordReset: function (email) {
      if (!window.sb) return Promise.resolve({ error: 'Cloud not configured' });
      var redirectTo = (typeof location !== 'undefined') ? location.origin + location.pathname : undefined;
      return window.sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo })
        .then(function (res) { return res.error ? { error: friendly(res.error) } : {}; });
    },

    // Returns { data, updated_at } for the signed-in user, or null.
    loadState: function () {
      if (!window.sb || !CloudStore._user) return Promise.resolve(null);
      return window.sb.from(TABLE)
        .select('data, updated_at')
        .eq('user_id', CloudStore._user.id)
        .maybeSingle()
        .then(function (res) {
          if (res.error || !res.data) return null;
          return { data: res.data.data, updatedAt: res.data.updated_at };
        }).catch(function () { return null; });
    },

    // Debounced upsert of the whole state blob for the current user.
    saveState: function (data) {
      if (!window.sb || !CloudStore._user) return;
      pendingData = data;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },

    // Force an immediate flush (used on important transitions if needed).
    flush: function () { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } flush(); },
  };

  function flush() {
    if (!window.sb || !CloudStore._user || pendingData == null) return;
    var payload = { user_id: CloudStore._user.id, data: pendingData,
      updated_at: new Date().toISOString() };
    pendingData = null;
    try {
      window.sb.from(TABLE).upsert(payload, { onConflict: 'user_id' })
        .then(function (res) { if (res && res.error) console.warn('[cloud] save failed', res.error); },
              function (e) { console.warn('[cloud] save error', e); });
    } catch (e) { console.warn('[cloud] save threw', e); }
  }

  function upsertProfile(userId, name) {
    try {
      window.sb.from('profiles')
        .upsert({ user_id: userId, display_name: name, role: 'owner' }, { onConflict: 'user_id' })
        .then(function () {}, function () {});
    } catch (e) {}
  }

  function friendly(error) {
    var m = (error && error.message) ? error.message : String(error);
    if (/already registered|already been registered/i.test(m)) return 'That email already has an account — try logging in.';
    if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first, then log in.';
    return m;
  }

  window.CloudStore = CloudStore;
})();
