'use client';

import { useEffect, useState } from 'react';

interface TaxonEntry {
  clade: string;
  rank: string;
  name: string;
  relative_abundance: number;
  estimated_reads: number | null;
}

interface MicrobiomeResult {
  sample: string;
  run_date: string;
  db_version: string;
  kingdom: TaxonEntry[];
  phyla: TaxonEntry[];
  classes: TaxonEntry[];
  orders: TaxonEntry[];
  families: TaxonEntry[];
  genera: TaxonEntry[];
  species: TaxonEntry[];
  total_classified_pct: number;
}

const RANK_LABELS: Record<string, string> = {
  k: 'Kingdom', p: 'Phylum', c: 'Class', o: 'Order', f: 'Family', g: 'Genus', s: 'Species',
};

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6',
  '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7',
];

function shortName(clade: string): string {
  const parts = clade.split('|');
  const last = parts[parts.length - 1];
  return last.replace(/^[a-z]__/, '').replace(/_/g, ' ');
}

function TaxonBar({ entry, max, color }: { entry: TaxonEntry; max: number; color: string }) {
  const pct = entry.relative_abundance;
  const barW = max > 0 ? (pct / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-48 text-sm text-gray-700 truncate italic" title={entry.name}>
        {entry.name}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barW}%`, backgroundColor: color }}
        />
        <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-800">
          {pct.toFixed(2)}%
        </span>
      </div>
      {entry.estimated_reads != null && (
        <div className="w-20 text-xs text-gray-500 text-right">
          ~{entry.estimated_reads.toLocaleString()} reads
        </div>
      )}
    </div>
  );
}

export default function MicrobiomePanel({ samplePath }: { samplePath: string }) {
  const [data, setData] = useState<MicrobiomeResult | null>(null);
  const [activeRank, setActiveRank] = useState<'phyla' | 'families' | 'genera' | 'species'>('phyla');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/${samplePath.replace(/^\//, '')}/microbiome_result.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [samplePath]);

  if (error) return <div className="p-4 text-red-500">Microbiome data not available: {error}</div>;
  if (!data) return <div className="p-4 text-gray-400">Loading microbiome data…</div>;

  const rankData: Record<string, TaxonEntry[]> = {
    phyla: data.phyla,
    families: data.families,
    genera: data.genera,
    species: data.species,
  };

  const entries = (rankData[activeRank] ?? []).slice(0, 20);
  const max = entries.length > 0 ? entries[0].relative_abundance : 1;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Oral Microbiome (MetaPhlAn4)</h2>
        <p className="text-sm text-gray-500 mt-1">
          {data.db_version} · Run {data.run_date} ·{' '}
          <span className="font-medium text-green-700">{data.total_classified_pct.toFixed(1)}%</span> reads classified
        </p>
      </div>

      {/* Top kingdoms summary */}
      {data.kingdom.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Kingdom-level</p>
          <div className="flex flex-wrap gap-3">
            {data.kingdom.map((k) => (
              <span
                key={k.clade}
                className="px-3 py-1 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-700"
              >
                {k.name}: {k.relative_abundance.toFixed(2)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rank selector */}
      <div className="flex gap-2">
        {(['phyla', 'families', 'genera', 'species'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setActiveRank(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeRank === r
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="space-y-1">
        {entries.length === 0 && (
          <p className="text-gray-400 text-sm">No taxa detected at this rank.</p>
        )}
        {entries.map((e, i) => (
          <TaxonBar key={e.clade} entry={e} max={max} color={COLORS[i % COLORS.length]} />
        ))}
      </div>

      {/* Phylum donut placeholder via inline SVG */}
      {activeRank === 'phyla' && data.phyla.length > 0 && (
        <PhylumDonut phyla={data.phyla.slice(0, 8)} />
      )}
    </div>
  );
}

function PhylumDonut({ phyla }: { phyla: TaxonEntry[] }) {
  const total = phyla.reduce((s, p) => s + p.relative_abundance, 0);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const innerR = 40;

  let cumAngle = -Math.PI / 2;
  const slices = phyla.map((p, i) => {
    const frac = p.relative_abundance / (total || 1);
    const angle = frac * 2 * Math.PI;
    const start = cumAngle;
    cumAngle += angle;
    const end = cumAngle;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const ix1 = cx + innerR * Math.cos(end);
    const iy1 = cy + innerR * Math.sin(end);
    const ix2 = cx + innerR * Math.cos(start);
    const iy2 = cy + innerR * Math.sin(start);
    const large = angle > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`;
    return { d, color: COLORS[i % COLORS.length], name: p.name, pct: (frac * 100).toFixed(1) };
  });

  return (
    <div className="flex items-center gap-6 mt-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} opacity={0.85}>
            <title>{s.name}: {s.pct}%</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill="white" />
      </svg>
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="italic text-gray-700">{s.name}</span>
            <span className="text-gray-500">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
