// Thin client for the staff-only Edge Function endpoints. All permission
// checks happen server-side; these helpers just call and surface errors.

import { callFunction } from './backend.js';

export const submitContribution = (payload) => callFunction('contribute', payload);
export const reviewContribution = (payload) => callFunction('review', payload);
export const directEditArchive = (payload) => callFunction('direct-edit', payload);
export const manageRole = (payload) => callFunction('manage-role', payload);
export const reconcileSync = () => callFunction('reconcile-sync', {});
