// Role-based access control. Roles are ALWAYS read from the profiles table
// server-side; the browser's opinion about who it is never matters.

export const ROLE_RANK = { guest: 0, member: 1, checker: 2, admin: 3, owner: 4 };

export function atLeast(role, needed) {
  return ROLE_RANK[role] !== undefined && ROLE_RANK[needed] !== undefined
    && ROLE_RANK[role] >= ROLE_RANK[needed];
}

export const isStaff = (role) => atLeast(role, 'checker');
export const isAdmin = (role) => atLeast(role, 'admin');
export const isOwner = (role) => role === 'owner';

// Checkers (and above) review, accept, decline and delete contributions, and
// may make direct archive edits — but never on their own submissions. The
// owner has ultimate authority and may also handle their own submissions.
export function canReviewContribution(role, reviewerId, contribution) {
  if (!isStaff(role)) return false;
  if (contribution && reviewerId && contribution.contributor_id === reviewerId && !isOwner(role)) return false;
  return true;
}

// A contribution's author may edit their own submission while it is pending
// (any role). Staff may additionally edit other people's pending drafts
// during review, and the owner may edit anything, always.
export function canEditContribution(actor, contribution) {
  if (!actor || !contribution) return false;
  if (contribution.status !== 'pending') return false;
  return actor.id === contribution.contributor_id || isStaff(actor.role);
}

// Admins and the owner manage checkers. Only the owner manages admins.
export function canManageCheckers(actorRole) {
  return isAdmin(actorRole);
}

export function canManageAdmins(actorRole) {
  return isOwner(actorRole);
}

const ASSIGNABLE = { checker: 'checker', admin: 'admin' };

/** Validates a manage-role request. Returns { ok } or { ok: false, code, message }. */
export function checkRoleAction(actor, action, targetRole) {
  if (!action || !['grant', 'revoke'].includes(action)) {
    return { ok: false, code: 400, message: 'action must be "grant" or "revoke".' };
  }
  if (!ASSIGNABLE[targetRole]) {
    return { ok: false, code: 400, message: 'role must be "checker" or "admin".' };
  }
  if (targetRole === 'checker' && !canManageCheckers(actor.role)) {
    return { ok: false, code: 403, message: 'Only admins and the owner can manage checkers.' };
  }
  if (targetRole === 'admin' && !canManageAdmins(actor.role)) {
    return { ok: false, code: 403, message: 'Only the owner can manage administrators.' };
  }
  return { ok: true };
}
