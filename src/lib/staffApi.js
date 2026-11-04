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
