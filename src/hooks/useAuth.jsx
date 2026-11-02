// Authentication context: Discord OAuth through Supabase. Exposes
// { user, profile, ready, signIn, signOut, refresh } to the whole app. When
// the backend is not configured everything degrades to guest mode without
// breaking the archive pages.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  const loadProfile = useCallback(async (sessionUser) => {
    if (!sessionUser || !supabase) { setProfile(null); return; }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle();
    if (error) { setAuthError('The account service is unavailable right now.'); setProfile(null); return; }
    // First-ever login: the profile row is created by the DB trigger moments
    // after auth confirms — retry once after a short pause before giving up.
    if (!data) {
      await new Promise((r) => setTimeout(r, 1200));
      const retry = await supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle();
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

  const signIn = useCallback(async () => {
    if (!supabase) return;
    setAuthError(null);
    const redirectTo = import.meta.env.VITE_OAUTH_REDIRECT_URL || window.location.origin;
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
