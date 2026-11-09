// Discord webhook notifications. The webhook URLs live only in the
// DISCORD_WEBHOOK_URL and DISCORD_BAN_WEBHOOK_URL function secrets — they
// never reach the browser.
//
// Delivery is outbox-based for idempotence: one row per event key. If the
// webhook call fails the row stays 'pending' and the next function invocation
// retries stale rows, so notifications can be delayed but never lost or
// duplicated. Notification failure NEVER fails the business operation.
//
// Ban and unban events are routed to their own webhook (a dedicated
// moderation channel); when that secret is not configured the outbox row is
// marked 'skipped' so the ban itself is never affected and the row is not
// retried forever.

export const LOGO_URL = 'https://i.postimg.cc/6qzcdwGB/t-Bot-Img.png';
export const BAN_HAMMER_URL = 'https://i.postimg.cc/sXxQdjQB/ban.png';
export const SITE_URL = 'https://timemachine.website';
const GITHUB_REPO = 'dorayaki-labs/time-machine';

// One visual identity for every log: same author block, per-event icon and
// accent colour. Discord embed limits: title 256, description 4096, 25
// fields, field name 256, field value 1024, footer 2048, total 6000 — all
// enforced in finalizeEmbed() below.
const EVENT_STYLE = {
  submitted:     { icon: '📝', label: 'Contribution Submitted', color: 0x5865f2 },
  accepted:      { icon: '✅', label: 'Contribution Accepted',  color: 0x57f287 },
  declined:      { icon: '❌', label: 'Contribution Rejected',  color: 0xed4245 },
  deleted:       { icon: '🗑️', label: 'Contribution Deleted',   color: 0x99aab5 },
  edited:        { icon: '🛠️', label: 'Contribution Edited',    color: 0xe67e22 },
  direct_edit:   { icon: '✏️', label: 'Direct Archive Edit',    color: 0xfee75c },
  entry_created: { icon: '🌱', label: 'Archive Record Created', color: 0x57f287 },
  entry_deleted: { icon: '🗑️', label: 'Archive Record Deleted', color: 0xed4245 },
  role:          { icon: '🔐', label: 'Role Updated',           color: 0xeb459e },
  banned:        { icon: '🔨', label: 'User Banned',            color: 0x8b1a1a },
  unbanned:      { icon: '🕊️', label: 'Ban Lifted',             color: 0x2ecc71 },
};

const CHANGE_ICON = { added: '🟢', removed: '🔴', modified: '🟠' };

// Human labels for the contribution type ids the forms submit.
const TYPE_LABELS = {
  'missing-entry': 'New entry',
  'metadata-correction': 'Metadata correction',
  character: 'Character',
  gadget: 'Gadget',
  images: 'Images',
  source: 'Viewing source',
  'broken-source': 'Broken source',
  'archive-edit': 'Record edit',
};

/** Strips anything that could turn user text into a mention or a ping. */
export function sanitize(text) {
  return String(text ?? '')
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere')
    .replace(/<@!?(\d+)>/g, '[mention]')
    .replace(/\u200b{2,}/g, '\u200b');
}

export function truncate(text, n = 1000) {
  const s = String(text ?? '');
  if (n <= 0) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Compact, single-line rendering of a diff value for an embed field. */
function valueLine(value, { max = 180 } = {}) {
  if (value === null || value === undefined || value === '') return '`null`';
  let s;
  if (typeof value === 'string') s = value;
  else if (typeof value === 'number' || typeof value === 'boolean') s = String(value);
  else {
    // Objects/arrays: keep them recognisable but short.
    const json = JSON.stringify(value);
    s = json.length > 60 ? `${Array.isArray(value) ? `[array of ${value.length}]` : '{object}'}` : json;
  }
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '`null`';
  return truncate(s, max);
}

/** Normalises the people fields of a payload into a consistent shape. */
function person(p) {
  if (!p || typeof p !== 'object') {
    // Old-format payloads pass a plain display-name string; render those too.
    const name = typeof p === 'string' && p.trim() ? p : null;
    return name ? { name, username: null, discordId: null, avatar: null } : null;
  }
  const name = p.name ?? p.display_name ?? null;
  if (!name && !p.username && !p.discordId) return null;
  return {
    name: sanitize(name ?? p.username ?? 'Unknown'),
    username: p.username ? sanitize(p.username) : null,
    discordId: p.discordId ?? p.discord_id ?? null,
    avatar: typeof p.avatar === 'string' && /^https?:\/\//.test(p.avatar) ? p.avatar : null,
  };
}

/** "Name (@handle · ID 123)" — the standard identity line used everywhere. */
export function personLine(p) {
  const who = person(p);
  if (!who) return 'Unknown';
  const handle = who.username && who.username !== who.name ? ` (@${who.username})` : '';
  const id = who.discordId ? ` · ID \`${who.discordId}\`` : '';
  return `**${who.name}**${handle}${id}`;
}

/** Canonical payload shape for a person, built from a profiles row. */
export const profileRef = (p) => (p ? {
  name: p.display_name ?? null,
  username: p.username ?? null,
  discordId: p.discord_id ?? null,
  avatar: p.avatar_url ?? null,
} : null);

function entryLine(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return `\`${entry}\``;
  const kind = entry.type ? `${entry.type[0].toUpperCase()}${entry.type.slice(1)}` : null;
  const id = entry.id ? `\`${entry.id}\`` : null;
  const name = entry.name ? ` — ${truncate(sanitize(entry.name), 80)}` : '';
  return [kind, id].filter(Boolean).join(' ') + name;
}

function commitLine(sha) {
  if (!sha) return null;
  const short = String(sha).slice(0, 7);
  return `[\`${short}\`](https://github.com/${GITHUB_REPO}/commit/${sha})`;
}

function changeKind(before, after) {
  const had = before !== null && before !== undefined;
  const has = after !== null && after !== undefined;
  if (had && has) return 'modified';
  if (has) return 'added';
  return 'removed';
}

function changeValue(kind, before, after) {
  if (kind === 'added') return `**After:** ${valueLine(after)}`;
  if (kind === 'removed') return `**Before:** ${valueLine(before)}`;
  return `**Before:** ${valueLine(before)}\n**After:** ${valueLine(after)}`;
}

// Embed field budget for change lists: 25 fields max, and the last one may
// be the overflow notice — leave headroom for the identity/record fields.
const MAX_CHANGE_FIELDS = 16;

function changeFields(changes) {
  const list = Array.isArray(changes) ? changes.filter((c) => c && (c.field ?? c.path)) : [];
  if (!list.length) return [];
  const fields = [];
  for (const change of list.slice(0, MAX_CHANGE_FIELDS)) {
    const path = truncate(sanitize(change.field ?? change.path), 200);
    const kind = changeKind(change.before, change.after);
    fields.push({
      name: `${CHANGE_ICON[kind]} ${path}`,
      value: changeValue(kind, change.before, change.after),
      inline: false,
    });
  }
  if (list.length > MAX_CHANGE_FIELDS) {
    fields.push({
      name: '…and more',
      value: `${list.length - MAX_CHANGE_FIELDS} further field(s) changed — see the commit for the full diff.`,
      inline: false,
    });
  }
  return fields;
}

/**
 * Builds the embed body for an event. Payloads are structured (see the
 * handlers): { actor, contributor, reviewer, target, entry, commit, changes,
 * notes, reason, number, title, role } — every field optional, and the
 * builder degrades gracefully when a piece is missing or arrives in the old
 * plain-string shape.
 */
export function buildEmbed(event, data = {}) {
  const style = EVENT_STYLE[event] ?? { icon: '🗂️', label: 'Archive Event', color: 0x5865f2 };
  const fields = [];
  const add = (name, value, inline = false) => {
    if (value === undefined || value === null || value === '') return;
    fields.push({ name, value: truncate(String(value), 1000), inline });
  };

  // --- header block: who did it, exactly like an audit log entry -----------
  const actor = person(data.actor ?? data.reviewer);
  const descriptionParts = [];
  if (actor) descriptionParts.push(`**Action by** ${personLine(actor)}`);
  if (data.title) descriptionParts.push(`**${sanitize(data.title)}**${data.number ? ` · #${data.number}` : ''}`);

  // --- people --------------------------------------------------------------
  const contributor = person(data.contributor);
  const reviewer = person(data.reviewer ?? data.actor);
  if (contributor) add('📝 Contributor', personLine(contributor));
  if (reviewer && data.contributor) add('🔍 Reviewer', personLine(reviewer));

  // --- what ----------------------------------------------------------------
  const entry = entryLine(data.entry);
  if (entry) add('📦 Record', entry);
  if (data.type) add('🗂️ Submission type', TYPE_LABELS[data.type] ?? sanitize(data.type));
  if (data.role) {
    add('🔐 Role', `${data.action ? `${sanitize(String(data.action))} ` : ''}\`${sanitize(data.role)}\``);
  }
  const commit = commitLine(data.commit);
  if (commit) add('🔖 Commit', commit);
  if (data.reason) add('❔ Reason', sanitize(data.reason));
  if (data.notes && !data.changes) add('🗒️ Notes', sanitize(data.notes));

  // --- changed fields, one section each -------------------------------------
  if (data.changes) {
    const cf = changeFields(data.changes);
    if (cf.length) fields.push(...cf);
    else add('🗒️ Changes', 'No archive file changes were needed (already up to date).');
  }

  const embed = {
    author: { name: 'Time Machine Logs', icon_url: LOGO_URL, url: SITE_URL },
    title: truncate(`${style.icon} ${style.label}${data.number ? ` · #${data.number}` : ''}`, 256),
    color: style.color,
    description: truncate(descriptionParts.join('\n'), 3500) || undefined,
    fields: fields.slice(0, 25),
    footer: { text: 'Time Machine · audit log' },
    timestamp: new Date().toISOString(),
  };
  return finalizeEmbed(embed);
}

/** The ban/unban notification: same identity, its own channel and humour. */
export function buildBanEmbed(event, data = {}) {
  const target = person(data.target);
  const actor = person(data.actor ?? data.reviewer);
  const name = target?.name ?? 'Someone';
  const unbanned = event === 'unbanned';

  const fields = [];
  if (target) {
    fields.push({
      name: '👤 User',
      value: `${personLine(target)}${target.discordId ? `\nID: \`${target.discordId}\`` : ''}`,
      inline: true,
    });
  }
  if (actor) fields.push({ name: '🛡️ Action by', value: personLine(actor), inline: true });
  if (!unbanned) {
    fields.push({
      name: '📜 Reason',
      value: data.reason ? truncate(sanitize(data.reason), 900) : '*No reason recorded — the hammer strikes in mysterious ways.*',
      inline: false,
    });
  }

  const embed = {
    author: { name: 'Time Machine Logs', icon_url: LOGO_URL, url: SITE_URL },
    title: truncate(unbanned
      ? `🕊️ ${name} has been pardoned`
      : `🔨 ${name} was struck by the ban hammer!`, 256),
    color: unbanned ? 0x2ecc71 : 0x8b1a1a,
    description: unbanned
      ? 'The ban hammer has been quietly returned to its shelf. Their contributions and edits are welcome in the timeline once more.'
      : 'The Time Patrol has confiscated their editing licence. Contributions are closed until the judges say otherwise.',
    fields,
    footer: { text: 'Time Machine · moderation' },
    timestamp: new Date().toISOString(),
  };
  if (target?.avatar) embed.thumbnail = { url: target.avatar };
  if (!unbanned) embed.image = { url: BAN_HAMMER_URL };
  return finalizeEmbed(embed);
}

/** Enforces Discord's embed limits on any embed body. */
export function finalizeEmbed(embed) {
  const out = { ...embed };
  out.title = out.title ? truncate(out.title, 256) : undefined;
  out.description = out.description ? truncate(out.description, 4096) : undefined;
  if (out.author) {
    out.author = { ...out.author, name: truncate(out.author.name ?? '', 256) };
  }
  if (out.footer) {
    out.footer = { text: truncate(out.footer.text ?? '', 2048) };
  }
  out.fields = (out.fields ?? []).slice(0, 25).map((f) => ({
    name: truncate(f.name ?? '\u200b', 256),
    value: truncate(f.value ?? '\u200b', 1024),
    inline: Boolean(f.inline),
  }));
  const fixedSize = () => (out.title?.length ?? 0) + (out.description ? 0 : 0)
    + (out.footer?.text?.length ?? 0) + (out.author?.name?.length ?? 0)
    + out.fields.reduce((n, f) => n + f.name.length + f.value.length, 0);
  // Discord's 6000-character total: drop tail fields first (identity and
  // record fields come first and must survive), then compress the
  // description into whatever budget the rest leaves.
  while (fixedSize() + (out.description?.length ?? 0) > 6000 && out.fields.length > 1) {
    out.fields.pop();
  }
  if (out.description) {
    const budget = Math.max(0, 6000 - fixedSize());
    if (out.description.length > budget) out.description = truncate(out.description, budget);
  }
  return out;
}

/** Builds the full webhook body (embed + bot identity + mention safety). */
export function buildMessage(event, data) {
  const isBanEvent = event === 'banned' || event === 'unbanned';
  const embed = isBanEvent ? buildBanEmbed(event, data) : buildEmbed(event, data);
  return {
    username: 'Time Machine Logs',
    avatar_url: LOGO_URL,
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };
}

/** Ban events go to the dedicated moderation channel when one is configured. */
export function webhookFor(event, webhooks) {
  const urls = webhooks ?? {};
  const ban = event === 'banned' || event === 'unbanned';
  return ban ? (urls.ban || null) : (urls.main || null);
}

/**
 * Records an event in the outbox and attempts IMMEDIATE delivery.
 * `webhooks` is { main, ban }; ban events use `ban`, everything else `main`.
 */
export async function notify(db, webhooks, eventKey, event, data) {
  try {
    await db.insert('notification_outbox', { event_key: eventKey, event, payload: data });
  } catch (err) {
    console.error('outbox insert failed', eventKey, err.message);
    return;
  }
  const row = await db.outboxByKey(eventKey).catch(() => null);
  const webhookUrl = webhookFor(event, webhooks);
  if (!webhookUrl) {
    console.warn(`notification "${event}" recorded but its webhook is not configured`
      + `${event === 'banned' || event === 'unbanned' ? ' (DISCORD_BAN_WEBHOOK_URL)' : ' (DISCORD_WEBHOOK_URL)'}.`);
    if (row) await db.markOutbox(row.id, 'skipped').catch(() => {});
    return;
  }
  try {
    if (!row || row.status !== 'pending') return;
    await deliverRow(webhookUrl, row);
    await db.markOutbox(row.id, 'sent');
  } catch (err) {
    console.error(`webhook delivery failed for "${event}" (${eventKey}):`, err.message);
    try { await db.markOutbox((await db.outboxByKey(eventKey))?.id, 'pending', err.message); }
    catch (markErr) { console.error('outbox mark failed', eventKey, markErr.message); }
  }
}

async function deliver(webhookUrl, body) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Discord webhook responded ${res.status}`);
  }
}

/** Attempts delivery of one outbox row. Returns true when sent. */
export async function deliverRow(webhookUrl, row) {
  const body = buildMessage(row.event, row.payload ?? {});
  await deliver(webhookUrl, body);
  return true;
}

/**
 * Called at the end of every function invocation: retries pending rows.
 * Rows for unconfigured webhooks are marked skipped, never retried forever.
 */
export async function flushOutbox(db, webhooks, { limit = 3 } = {}) {
  try {
    const rows = await db.staleOutbox(limit);
    for (const row of rows) {
      const webhookUrl = webhookFor(row.event, webhooks);
      if (!webhookUrl) {
        await db.markOutbox(row.id, 'skipped').catch(() => {});
        continue;
      }
      try {
        await deliverRow(webhookUrl, row);
        await db.markOutbox(row.id, 'sent');
      } catch (err) {
        await db.markOutbox(row.id, 'pending', err.message);
      }
    }
  } catch (err) {
    console.error('outbox flush failed', err.message);
  }
}
