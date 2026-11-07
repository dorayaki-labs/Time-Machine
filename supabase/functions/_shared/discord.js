// Discord webhook notifications. The webhook URL lives only in the
// DISCORD_WEBHOOK_URL function secret — it never reaches the browser.
//
// Delivery is outbox-based for idempotence: one row per event key. If the
// webhook call fails the row stays 'pending' and the next function invocation
// retries stale rows, so notifications can be delayed but never lost or
// duplicated. Notification failure NEVER fails the business operation.

const EMBED_COLOR = {
  submitted: 0x5865f2,   // Discord blurple
  accepted: 0x57f287,    // green
  declined: 0xed4245,    // red
  deleted: 0x95a5a6,     // grey
  direct_edit: 0xfee75c, // yellow
  role: 0xeb459e,        // pink
};

/** Strips anything that could turn user text into a mention. */
export function sanitize(text) {
  return String(text ?? '')
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere')
    .replace(/<@!?(\d+)>/g, '[mention]')
    .replace(/\u200b{2,}/g, '\u200b')
    .slice(0, 900);
}

export function truncate(text, n = 1000) {
  const s = String(text ?? '');
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// Human words for the contribution type ids (the same ids the forms submit).
const TYPE_LABELS = {
  'missing-entry': 'new entry',
  'metadata-correction': 'a correction',
  character: 'a character',
  gadget: 'a gadget',
  images: 'images',
  source: 'a viewing source',
  'broken-source': 'a broken source',
  'archive-edit': 'a record edit',
};

/**
 * Builds the embed for an event.
 *
 * Layout: the description carries the one-glance summary — bold title, who
 * did what, which entry, which commit — as short markdown lines. Only the
 * long-form content (a reason, a field-by-field change list) goes into
 * named fields below it. This keeps a busy channel readable: the summary is
 * always the same shape, and the detail is clearly separated underneath.
 */
export function buildEmbed(event, data) {
  const fields = [];
  const push = (name, value) => {
    if (value !== undefined && value !== null && value !== '') {
      fields.push({ name, value: truncate(String(value), 1000), inline: false });
    }
  };
  const who = (name) => sanitize(name ?? 'unknown');
  const line = (...parts) => parts.filter((p) => p !== undefined && p !== null && p !== '').join(' · ');
  const entryPart = data.entry ? `\`${data.entry}\`` : '';

  let title = '';
  let description = '';
  switch (event) {
    case 'submitted':
      title = `📝 Contribution #${data.number} submitted`;
      description = [
        `**${sanitize(data.title)}**`,
        line(`by **${who(data.contributor)}**`, TYPE_LABELS[data.type] ?? data.type ?? 'contribution', entryPart),
      ].join('\n');
      push('Notes', sanitize(data.notes));
      break;
    case 'accepted':
      title = `✅ Contribution #${data.number} accepted`;
      description = [
        `**${sanitize(data.title)}**`,
        line(`by **${who(data.contributor)}**`, `accepted by **${who(data.reviewer)}**`, entryPart, data.commit ? `commit \`${data.commit}\`` : null),
      ].join('\n');
      push('Changed fields', data.changes);
      break;
    case 'declined':
      title = `❌ Contribution #${data.number} declined`;
      description = [
        `**${sanitize(data.title)}**`,
        line(`by **${who(data.contributor)}**`, `declined by **${who(data.reviewer)}**`, entryPart),
      ].join('\n');
      push('Reason', sanitize(data.reason));
      break;
    case 'deleted':
      title = `🗑️ Contribution #${data.number} deleted`;
      description = [
        `**${sanitize(data.title)}**`,
        line(`by **${who(data.contributor)}**`, `deleted by **${who(data.reviewer)}**`, entryPart),
      ].join('\n');
      push('Reason', sanitize(data.reason));
      break;
    case 'direct_edit':
      title = `✏️ Direct archive edit`;
      description = [
        `**${who(data.reviewer)}** edited ${entryPart || 'an archive record'}`,
        line(data.commit ? `commit \`${data.commit}\`` : null),
      ].join('\n');
      push('Changed fields', data.changes);
      break;
    case 'entry_deleted':
      title = `🗑️ Archive entry deleted`;
      description = [
        `**${who(data.reviewer)}** deleted ${entryPart || 'an archive record'}`,
        line(data.commit ? `commit \`${data.commit}\`` : null),
      ].join('\n');
      break;
    case 'edited':
      title = `🛠️ Contribution #${data.number} edited`;
      description = [
        `**${sanitize(data.title)}**`,
        line(`draft edited by **${who(data.reviewer)}**`, `original author **${who(data.contributor)}**`),
      ].join('\n');
      break;
    case 'role':
      title = `🔐 Role updated`;
      description = `**${who(data.actor)}** ${data.action === 'revoke' ? 'revoked' : 'granted'} the **${data.role}** role for **${who(data.target)}**`;
      break;
    default:
      title = `Time Machine: ${event}`;
      description = line(who(data.reviewer), who(data.contributor), entryPart);
  }

  return {
    username: 'Time Machine',
    embeds: [{
      title: truncate(title, 250),
      description: truncate(description, 3500) || undefined,
      color: EMBED_COLOR[event.split('.')[0]] ?? EMBED_COLOR.submitted,
      fields,
      footer: { text: 'Time Machine archive' },
      timestamp: new Date().toISOString(),
    }],
    // Nothing the payload contains can ever trigger a ping.
    allowed_mentions: { parse: [] },
  };
}

/**
 * Records an event in the outbox (idempotent via event_key: one notification
 * per event, ever) and attempts IMMEDIATE delivery. If the webhook call
 * fails, the row stays pending and the next function invocation retries it
 * through flushOutbox — notifications can be delayed but never lost or
 * duplicated. Notification failure NEVER fails the business operation.
 */
export async function notify(db, webhookUrl, eventKey, event, data) {
  try {
    await db.insert('notification_outbox', { event_key: eventKey, event, payload: data });
  } catch (err) {
    // Unique-violation = already queued; anything else is logged, not fatal.
    console.error('outbox insert failed', eventKey, err.message);
    return;
  }
  if (!webhookUrl) {
    console.warn(`notification "${event}" queued but DISCORD_WEBHOOK_URL is not configured — set it with: supabase secrets set DISCORD_WEBHOOK_URL=...`);
    return;
  }
  try {
    const row = await db.outboxByKey(eventKey);
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
  const body = buildEmbed(row.event, row.payload ?? {});
  await deliver(webhookUrl, body);
  return true;
}

/**
 * Called at the end of every function invocation: retries pending rows that
 * are older than 30 seconds, a few at a time. Failures mark attempts and
 * leave the row pending (bounded retry, no duplicates thanks to event_key).
 */
export async function flushOutbox(db, webhookUrl, { limit = 3 } = {}) {
  if (!webhookUrl) return;
  try {
    const rows = await db.staleOutbox(limit);
    for (const row of rows) {
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
