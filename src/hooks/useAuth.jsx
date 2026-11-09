// Authentication context: Discord OAuth through Supabase. Exposes
// { user, profile, ready, signIn, signOut, refresh } to the whole app. When
// the backend is not configured everything degrades to guest mode without
// breaking the archive pages.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, backendConfigured } from '@/lib/backend.js';

const AuthContext = createContext({
  user: null, profile: null, ready: true,
  backendConfigured: false, authError: null,
  signIn: () => {}, signOut: () => {}, refresh: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(!backendConfigured);
  const [authError, setAuthError] = useState(null);

  // Auth events fire more often than people think: initial session, sign in,
  // and EVERY background token refresh (~hourly). Each one triggers a profile
  // load here, and those loads overlap — so every response is tagged with a
  // sequence number and a stale response is discarded instead of letting an
  // older profile overwrite a newer one (the root of several "profile flipped
  // back / panel broke later" reports).
  const loadSeq = useRef(0);

  const loadProfile = useCallback(async (sessionUser) => {
    const seq = ++loadSeq.current;
    if (!sessionUser || !supabase) { setProfile(null); return; }
    const fetchProfile = () => supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle();
    const { data, error } = await fetchProfile();
    if (seq !== loadSeq.current) return;
    if (error) {
      console.error('[Time Machine] profile load failed:', error.message);
      setAuthError('The account service is unavailable right now.'); setProfile(null); return;
    }
    // First-ever login: the profile row is created by the DB trigger moments
    // after auth confirms — retry once after a short pause before giving up.
    if (!data) {
      await new Promise((r) => setTimeout(r, 1200));
      const retry = await fetchProfile();
      if (seq !== loadSeq.current) return;
      setProfile(retry.data ?? null);
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      return loadProfile(session?.user ?? null);
    }).finally(() => setReady(true));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') setProfile(null);
      else if (session?.user) loadProfile(session.user);
      if (event === 'TOKEN_REFRESH_FAILED') setAuthError('Your session expired — sign in again.');
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Ban immediacy: the profile (and with it the ban state) is re-read when
  // the visitor returns to the tab, so a ban issued while they were away
  // shows the banner without waiting for a page reload. This is display
  // only — server-side enforcement re-reads the profile on every request.
  useEffect(() => {
    if (!backendConfigured || !user) return undefined;
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      loadProfile(user).catch(() => { /* keep the current profile */ });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [user, loadProfile]);

  const signIn = useCallback(async () => {
    if (!supabase) return;
    setAuthError(null);
    // Supabase must send the user back to the app's real address. On GitHub
    // Pages that is https://<user>.github.io/<repo>/, so the build's base
    // path (BASE_URL) has to be part of the redirect target — the bare
    // origin would land on the domain root and 404.
    const redirectTo = import.meta.env.VITE_OAUTH_REDIRECT_URL
      || `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo },
    });
    if (error) setAuthError(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
  }, []);

  const refresh = useCallback(() => loadProfile(user), [loadProfile, user]);

  const value = useMemo(() => ({
    user, profile, ready, backendConfigured, authError, signIn, signOut, refresh,
  }), [user, profile, ready, authError, signIn, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// ---- role helpers -----------------------------------------------------------

export const ROLE_RANK = { guest: 0, member: 1, checker: 2, admin: 3, owner: 4 };
export const roleAtLeast = (profile, role) =>
  ROLE_RANK[profile?.role ?? 'guest'] >= ROLE_RANK[role];
export const isStaff = (profile) => roleAtLeast(profile, 'checker');
export const isAdmin = (profile) => roleAtLeast(profile, 'admin');
export const isOwner = (profile) => profile?.role === 'owner';
