import { createElement as h, useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

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

  useEffect(() => {
    if (!containerRef.current) return undefined;
    if (playerRef.current) {
      playerRef.current.src({ src: data });
      return undefined;
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
    return undefined;
  }, [data]);

  useEffect(() => () => {
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }
  }, []);

  return h('div', { className: 'source-stage__player', 'data-vjs-player': true, ref: containerRef });
}

export const meta = {
  id: 'direct',
  label: 'Direct video',
  noun: 'Video file',
};
