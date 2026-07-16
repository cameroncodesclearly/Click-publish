// In-memory Supabase stub for headless tests (this sandbox can't reach the real
// Supabase). Injected as window.sb BEFORE the app boots; the `window.sb ||`
// guard in the built page then keeps this instead of creating a real client.
//
// "Server" state (users, per-user app_states rows, current session) lives in
// localStorage so a page reload behaves like a real backend round-trip.
(function () {
  var SESSION = '__mock_session', STORE = '__mock_app_states', USERS = '__mock_users';
  function read(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0; return h; }
  function session() { return read(SESSION, null); }

  var listeners = [];
  function emit(event) { var s = session(); listeners.forEach(function (cb) { try { cb(event, s); } catch (e) {} }); }

  var auth = {
    getSession: function () { return Promise.resolve({ data: { session: session() }, error: null }); },
    onAuthStateChange: function (cb) {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe: function () { var i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } } } };
    },
    signUp: function (opts) {
      var users = read(USERS, {}), email = (opts.email || '').toLowerCase();
      if (users[email]) return Promise.resolve({ data: { user: null, session: null }, error: { message: 'User already registered' } });
      var name = (opts.options && opts.options.data && opts.options.data.name) || '';
      var id = 'u_' + Math.abs(hash(email)).toString(36);
      users[email] = { id: id, password: opts.password, name: name }; write(USERS, users);
      var user = { id: id, email: email, user_metadata: { name: name } };
      var s = { user: user, access_token: 'mock' }; write(SESSION, s); emit('SIGNED_IN');
      return Promise.resolve({ data: { user: user, session: s }, error: null });
    },
    signInWithPassword: function (opts) {
      var users = read(USERS, {}), email = (opts.email || '').toLowerCase(), u = users[email];
      if (!u || u.password !== opts.password) return Promise.resolve({ data: { user: null, session: null }, error: { message: 'Invalid login credentials' } });
      var user = { id: u.id, email: email, user_metadata: { name: u.name } };
      var s = { user: user, access_token: 'mock' }; write(SESSION, s); emit('SIGNED_IN');
      return Promise.resolve({ data: { user: user, session: s }, error: null });
    },
    signOut: function () { localStorage.removeItem(SESSION); emit('SIGNED_OUT'); return Promise.resolve({ error: null }); },
    resetPasswordForEmail: function () { return Promise.resolve({ data: {}, error: null }); }
  };

  function from(table) {
    var filter = null;
    var api = {
      select: function () { return api; },
      eq: function (col, val) { filter = { col: col, val: val }; return api; },
      maybeSingle: function () {
        var store = read(STORE, {});
        return Promise.resolve({ data: store[table + ':' + (filter ? filter.val : '')] || null, error: null });
      },
      single: function () { return api.maybeSingle(); },
      upsert: function (payload) {
        var store = read(STORE, {});
        store[table + ':' + payload.user_id] = { user_id: payload.user_id, data: payload.data, updated_at: payload.updated_at };
        write(STORE, store);
        return Promise.resolve({ data: [payload], error: null });
      }
    };
    return api;
  }

  window.sb = { auth: auth, from: from };
})();
