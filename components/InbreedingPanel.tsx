'use client';

import { useEffect, useState } from 'react';

interface RohSegment {
  chrom: string;
  start: number;
  end: number;
  length_mb: number;
  n_snps: number;
}

interface InbreedingResult {
  // actual JSON field names from inbreeding_result.json
  Froh?: number;
  f_roh?: number;
  roh_total_mb?: number;
  total_roh_mb?: number;
  roh_genome_mb?: number;
  autosomal_genome_mb?: number;
  inbreeding_level?: string;
  level?: string;
  interpretation?: string;
  method?: string;
  n_roh?: number;
  avg_roh_mb?: number;
  roh_segments?: RohSegment[];
  f_roh_pct?: number;
}

interface ParkerResult {
  method: string;
  n_samples: number;
  n_snps_used: number;
  cosmo_F: number;
  cosmo_percentile: number;
  ref_F_mean: number;
  ref_F_std: number;
  ref_F_min: number;
  ref_F_p10: number;
  ref_F_p25: number;
  ref_F_p50: number;
  ref_F_p75: number;
  ref_F_p90: number;
  ref_F_max: number;
  hist_counts: number[];
  hist_edges: number[];
}

const LEVEL_STYLE = {
  low:       { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700',  label: 'Low' },
  moderate:  { bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', label: 'Moderate' },
  high:      { bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'High' },
  very_high: { bar: 'bg-red-600',    badge: 'bg-red-100 text-red-700',       label: 'Very High' },
};

const BENCHMARKS = [
  { label: 'Outbred',            f: 0.00  },
  { label: '3rd cousins',        f: 0.016 },
  { label: '2nd cousins',        f: 0.031 },
  { label: '1st cousins',        f: 0.063 },
  { label: 'Half-siblings',      f: 0.125 },
  { label: 'Full siblings',      f: 0.250 },
  { label: 'Parent × offspring', f: 0.250 },
];

function ParkerHistogram({ parker, cosmoBenchmarkF }: { parker: ParkerResult; cosmoBenchmarkF: number }) {
  const maxCount = Math.max(...parker.hist_counts);
  const barW = 100 / parker.hist_counts.length;
  const cosmoF = parker.cosmo_F;
  const range = parker.hist_edges[parker.hist_edges.length - 1] - parker.hist_edges[0];
  const cosmoLeftPct = ((cosmoF - parker.hist_edges[0]) / range) * 100;
  const rohLeftPct = ((cosmoBenchmarkF - parker.hist_edges[0]) / range) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Inbreeding vs. Parker et al. panel
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {parker.n_samples.toLocaleString()} dogs · {parker.n_snps_used.toLocaleString()} LD-pruned SNPs · F from excess homozygosity
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-800">{(cosmoF * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">{parker.cosmo_percentile}th percentile</p>
        </div>
      </div>

      {/* Histogram */}
      <div className="relative mt-4 mb-1" style={{ height: 100 }}>
        <div className="flex items-end gap-px h-full">
          {parker.hist_counts.map((count, i) => {
            const h = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const binStart = parker.hist_edges[i];
            const binEnd = parker.hist_edges[i + 1];
            const hasCosmo = cosmoF >= binStart && cosmoF < binEnd;
            return (
              <div
                key={i}
                title={`F ${binStart.toFixed(2)}–${binEnd.toFixed(2)}: ${count} dogs`}
                className={`flex-1 rounded-t-sm transition-colors ${hasCosmo ? 'bg-[#3540CA]' : 'bg-gray-200 hover:bg-gray-300'}`}
                style={{ height: `${h}%`, minHeight: count > 0 ? 2 : 0 }}
              />
            );
          })}
        </div>

        {/* Cosmo marker line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[#3540CA] opacity-80"
          style={{ left: `${Math.min(Math.max(cosmoLeftPct, 0), 100)}%` }}
        >
          <span className="absolute -top-5 left-1 text-[10px] font-semibold text-[#3540CA] whitespace-nowrap">
            Cosmo (genotype F)
          </span>
        </div>

        {/* ROH benchmark line */}
        {rohLeftPct >= 0 && rohLeftPct <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-orange-400 opacity-70"
            style={{ left: `${rohLeftPct}%` }}
          >
            <span className="absolute -top-5 left-1 text-[10px] text-orange-500 whitespace-nowrap">
              ROH-based
            </span>
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-[9px] text-gray-400 mt-1">
        {[-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(v => (
          <span key={v}>{(v * 100).toFixed(0)}%</span>
        ))}
      </div>

      {/* Legend & stats */}
      <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-400 mb-0.5">Panel median F</p>
          <p className="font-semibold text-gray-700">{(parker.ref_F_p50 * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-400 mb-0.5">Panel mean F</p>
          <p className="font-semibold text-gray-700">{(parker.ref_F_mean * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-[#3540CA]/5 border border-[#3540CA]/20 rounded-lg p-2">
          <p className="text-[#3540CA]/70 mb-0.5">Cosmo F (genotype)</p>
          <p className="font-semibold text-[#3540CA]">{(cosmoF * 100).toFixed(1)}% · {parker.cosmo_percentile}th pct</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">{parker.method}</p>
    </div>
  );
}

export default function InbreedingPanel({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<InbreedingResult | null>(null);
  const [parker, setParker] = useState<ParkerResult | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const base = samplePath.replace(/^\//, '');
    fetch(`/${base}/inbreeding_result.json`).then(r => r.ok ? r.json() : null).then(d => d && setData(d)).catch(() => {});
    fetch(`/${base}/inbreeding_parker_result.json`).then(r => r.ok ? r.json() : null).then(d => d && setParker(d)).catch(() => {});
  }, [samplePath]);

  if (!data && !parker) return <div className="text-gray-400 text-sm py-8 text-center">Loading inbreeding data…</div>;

  // Normalise field names — JSON uses either Froh/f_roh and either inbreeding_level/level
  const froh = data?.Froh ?? data?.f_roh ?? 0;
  const pct = data?.f_roh_pct ?? froh * 100;
  const totalRohMb = data?.roh_total_mb ?? data?.total_roh_mb ?? 0;
  const genomeRohMb = data?.roh_genome_mb ?? data?.autosomal_genome_mb ?? 2200;
  const levelRaw = (data?.inbreeding_level ?? data?.level ?? 'low').toLowerCase().replace(/\s+/g, '_') as keyof typeof LEVEL_STYLE;
  const style = LEVEL_STYLE[levelRaw] ?? LEVEL_STYLE.low;
  const segments = showAll ? (data?.roh_segments ?? []) : (data?.roh_segments ?? []).slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Parker panel distribution — primary view */}
      {parker && (
        <ParkerHistogram parker={parker} cosmoBenchmarkF={data ? data.f_roh : 0} />
      )}

      {/* F_ROH gauge (original ROH-based) */}
      {data && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Inbreeding coefficient (F<sub>ROH</sub>, WGS-based)</p>
              <p className="text-4xl font-bold text-gray-800">{pct.toFixed(1)}%</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${style.badge}`}>
              {style.label}
            </span>
          </div>

          <div className="relative mt-2">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${style.bar}`}
                style={{ width: `${Math.min(pct / 30 * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-1">
              <span>0%</span><span>5%</span><span>10%</span><span>15%</span>
              <span>20%</span><span>25%</span><span>30%+</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">{data?.interpretation}</p>
        </div>
      )}

      {/* Stats grid */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.n_roh != null && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">ROH segments</p>
              <p className="text-xl font-semibold text-gray-700">{data.n_roh}</p>
            </div>
          )}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Total ROH length</p>
            <p className="text-xl font-semibold text-gray-700">{totalRohMb.toFixed(0)} Mb</p>
          </div>
          {data.avg_roh_mb != null && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Avg ROH length</p>
              <p className="text-xl font-semibold text-gray-700">{data.avg_roh_mb.toFixed(1)} Mb</p>
            </div>
          )}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Genome covered</p>
            <p className="text-xl font-semibold text-gray-700">
              {((totalRohMb / genomeRohMb) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Benchmarks */}
      {data && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Comparison to expected F values
          </h3>
          <div className="space-y-2">
            {BENCHMARKS.map((b, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="w-32 text-gray-600 shrink-0">{b.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C4F9FF]/50 rounded-full"
                    style={{ width: `${Math.min(b.f / 0.30 * 100, 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-gray-400">{(b.f * 100).toFixed(1)}%</span>
                {Math.abs(froh - b.f) < 0.02 && (
                  <span className="text-[#3540CA] font-medium">← this dog</span>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3 text-xs mt-1 pt-2 border-t border-gray-100">
              <span className="w-32 font-semibold text-gray-800 shrink-0">This dog</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${style.bar}`}
                  style={{ width: `${Math.min(pct / 30 * 100, 100)}%` }}
                />
              </div>
              <span className="w-10 text-right font-semibold text-gray-800">{pct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ROH segments table */}
      {data && (data.roh_segments ?? []).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Runs of Homozygosity ({data.n_roh ?? segments.length} segments ≥ 1 Mb)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-left">
                  <th className="py-1.5 pr-4 font-medium">Region</th>
                  <th className="py-1.5 pr-4 font-medium">Length</th>
                  <th className="py-1.5 font-medium">SNPs</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 pr-4 font-mono text-gray-600">
                      {s.chrom}:{(s.start / 1e6).toFixed(1)}–{(s.end / 1e6).toFixed(1)} Mb
                    </td>
                    <td className="py-1.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${style.bar}`}
                            style={{ width: `${Math.min(s.length_mb / 30 * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-700 font-medium">{s.length_mb.toFixed(1)} Mb</span>
                      </div>
                    </td>
                    <td className="py-1.5 text-gray-400">{s.n_snps.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(data.roh_segments ?? []).length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-2 text-xs text-[#3540CA] hover:text-[#0E1B05]"
            >
              {showAll ? 'Show fewer' : `Show all ${data.n_roh ?? (data.roh_segments ?? []).length} segments`}
            </button>
          )}
        </div>
      )}

      {data?.method && <p className="text-xs text-gray-400">{data.method}</p>}
    </div>
  );
}
