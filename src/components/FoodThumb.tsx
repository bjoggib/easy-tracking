'use client';

import { useState } from 'react';

/**
 * Product photo, or a neutral placeholder when there is none or it fails to load
 * (Open Food Facts image URLs change when a newer photo is uploaded).
 */
export function FoodThumb({ src, size = 40 }: { src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="thumb" style={{ width: size, height: size }} aria-hidden="true">
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : null}
    </span>
  );
}
