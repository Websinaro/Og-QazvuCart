'use client';

import React, { useEffect, useState } from 'react';
import NextImage, { type ImageProps } from 'next/image';
import { Package } from '@/src/components/ui/icons';

/**
 * Drop-in replacement for next/image that never leaves a blank hole.
 *  - Hosts that aren't in next.config `images.remotePatterns` (sellers can paste
 *    any image URL) are loaded directly by the browser instead of throwing.
 *  - A broken or slow-failing URL falls back to a neutral placeholder.
 */
const OPTIMIZED_HOSTS = new Set(['picsum.photos', 'images.unsplash.com', 'res.cloudinary.com']);

function canOptimize(src: ImageProps['src']): boolean {
  if (typeof src !== 'string') return true;
  if (src.startsWith('/')) return true;
  if (src.startsWith('data:') || src.startsWith('blob:')) return false;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && OPTIMIZED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export default function SafeImage({ src, alt, className, onError, fill, width, height, style, ...rest }: ImageProps) {
  const [failed, setFailed] = useState(false);

  // A new src gets a fresh chance to load.
  useEffect(() => setFailed(false), [src]);

  const empty = typeof src === 'string' && !src.trim();

  if (failed || empty) {
    return (
      <div
        role="img"
        aria-label={alt || 'Image unavailable'}
        className={`grid place-items-center bg-brand-50 dark:bg-neutral-900 text-brand-700/50 dark:text-brand-300/40 ${
          fill ? 'absolute inset-0' : ''
        }`}
        style={fill ? undefined : { width, height, ...style }}
      >
        <Package className="w-1/4 h-1/4 min-w-5 min-h-5 max-w-12 max-h-12" />
      </div>
    );
  }

  return (
    <NextImage
      {...rest}
      src={src}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      style={style}
      className={className}
      unoptimized={rest.unoptimized ?? !canOptimize(src)}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
}
