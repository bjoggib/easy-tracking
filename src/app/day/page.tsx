'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DayView } from '@/components/DayView';
import { isDateKey, todayKey } from '@/lib/dates';

function Day() {
  const d = useSearchParams().get('date');
  return <DayView date={isDateKey(d) ? d : todayKey()} />;
}

export default function DayPage() {
  return <Suspense><Day /></Suspense>;
}
