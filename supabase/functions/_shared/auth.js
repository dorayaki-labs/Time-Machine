// Request authentication for Edge Functions: verifies the caller's JWT via
// the Supabase Auth API and loads their profile (roles are never trusted
// from the request body).

export async function authenticate({ authApi, db }, req) {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: { code: 401, message: 'Sign in to continue.' } };

  const { data, error } = await authApi.getUser(token);
  if (error || !data?.user) return { error: { code: 401, message: 'Your session has expired — sign in again.' } };

  let profile = await db.profileById(data.user.id);
  if (!profile) {
    // Defensive: normally the DB trigger creates the profile at first login.
    const meta = data.user.user_metadata ?? {};
    const discordId = meta.sub ?? meta.id ?? meta.provider_id ?? `unknown-${data.user.id}`;
    const row = {
      id: data.user.id,
      discord_id: String(discordId),
      username: meta.user_name ?? meta.preferred_username ?? meta.username ?? null,
      display_name: meta.full_name ?? meta.name ?? meta.user_name ?? 'Member',
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
    };
    await db.insert('profiles', row);
    profile = { ...row, role: 'member' };
  }
  return { user: data.user, profile, token };
}

/** Reads a JSON body defensively with a size cap. */
export async function readJson(req, { maxBytes = 100_000 } = {}) {
  try {
    const text = await req.text();
    if (text.length > maxBytes) return { error: 'Payload too large.' };
    return { body: JSON.parse(text) };
  } catch {
    return { error: 'Expected a JSON body.' };
  }
}
