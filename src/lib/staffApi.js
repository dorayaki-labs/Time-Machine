// Thin client for the staff-only Edge Function endpoints. All permission
// checks happen server-side; these helpers just call and surface errors.

import { callFunction } from './backend.js';

export const submitContribution = (payload) => callFunction('contribute', payload);
// Direct record edits from detail pages: becomes a pending contribution whose
// proposed patch a checker can accept in one click.
export const submitArchiveEdit = (payload) => callFunction('archive-edit', payload);
export const reviewContribution = (payload) => callFunction('review', payload);
export const directEditArchive = (payload) => callFunction('direct-edit', payload);
export const manageRole = (payload) => callFunction('manage-role', payload);
export const reconcileSync = () => callFunction('reconcile-sync', {});

// Owner panel (user management). The server enforces owner-only access on
// every one of these; the frontend merely hides what the role cannot use.
export const listUsers = (filters = {}) => callFunction('manage-users', { action: 'list', ...filters });
export const setUserRole = (userId, role, reason) => callFunction('manage-users', { action: 'set-role', userId, role, reason: reason ?? null });
export const banUser = (userId, reason) => callFunction('manage-users', { action: 'ban', userId, reason: reason ?? null });
export const unbanUser = (userId) => callFunction('manage-users', { action: 'unban', userId });
export const setUserRoleByDiscord = (discordId, role) => callFunction('manage-users', { action: 'set-role', discordId, role });
export const banUserByDiscord = (discordId, reason) => callFunction('manage-users', { action: 'ban', discordId, reason: reason ?? null });
export const unbanUserByDiscord = (discordId) => callFunction('manage-users', { action: 'unban', discordId });
