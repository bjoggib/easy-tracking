'use client';

import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { num } from '@/lib/format';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null;
  onCommit: (value: number | null) => void;
};

/**
 * Text input for numbers that accepts "72,4" as well as "72.4".
 * Commits on blur or Enter, so partially typed values never hit storage.
 */
export function NumberField({ value, onCommit, className = 'txt', ...rest }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => setText(value == null ? '' : String(value)), [value]);

  const commit = () => {
    const v = num(text);
    if (v === value) return;
    onCommit(v);
  };

  return (
    <input
      {...rest}
      className={className}
      inputMode="decimal"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
