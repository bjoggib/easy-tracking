'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { addDays, fmtLong, fmtShort, fmtWeekRange, fmtWeekday, todayKey, weekStart } from '@/lib/dates';
import { kg, r0, signed } from '@/lib/format';
import { dailyAvg, dayTotals } from '@/lib/macros';

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export function WeekView({ start }: { start: string }) {
  const { data } = useStore();
  const today = todayKey();
  const thisWeek = weekStart(today);
  const { kcal: tgt, p: tp } = data.settings;

  const rows = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(start, i);
    return { k, t: dayTotals(data.days[k], data.recipes), n: data.days[k]?.entries.length ?? 0, w: dailyAvg(data.weights, k) };
  });
  const logged = rows.filter(x => x.n);
  const avg = (m: 'kcal' | 'p' | 'c' | 'f') => mean(logged.map(x => x.t[m]));
  const wAvg = mean(rows.map(x => x.w).filter((v): v is number => v != null));
  const wPrev = mean(
    Array.from({ length: 7 }, (_, i) => dailyAvg(data.weights, addDays(start, i - 7))).filter((v): v is number => v != null),
  );
  const wDelta = wAvg != null && wPrev != null ? wAvg - wPrev : null;
  const aK = avg('kcal'), aP = avg('p');
  const scale = Math.max(tgt || 0, ...rows.map(x => x.t.kcal), 1);

  return (
    <>
      <div className="wnav">
        <Link className="btn quiet icon" href={`/week?start=${addDays(start, -7)}`} aria-label="Previous week">‹</Link>
        <h2>
          {start === thisWeek ? (
            <>This week <small className="range">{fmtWeekRange(start)}</small></>
          ) : (
            fmtWeekRange(start)
          )}
        </h2>
        {start !== thisWeek && <Link className="btn quiet" href="/week">This week</Link>}
        <Link className="btn quiet icon" href={`/week?start=${addDays(start, 7)}`} aria-label="Next week">›</Link>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="k">Average intake</div>
          <div className="v">{aK == null ? '—' : r0(aK)} <small>kcal</small></div>
          <div className="s">
            {logged.length
              ? `over ${logged.length} logged day${logged.length > 1 ? 's' : ''}${tgt && aK != null ? `, ${signed(aK - tgt, 0)} vs target` : ''}`
              : 'No days logged'}
          </div>
        </div>
        <div className="stat">
          <div className="k">Average protein</div>
          <div className="v">{aP == null ? '—' : r0(aP)} <small>g</small></div>
          <div className="s">{logged.length ? `${r0(avg('c'))} g carbs, ${r0(avg('f'))} g fat${tp ? `. Target ${r0(tp)} g` : ''}` : '—'}</div>
        </div>
        <div className="stat">
          <div className="k">Average weight</div>
          <div className="v">{kg(wAvg)} <small>kg</small></div>
          <div className="s">
            {wDelta != null ? `${signed(wDelta, 2)} kg vs previous week` : wAvg != null ? 'No readings the week before' : 'No readings this week'}
          </div>
        </div>
      </div>

      <ul className="wlist">
        {rows.map(({ k, t, n, w }) => {
          const seg = (v: number, c: string) => <i style={{ width: `${(v / scale) * 100}%`, background: `var(${c})` }} />;
          return (
            <li key={k}>
              <Link href={`/day?date=${k}`} className={`wrow ${k === today ? 'today' : ''} ${k > today ? 'future' : ''}`} aria-label={`Open ${fmtLong(k)}`}>
                <span className="wd"><b>{k === today ? 'Today' : fmtWeekday(k)}</b><small>{fmtShort(k)}</small></span>
                <span className="wbar">
                  <span className="fill">{n ? <>{seg(t.p * 4, '--p')}{seg(t.c * 4, '--c')}{seg(t.f * 9, '--f')}</> : null}</span>
                  {tgt ? <span className="tgt" style={{ left: `${(tgt / scale) * 100}%` }} /> : null}
                </span>
                <span className="wk">{n ? r0(t.kcal) : '—'}<small>kcal</small></span>
                <span className="wm">
                  {n ? (
                    <><span className={tp && t.p >= tp ? 'hit' : ''}>{r0(t.p)} g protein</span>, {r0(t.c)} g carbs, {r0(t.f)} g fat</>
                  ) : k > today ? 'Upcoming' : 'Nothing logged'}
                  {w != null ? `. Weight ${w.toFixed(2)} kg` : ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="hint">
        Averages count only days with food logged. The line on each bar marks your calorie target; protein turns blue on days you hit its target.
        Select a day to open it.
      </p>
    </>
  );
}
