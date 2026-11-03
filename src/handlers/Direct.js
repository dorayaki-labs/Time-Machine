import { createElement as h, useEffect, useRef, useState } from 'react';

// video.js is ~900 kB minified and only needed the moment someone actually
// plays a direct video, so it is imported lazily: the main bundle stays lean
// and the player chunk is fetched on first use.
let videojsPromise = null;
const loadVideojs = () => {
  videojsPromise ??= Promise.all([
    import('video.js'),
    import('video.js/dist/video-js.css'),
  ]).then(([mod]) => mod.default);
  return videojsPromise;
};

/**
 * Direct handler: plays a media file that is hosted at a plain URL
 * (website.com/videos/video.mp4 and friends) through the video.js player.
 * Handles source entries of the form { type: "direct", data: "<url>" }.
 *
 * Written with createElement rather than JSX so the file can stay .js — the
 * bundler only parses JSX in .jsx files here.
 */
export default function DirectPlayer({ data }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let disposed = false;
    if (!containerRef.current) return undefined;
    setError(null);
    loadVideojs().then((videojs) => {
      if (disposed || !containerRef.current) return;
      if (playerRef.current) {
        playerRef.current.src({ src: data });
        return;
      }
      // The player element is created imperatively so React never re-renders
      // over it; StrictMode's double mount then also stays safe.
      const el = document.createElement('video-js');
      el.classList.add('video-js', 'vjs-big-play-centered', 'vjs-fill');
      containerRef.current.appendChild(el);
      playerRef.current = videojs(el, {
        controls: true,
        preload: 'metadata',
        fluid: true,
        playbackRates: [0.5, 1, 1.5, 2],
        sources: [{ src: data }],
      });
    }).catch((err) => {
      if (!disposed) setError(err.message);
    });
    return () => { disposed = true; };
  }, [data]);

  useEffect(() => () => {
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }
  }, []);

  if (error) {
    return h('div', { className: 'source-stage__placeholder', role: 'alert' },
      h('p', { className: 'source-stage__title' }, 'The player could not be loaded'),
      h('p', { className: 'source-stage__text' }, `The video player failed to load (${error}). Check the source URL or try again in a moment.`));
  }

  return h('div', { className: 'source-stage__player', 'data-vjs-player': true, ref: containerRef });
}

export const meta = {
  id: 'direct',
  label: 'Direct video',
  noun: 'Video file',
};
