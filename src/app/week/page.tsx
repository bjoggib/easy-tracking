'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { WeekView } from '@/components/WeekView';
import { isDateKey, todayKey, weekStart } from '@/lib/dates';

function Week() {
  const s = useSearchParams().get('start');
  return <WeekView start={weekStart(isDateKey(s) ? s : todayKey())} />;
}

export default function WeekPage() {
  return <Suspense><Week /></Suspense>;
}
