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

function TaxonBar({ entry, max, color, pct }: { entry: TaxonEntry; max: number; color: string; pct: number }) {
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

interface AgeResult {
  predicted_age_years: number;
  actual_age_years?: number;
  cv_r2: number;
  cv_mae_years: number;
  n_training_samples: number;
  n_species_features: number;
  n_cosmo_features_matched: number;
  model: string;
  top_species: { name: string; coefficient: number }[];
}

interface HealthResult {
  cosmo_richness: number;
  cosmo_shannon: number;
  cosmo_richness_matched: number;
  cosmo_shannon_matched: number;
  richness_percentile: number;
  shannon_percentile: number;
  ref_richness_p25: number;
  ref_richness_p50: number;
  ref_richness_p75: number;
  ref_shannon_p25: number;
  ref_shannon_p50: number;
  ref_shannon_p75: number;
  n_matched_species: number;
  pathobiont_burden_pct: number;
  pathobiont_percentile: number;
  commensal_pct: number;
  dysbiosis_index: number;
  ref_pathobiont_mean: number;
  ref_pathobiont_median: number;
  ref_pathobiont_p75: number;
  ref_pathobiont_p90: number;
  pathobiont_hits: { name: string; pct: number; color: string; association: string }[];
}

export default function MicrobiomePanel({ samplePath }: { samplePath: string }) {
  const [data, setData] = useState<MicrobiomeResult | null>(null);
  const [ageData, setAgeData] = useState<AgeResult | null>(null);
  const [healthData, setHealthData] = useState<HealthResult | null>(null);
  const [activeRank, setActiveRank] = useState<'phyla' | 'families' | 'genera' | 'species'>('phyla');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const base = samplePath.replace(/^\//, '');
    setData(null);
    setAgeData(null);
    setHealthData(null);
    setError(null);
    fetch(`/${base}/microbiome_result.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
    fetch(`/${base}/microbiome_age_result.json`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setAgeData(d))
      .catch(() => {});
    fetch(`/${base}/microbiome_health_result.json`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setHealthData(d))
      .catch(() => {});
  }, [samplePath]);

  if (error) return <div className="p-4 text-red-500">Microbiome data not available: {error}</div>;
  if (!data) return <div className="p-4 text-gray-400">Loading microbiome data…</div>;

  const rankData: Record<string, TaxonEntry[]> = {
    phyla: data.phyla,
    families: data.families,
    genera: data.genera,
    species: data.species,
  };

  const norm = data.total_classified_pct / 100; // factor to convert to % of bacterial reads
  const normalize = (pct: number) => norm > 0 ? pct / norm : pct;

  const entries = (rankData[activeRank] ?? []).slice(0, 20);
  const max = entries.length > 0 ? normalize(entries[0].relative_abundance) : 1;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Oral Microbiome (MetaPhlAn4)</h2>
        <p className="text-sm text-gray-500 mt-1">
          {data.db_version} · Run {data.run_date} ·{' '}
          <span className="font-medium text-green-700">{data.total_classified_pct.toFixed(1)}%</span> reads classified
        </p>
      </div>

      {/* Microbiome Age */}
      {ageData && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Microbiome Age Prediction</p>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-xs text-indigo-400 mb-0.5">Predicted</p>
              <div className="flex items-end gap-1.5">
                <span className="text-5xl font-bold text-indigo-700">{ageData.predicted_age_years.toFixed(1)}</span>
                <span className="text-lg text-indigo-500 mb-1">yrs</span>
              </div>
            </div>
            {ageData.actual_age_years != null && (
              <div>
                <p className="text-xs text-indigo-400 mb-0.5">Actual</p>
                <div className="flex items-end gap-1.5">
                  <span className="text-5xl font-bold text-indigo-300">{ageData.actual_age_years.toFixed(1)}</span>
                  <span className="text-lg text-indigo-300 mb-1">yrs</span>
                </div>
              </div>
            )}
          </div>
          {ageData.actual_age_years != null && (
            <p className="text-xs text-indigo-500 bg-indigo-100 rounded-lg px-3 py-1.5">
              Microbiome predicts {Math.abs(ageData.actual_age_years - ageData.predicted_age_years).toFixed(1)} yrs{' '}
              {ageData.predicted_age_years < ageData.actual_age_years ? 'younger' : 'older'} than chronological age
              {ageData.predicted_age_years < ageData.actual_age_years
                ? ' — oral microbiome composition resembles a younger dog.'
                : ' — oral microbiome composition resembles an older dog.'}
            </p>
          )}
          <p className="text-sm text-indigo-600">
            Estimated from {ageData.n_cosmo_features_matched} matched bacterial species against {ageData.n_training_samples} reference dogs
            · model CV R²={ageData.cv_r2.toFixed(2)}, MAE±{ageData.cv_mae_years.toFixed(1)} yrs
          </p>
          <div>
            <p className="text-xs text-indigo-400 uppercase tracking-wide mb-1">Top age-associated species</p>
            <div className="flex flex-wrap gap-2">
              {ageData.top_species.slice(0, 8).map((s) => (
                <span
                  key={s.name}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.coefficient > 0
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {s.coefficient > 0 ? '↑' : '↓'} {s.name}
                </span>
              ))}
            </div>
            <p className="text-xs text-indigo-400 mt-1">↑ increases with age · ↓ decreases with age</p>
          </div>
        </div>
      )}

      {/* Diversity metrics */}
      {healthData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Alpha diversity */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Alpha Diversity</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-emerald-400 mb-0.5">Species Richness</p>
                <p className="text-3xl font-bold text-emerald-700">{healthData.cosmo_richness_matched}</p>
                <p className="text-xs text-emerald-500">{healthData.richness_percentile}th percentile</p>
              </div>
              <div>
                <p className="text-xs text-emerald-400 mb-0.5">Shannon Index</p>
                <p className="text-3xl font-bold text-emerald-700">{healthData.cosmo_shannon_matched.toFixed(2)}</p>
                <p className="text-xs text-emerald-500">{healthData.shannon_percentile}th percentile</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-emerald-400 uppercase tracking-wide">vs. reference (n=1,045 dogs)</p>
              <PercentileBar label="Richness" value={healthData.cosmo_richness_matched} p25={healthData.ref_richness_p25} p50={healthData.ref_richness_p50} p75={healthData.ref_richness_p75} color="#10b981" />
              <PercentileBar label="Shannon" value={healthData.cosmo_shannon_matched} p25={healthData.ref_shannon_p25} p50={healthData.ref_shannon_p50} p75={healthData.ref_shannon_p75} color="#10b981" />
            </div>
            <p className="text-xs text-emerald-500">
              Computed on {healthData.n_matched_species} species shared with the reference panel.
              Higher diversity indicates a more resilient oral microbiome.
            </p>
          </div>

          {/* Pathobiont burden */}
          <div className={`border rounded-xl p-5 space-y-3 ${healthData.pathobiont_percentile >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${healthData.pathobiont_percentile >= 75 ? 'text-amber-500' : 'text-gray-500'}`}>
              Pathobiont Burden
            </p>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-bold ${healthData.pathobiont_percentile >= 75 ? 'text-amber-700' : 'text-gray-700'}`}>
                {healthData.pathobiont_burden_pct.toFixed(1)}%
              </span>
              <span className={`text-sm mb-1 ${healthData.pathobiont_percentile >= 75 ? 'text-amber-500' : 'text-gray-500'}`}>
                of bacterial reads · {healthData.pathobiont_percentile}th pct
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Reference: median {healthData.ref_pathobiont_median.toFixed(1)}% · 90th pct {healthData.ref_pathobiont_p90.toFixed(1)}% (n=1,045 dogs)
            </p>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Detected periodontal pathogens</p>
              {healthData.pathobiont_hits.map((h) => (
                <div key={h.name} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${h.color === 'red' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-xs italic text-gray-700 flex-1">{h.name}</span>
                  <span className={`text-xs font-medium ${h.color === 'red' ? 'text-red-600' : 'text-amber-600'}`}>{h.pct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Dysbiosis index (log₁₀ pathobiont/commensal): <span className="font-medium">{healthData.dysbiosis_index.toFixed(2)}</span>
            </p>
          </div>
        </div>
      )}

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
                {k.name}: {normalize(k.relative_abundance).toFixed(1)}% of bacterial reads
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
          <TaxonBar key={e.clade} entry={e} max={max} color={COLORS[i % COLORS.length]} pct={normalize(e.relative_abundance)} />
        ))}
      </div>

      {/* Phylum donut placeholder via inline SVG */}
      {activeRank === 'phyla' && data.phyla.length > 0 && (
        <PhylumDonut phyla={data.phyla.slice(0, 8).map(p => ({ ...p, relative_abundance: normalize(p.relative_abundance) }))} />
      )}
    </div>
  );
}

function PercentileBar({ label, value, p25, p50, p75, color }: {
  label: string; value: number; p25: number; p50: number; p75: number; color: string;
}) {
  const max = p75 * 1.5;
  const clamp = (v: number) => Math.min(v / max * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 relative h-4 bg-gray-100 rounded-full overflow-hidden">
        <div className="absolute h-full rounded-full opacity-30" style={{ width: `${clamp(p75)}%`, backgroundColor: color }} />
        <div className="absolute h-full w-0.5 bg-gray-400" style={{ left: `${clamp(p50)}%` }} />
        <div className="absolute h-full w-0.5 bg-white" style={{ left: `${clamp(value)}%` }} />
        <div className="absolute w-2.5 h-2.5 rounded-full border-2 border-white top-0.5" style={{ left: `calc(${clamp(value)}% - 5px)`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right font-medium" style={{ color }}>{typeof value === 'number' && value < 10 ? value.toFixed(2) : Math.round(value)}</span>
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
