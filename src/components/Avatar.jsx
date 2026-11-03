// One identity display, used everywhere a person is named: activity log,
// review queue, account menu, detail pages. Shows the profile's avatar when
// one exists (Discord CDN URLs are public), otherwise a deterministic
// initial on an accent disc — never a raw id, never a broken image.

import { useEffect, useState } from 'react';

export default function Avatar({ name, url, size = 28 }) {
  const [failed, setFailed] = useState(false);
  // A changed URL must reset the failure flag from the previous render.
  useEffect(() => { setFailed(false); }, [url]);

  const initial = String(name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const showImage = url && !failed;

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
      aria-hidden="true"
    >
      {showImage
        ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <span className="avatar__initial">{initial}</span>}
    </span>
  );
}
