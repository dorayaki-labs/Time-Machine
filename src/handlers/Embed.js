import { createElement as h } from 'react';

/**
 * Embed handler: shows an embed exactly as the provider serves it — no player
 * of our own. The data may be the full iframe HTML
 *   { "type": "embed", "data": "<iframe src=\"https://...\"></iframe>" }
 * or just the embed URL, which is wrapped in an iframe here.
 *
 * Written with createElement rather than JSX so the file can stay .js — the
 * bundler only parses JSX in .jsx files here.
 */
export default function EmbedPlayer({ data }) {
  if (data.trim().startsWith('<')) {
    return h('div', {
      className: 'source-stage__embed',
      dangerouslySetInnerHTML: { __html: data },
    });
  }
  return h('div', { className: 'source-stage__embed' },
    h('iframe', {
      src: data,
      title: 'Embedded video',
      allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture',
      allowFullScreen: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }));
}

export const meta = {
  id: 'embed',
  label: 'Embed',
  noun: 'Embedded player',
};
