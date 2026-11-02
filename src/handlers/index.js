import Direct, { meta as directMeta } from './Direct.js';
import Embed, { meta as embedMeta } from './Embed.js';

/**
 * The source handlers. Each handles one kind of viewing source entry:
 *   direct — a plain media file URL, played through video.js
 *   embed  — an iframe from a provider, shown as-is with no player of ours
 * Anything else (a bare outbound link, an unknown type) falls through to the
 * plain-link row in SourceList.
 */
export const HANDLERS = {
  direct: { ...directMeta, Player: Direct },
  embed: { ...embedMeta, Player: Embed },
};

export const handlerFor = (source) => HANDLERS[source?.type] ?? null;
