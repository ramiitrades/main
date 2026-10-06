'use client';
import { useMemo, useState } from 'react';

export const RANGES = ['Week', 'Month', 'All time'];

// Start of the selected range (null = no limit)
export function getRangeStart(range) {
  const now = new Date();

  if (range === 'Week') {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (range === 'Month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null; // All time
}

// Label for subtitles like "18 trades this month"
export function rangeLabel(range) {
  if (range === 'Week') return 'this week';
  if (range === 'Month') return 'this month';
  return 'on record';
}

// Hook: gives you the selected range plus the filtered trades
export function useRangeFilter(trades, initial = 'All time') {
  const [range, setRange] = useState(initial);

  const filteredTrades = useMemo(() => {
    const start = getRangeStart(range);
    if (!start) return trades;
    return trades.filter(
      (t) => new Date(t.trade_date + 'T00:00:00') >= start
    );
  }, [trades, range]);

  return { range, setRange, filteredTrades };
}

// Toggle buttons (uses your existing toggle-row / toggle-btn classes)
export default function RangeToggle({ range, setRange }) {
  return (
    <div className="toggle-row" style={{ marginBottom: 20 }}>
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          className={`toggle-btn ${range === r ? 'active' : ''}`}
          onClick={() => setRange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
