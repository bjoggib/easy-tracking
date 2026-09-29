'use client';

import { useEffect, useRef, useState } from 'react';

/** Open Food Facts serves each photo at .100/.200/.400.jpg and the original at .full.jpg. */
const sized = (src: string, size: '400' | 'full') => src.replace(/\.(\d+|full)\.jpg$/, `.${size}.jpg`);

/**
 * Product photo, or a neutral placeholder when there is none or it fails to load
 * (Open Food Facts image URLs change when a newer photo is uploaded).
 * With `zoomable`, clicking opens a larger version.
 */
export function FoodThumb({ src, size = 40, zoomable, alt = '' }: { src?: string; size?: number; zoomable?: boolean; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const shown = src && !failed;
  const img = shown ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : null;

  if (!zoomable || !shown) {
    return (
      <span className="thumb" style={{ width: size, height: size }} aria-hidden="true">
        {img}
      </span>
    );
  }
  return (
    <>
      <button type="button" className="thumb zoom" style={{ width: size, height: size }} aria-label={`Show a larger photo${alt ? ` of ${alt}` : ''}`} onClick={() => setOpen(true)}>
        {img}
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    // Show the 400 px version at once; swap in the original when it has loaded.
    const pre = new Image();
    pre.onload = () => setFull(true);
    pre.src = sized(src, 'full');
    return () => { pre.onload = null; };
  }, [src]);

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={alt || 'Product photo'}
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) ref.current?.close(); }}
    >
      <img src={full ? sized(src, 'full') : sized(src, '400')} alt={alt} />
      <button type="button" className="btn icon close" aria-label="Close" onClick={() => ref.current?.close()}>×</button>
    </dialog>
  );
}
