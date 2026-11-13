// One role pill, used everywhere a person is named with their authority:
// profile headers, attribution rows, contributor lists. The role NEVER comes
// from client-editable data — it rides the profile rows the backend serves
// (profiles for the signed-in user, public_profiles for public pages).

const ROLE_META = {
  owner: { label: 'Owner', icon: 'shield' },
  admin: { label: 'Admin', icon: 'shield' },
  checker: { label: 'Checker', icon: 'check' },
  member: { label: 'Member', icon: 'user' },
};

/**
 * `role` is one of owner/admin/checker/member; anything else renders
 * nothing. `showMember` controls the quiet default: the Member badge only
 * appears where it adds information (profiles), not after every name.
 */
export default function RoleBadge({ role, showMember = false, size = 'md' }) {
  const meta = ROLE_META[role];
  if (!meta || (role === 'member' && !showMember)) return null;
  return (
    <span className={`role-badge role-badge--${role} role-badge--${size}`} title={`${meta.label} of Time Machine`}>
      {meta.label}
    </span>
  );
}
