'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { addDays, daysBetween, fmtRow, fmtShort, todayKey } from '@/lib/dates';
import { signed } from '@/lib/format';
import { dailyAvg, rolling } from '@/lib/macros';
import type { WeightEntry } from '@/lib/types';
import { useUnits, type Units } from '@/lib/units';
import { NumberField } from './NumberField';

type Range = '30' | '90' | 'all';

export function WeightView() {
  const { data, setWeight, toast } = useStore();
  const u = useUnits();
  const [date, setDate] = useState(todayKey());
  const [range, setRange] = useState<Range>('30');
  const w = data.weights[date];

  const days = Object.keys(data.weights).filter(k => dailyAvg(data.weights, k) != null).sort();
  const latest = days.filter(k => k <= todayKey()).pop() ?? days[days.length - 1];
  const roll = latest ? rolling(data.weights, latest) : null;
  const rollPrev = latest ? rolling(data.weights, addDays(latest, -7)) : null;
  const delta = roll && rollPrev ? roll.avg - rollPrev.avg : null;
  const recent = days.slice(-21).reverse();

  const commit = (field: 'am' | 'pm') => (v: number | null) => {
    const kg = v == null ? null : u.bodyIn(v);
    if (kg != null && (kg < 20 || kg > 400)) return toast(`That weight looks off. Enter it in ${u.body === 'lb' ? 'pounds' : 'kilograms'}.`);
    setWeight(date, field, kg);
  };
  /** Stored kg shown in the chosen unit, rounded so pounds don't show float noise. */
  const shown = (kg: number | null | undefined) => (kg == null ? null : Number(u.bodyOut(kg).toFixed(u.body === 'lb' ? 1 : 3)));

  return (
    <>
      <h2>Weight</h2>
      <div className="wform">
        <label className="fld wd">
          Date
          <input className="txt" type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="fld">
          Morning ({u.body})
          <NumberField key={`am-${date}-${u.system}`} value={shown(w?.am)} placeholder="—" onCommit={commit('am')} />
        </label>
        <label className="fld">
          Evening ({u.body})
          <NumberField key={`pm-${date}-${u.system}`} value={shown(w?.pm)} placeholder="—" onCommit={commit('pm')} />
        </label>
      </div>
      <p className="hint">Saves as you leave each field. Daily average uses whichever readings exist for that day.</p>

      <div className="stats">
        <div className="stat">
          <div className="k">Daily average</div>
          <div className="v">{u.fmtBody(latest ? dailyAvg(data.weights, latest) : null)} <small>{u.body}</small></div>
          <div className="s">{latest ? fmtShort(latest) : 'No readings yet'}</div>
        </div>
        <div className="stat">
          <div className="k">7-day average</div>
          <div className="v">{u.fmtBody(roll?.avg)} <small>{u.body}</small></div>
          <div className="s">{roll ? `from ${roll.n} of the last 7 days` : '—'}</div>
        </div>
        <div className="stat">
          <div className="k">vs a week earlier</div>
          <div className="v">{delta == null ? '—' : signed(u.bodyOut(delta), u.bodyDigits)} <small>{u.body}</small></div>
          <div className="s">change in the 7-day average</div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 26 }}>
        <h3 style={{ margin: 0 }}>Trend</h3>
        <div className="seg" role="group" aria-label="Chart range">
          {([['30', '30 days'], ['90', '90 days'], ['all', 'All']] as const).map(([v, l]) => (
            <button key={v} aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>
          ))}
        </div>
      </div>
      <WeightChart weights={data.weights} range={range} u={u} />
      <div className="legend"><span className="dots">Daily average</span><span>7-day average</span></div>

      {recent.length > 0 && (
        <>
          <h3>Recent days</h3>
          <div className="tablebox">
            <table className="wt">
              <thead>
                <tr><th>Date</th><th>Morning</th><th>Evening</th><th>Average</th><th>7-day</th></tr>
              </thead>
              <tbody>
                {recent.map(k => {
                  const x = data.weights[k];
                  const pick = () => { setDate(k); window.scrollTo(0, 0); };
                  return (
                    <tr key={k} className={`pick ${k === date ? 'sel' : ''}`} tabIndex={0} onClick={pick}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}>
                      <td>{fmtRow(k)}</td><td>{u.fmtBody(x.am)}</td><td>{u.fmtBody(x.pm)}</td>
                      <td>{u.fmtBody(dailyAvg(data.weights, k))}</td><td>{u.fmtBody(rolling(data.weights, k)?.avg)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">Select a row to edit that day.</p>
        </>
      )}
    </>
  );
}

const STEPS = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];

function WeightChart({ weights, range, u }: { weights: Record<string, WeightEntry>; range: Range; u: Units }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = Object.keys(weights).filter(k => dailyAvg(weights, k) != null).sort();
  if (days.length < 2) {
    return <div id="chartBox" ref={box}><p className="empty" style={{ padding: '28px 16px' }}>Log at least two days to see a trend.</p></div>;
  }

  const end = days[days.length - 1];
  let start = range === 'all' ? days[0] : addDays(end, -(Number(range) - 1));
  if (start < days[0]) start = days[0];
  const span = Math.max(1, daysBetween(start, end));
  const pts = days.filter(k => k >= start).map(k => [k, u.bodyOut(dailyAvg(weights, k)!)] as const);
  const roll = Array.from({ length: span + 1 }, (_, i) => {
    const k = addDays(start, i);
    const avg = rolling(weights, k)?.avg;
    return [k, avg == null ? null : u.bodyOut(avg)] as const;
  });
  const vals = [...pts.map(p => p[1]), ...roll.flatMap(r => (r[1] == null ? [] : [r[1]]))];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 0.6) { const m = (hi + lo) / 2; lo = m - 0.3; hi = m + 0.3; }
  const step = STEPS.find(s => s >= (hi - lo) / 4) ?? 10;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;

  const W = width, H = Math.round(Math.min(280, Math.max(200, W * 0.42)));
  const L = 44, R = 14, T = 12, B = 28;
  const x = (k: string) => L + (daysBetween(start, k) / span) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const dec = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);

  let path = '', open = false;
  for (const [k, v] of roll) {
    if (v == null) { open = false; continue; }
    path += `${open ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`;
    open = true;
  }
  const xLabels = [start, addDays(start, Math.round(span / 2)), end];

  return (
    <div id="chartBox" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Weight from ${fmtShort(start)} to ${fmtShort(end)}`}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v.toFixed(dec)}</text>
          </g>
        ))}
        {xLabels.map((k, i) => (
          <text key={i} x={x(k)} y={H - 8} textAnchor={(['start', 'middle', 'end'] as const)[i]} fontSize="11" fill="var(--muted)">{fmtShort(k)}</text>
        ))}
        {pts.map(([k, v]) => (
          <circle key={k} cx={x(k)} cy={y(v)} r={span > 120 ? 1.8 : 3} fill="var(--muted)" opacity={0.7}>
            <title>{`${fmtShort(k)}: ${v.toFixed(u.bodyDigits)} ${u.body}`}</title>
          </circle>
        ))}
        <path d={path} fill="none" stroke="var(--p)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
