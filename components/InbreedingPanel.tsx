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

interface ScatterResult {
  pearson_r: number;
  pearson_p: number;
  spearman_rho: number;
  n_samples: number;
  cosmo_geno_F: number;
  cosmo_froh: number;
  ref_geno_F_mean: number;
  ref_froh_mean: number;
  points: { x: number; y: number }[];
}

interface FrohParkerResult {
  cosmo_froh: number;
  cosmo_roh_total_mb: number;
  cosmo_percentile: number;
  n_samples: number;
  ref_froh_mean: number;
  ref_froh_p50: number;
  ref_froh_p25: number;
  ref_froh_p75: number;
  hist_counts: number[];
  hist_edges: number[];
  autosomal_genome_mb: number;
  note?: string;
}

interface FrohDog10kResult {
  cosmo_froh: number;
  cosmo_roh_total_mb: number;
  cosmo_percentile: number;
  n_samples: number;
  ref_froh_mean: number;
  ref_froh_p50: number;
  ref_froh_p25: number;
  ref_froh_p75: number;
  hist_counts: number[];
  hist_edges: number[];
  autosomal_genome_mb: number;
  note?: string;
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
            Genotype-based inbreeding (F) vs. Parker et al. panel
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {parker.n_samples.toLocaleString()} dogs · {parker.n_snps_used.toLocaleString()} LD-pruned SNPs
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-800">{(cosmoF * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">{parker.cosmo_percentile}th percentile</p>
        </div>
      </div>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
        <span className="font-semibold">How to read this:</span> F is computed from excess homozygosity across all SNPs.{' '}
        <span className="font-semibold">Higher F = more inbreeding</span> (more homozygous sites than expected).
        This captures both <em>recent</em> inbreeding and background homozygosity from breed ancestry.
        Cosmo sits at the {parker.cosmo_percentile}th percentile — above average for this multi-breed panel, which includes many highly inbred purebreds.
      </p>

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

function InbreedingScatter({ scatter }: { scatter: ScatterResult }) {
  const W = 340, H = 260, PAD = { top: 24, right: 20, bottom: 44, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const allX = scatter.points.map(p => p.x);
  const allY = scatter.points.map(p => p.y);
  const xMin = 0, xMax = Math.ceil(Math.max(...allX, scatter.cosmo_geno_F) * 10) / 10;
  const yMin = 0, yMax = Math.ceil(Math.max(...allY, scatter.cosmo_froh) * 10) / 10;

  const sx = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const sy = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Linear regression line
  const n = scatter.points.length;
  const meanX = allX.reduce((a, b) => a + b, 0) / n;
  const meanY = allY.reduce((a, b) => a + b, 0) / n;
  const slope = allX.reduce((s, x, i) => s + (x - meanX) * (allY[i] - meanY), 0) /
                allX.reduce((s, x) => s + (x - meanX) ** 2, 0);
  const intercept = meanY - slope * meanX;
  const lx1 = xMin, ly1 = intercept + slope * lx1;
  const lx2 = xMax, ly2 = intercept + slope * lx2;

  const ticks = (min: number, max: number, n: number) =>
    Array.from({ length: n }, (_, i) => +(min + (i / (n - 1)) * (max - min)).toFixed(2));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Genotype F vs F<sub>ROH</sub></h3>
          <p className="text-xs text-gray-400 mt-0.5">{scatter.n_samples.toLocaleString()} Parker panel dogs</p>
        </div>
        <div className="text-right bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-sm font-bold text-gray-800">r = {scatter.pearson_r.toFixed(3)}</p>
          <p className="text-xs text-gray-400">ρ = {scatter.spearman_rho.toFixed(3)}</p>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300 }}>
        {/* Grid lines */}
        {ticks(yMin, yMax, 5).map(t => (
          <line key={t} x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)}
            stroke="#f0f0f0" strokeWidth="1" />
        ))}

        {/* Regression line */}
        <line x1={sx(lx1)} y1={sy(ly1)} x2={sx(lx2)} y2={sy(ly2)}
          stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* Scatter points */}
        {scatter.points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.2}
            fill="#9ca3af" fillOpacity={0.45} />
        ))}

        {/* Cosmo */}
        <circle cx={sx(scatter.cosmo_geno_F)} cy={sy(scatter.cosmo_froh)} r={6}
          fill="#3540CA" stroke="white" strokeWidth={1.5} />
        <text x={sx(scatter.cosmo_geno_F) + 9} y={sy(scatter.cosmo_froh) + 4}
          fontSize={9} fill="#3540CA" fontWeight="600">Cosmo</text>

        {/* X axis */}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
          stroke="#e5e7eb" strokeWidth="1" />
        {ticks(xMin, xMax, 5).map(t => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.top + plotH} y2={PAD.top + plotH + 4}
              stroke="#e5e7eb" strokeWidth="1" />
            <text x={sx(t)} y={PAD.top + plotH + 14} fontSize={8} textAnchor="middle" fill="#9ca3af">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <text x={PAD.left + plotW / 2} y={H - 2} fontSize={9} textAnchor="middle" fill="#6b7280">
          Genotype F
        </text>

        {/* Y axis */}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH}
          stroke="#e5e7eb" strokeWidth="1" />
        {ticks(yMin, yMax, 5).map(t => (
          <g key={t}>
            <text x={PAD.left - 6} y={sy(t) + 3} fontSize={8} textAnchor="end" fill="#9ca3af">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <text x={12} y={PAD.top + plotH / 2} fontSize={9} textAnchor="middle" fill="#6b7280"
          transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}>
          F_ROH
        </text>
      </svg>

      <p className="text-xs text-gray-500 mt-2">
        Both measures are highly correlated (r = {scatter.pearson_r.toFixed(3)}), confirming they capture the same underlying inbreeding signal.
        Genotype F tends to be slightly lower than F<sub>ROH</sub> because it is calibrated against expected heterozygosity
        across the whole panel rather than physical genome coverage.
        Cosmo (blue dot) sits above the regression line — her F<sub>ROH</sub> is somewhat elevated relative to her genotype F,
        suggesting her ROH are concentrated in longer segments rather than distributed genome-wide.
      </p>
    </div>
  );
}

function FrohDog10kHistogram({ result }: { result: FrohDog10kResult }) {
  const maxCount = Math.max(...result.hist_counts);
  const cosmoF   = result.cosmo_froh;
  const edges    = result.hist_edges;
  const range    = edges[edges.length - 1] - edges[0];
  const cosmoLeftPct = ((cosmoF - edges[0]) / range) * 100;
  const isGenoF  = (result as { metric?: string }).metric === 'genotype_F';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Inbreeding vs. Dog10K panel (1,929 dogs · 21M SNPs)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {result.n_samples.toLocaleString()} dogs · whole-genome {isGenoF ? 'genotype F' : 'F​ROH'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-800">{(cosmoF * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">{result.cosmo_percentile}th percentile</p>
        </div>
      </div>

      <p className="text-xs text-[#3540CA]/80 bg-[#EEF0FB] border border-[#3540CA]/20 rounded-lg px-3 py-2 mt-2">
        <span className="font-semibold">Dog10K reference:</span> 1,929 dogs across 400+ breeds worldwide, phased at 21M SNPs.
        {' '}Cosmo sits at the <span className="font-semibold">{result.cosmo_percentile}th percentile</span> — lower inbreeding than {(100 - result.cosmo_percentile).toFixed(0)}% of the panel.
        {isGenoF && ' Note: genotype F is elevated for all samples due to the Wahlund effect (population stratification across breeds); the relative position is what matters.'}
      </p>

      {/* Histogram */}
      <div className="relative mt-4 mb-1" style={{ height: 100 }}>
        <div className="flex items-end gap-px h-full">
          {result.hist_counts.map((count, i) => {
            const h = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const binStart = edges[i];
            const binEnd   = edges[i + 1];
            const hasCosmo = cosmoF >= binStart && cosmoF < binEnd;
            return (
              <div
                key={i}
                title={`${(binStart*100).toFixed(1)}–${(binEnd*100).toFixed(1)}%: ${count} dogs`}
                className={`flex-1 rounded-t-sm transition-colors ${hasCosmo ? 'bg-[#3540CA]' : 'bg-gray-200 hover:bg-gray-300'}`}
                style={{ height: `${h}%`, minHeight: count > 0 ? 2 : 0 }}
              />
            );
          })}
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[#3540CA] opacity-80"
          style={{ left: `${Math.min(Math.max(cosmoLeftPct, 0), 100)}%` }}
        >
          <span className="absolute -top-5 left-1 text-[10px] font-semibold text-[#3540CA] whitespace-nowrap">
            Cosmo
          </span>
        </div>
      </div>

      {/* X-axis */}
      <div className="flex justify-between text-[9px] text-gray-400 mt-1">
        {Array.from({ length: 9 }, (_, i) => {
          const v = edges[0] + (i / 8) * range;
          return <span key={i}>{(v * 100).toFixed(0)}%</span>;
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-400 mb-0.5">Panel median</p>
          <p className="font-semibold text-gray-700">{(result.ref_froh_p50 * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-400 mb-0.5">Panel mean</p>
          <p className="font-semibold text-gray-700">{(result.ref_froh_mean * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-[#3540CA]/5 border border-[#3540CA]/20 rounded-lg p-2">
          <p className="text-[#3540CA]/70 mb-0.5">Cosmo</p>
          <p className="font-semibold text-[#3540CA]">{(cosmoF * 100).toFixed(1)}% · {result.cosmo_percentile}th pct</p>
        </div>
      </div>
      {result.note && <p className="text-[10px] text-gray-400 mt-2">{result.note}</p>}
    </div>
  );
}

function FrohHistogram({ frohParker }: { frohParker: FrohParkerResult }) {
  const maxCount = Math.max(...frohParker.hist_counts);
  const cosmoFroh = frohParker.cosmo_froh;
  const edges = frohParker.hist_edges;
  const range = edges[edges.length - 1] - edges[0];
  const cosmoLeftPct = ((cosmoFroh - edges[0]) / range) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            ROH-based inbreeding (F<sub>ROH</sub>) vs. Parker et al. panel
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {frohParker.n_samples.toLocaleString()} dogs · SNP-array ROH detection
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-800">{(cosmoFroh * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">{frohParker.cosmo_percentile}th percentile</p>
        </div>
      </div>

      <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-2">
        <span className="font-semibold">How to read this:</span> F<sub>ROH</sub> is the fraction of the autosomal genome
        in long runs of homozygosity (ROH ≥ 500 kb). ROH arise when both copies of a chromosome segment are
        identical by descent.{' '}
        <span className="font-semibold">Higher F<sub>ROH</sub> = more recent inbreeding</span> — only recent
        matings of relatives produce the long IBD tracts detected as ROH.
        Cosmo sits at the {frohParker.cosmo_percentile}th percentile within this panel
        ({(cosmoFroh * 100).toFixed(1)}% of her genome is in ROH segments).
      </p>

      {/* Histogram */}
      <div className="relative mt-4 mb-1" style={{ height: 100 }}>
        <div className="flex items-end gap-px h-full">
          {frohParker.hist_counts.map((count, i) => {
            const h = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const binStart = edges[i];
            const binEnd = edges[i + 1];
            const hasCosmo = cosmoFroh >= binStart && cosmoFroh < binEnd;
            return (
              <div
                key={i}
                title={`F_ROH ${(binStart*100).toFixed(1)}–${(binEnd*100).toFixed(1)}%: ${count} dogs`}
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
            Cosmo
          </span>
        </div>
      </div>

      {/* X-axis */}
      <div className="flex justify-between text-[9px] text-gray-400 mt-1">
        {[0, 10, 20, 30, 40, 50, 60, 70].map(v => (
          <span key={v}>{v}%</span>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-400 mb-0.5">Panel median F<sub>ROH</sub></p>
          <p className="font-semibold text-gray-700">{(frohParker.ref_froh_p50 * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-400 mb-0.5">Panel mean F<sub>ROH</sub></p>
          <p className="font-semibold text-gray-700">{(frohParker.ref_froh_mean * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-[#3540CA]/5 border border-[#3540CA]/20 rounded-lg p-2">
          <p className="text-[#3540CA]/70 mb-0.5">Cosmo F<sub>ROH</sub></p>
          <p className="font-semibold text-[#3540CA]">{(cosmoFroh * 100).toFixed(1)}% · {frohParker.cosmo_percentile}th pct</p>
        </div>
      </div>
      {frohParker.note && <p className="text-[10px] text-gray-400 mt-2">{frohParker.note}</p>}
    </div>
  );
}

export default function InbreedingPanel({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<InbreedingResult | null>(null);
  const [parker, setParker] = useState<ParkerResult | null>(null);
  const [frohParker, setFrohParker] = useState<FrohParkerResult | null>(null);
  const [frohDog10k, setFrohDog10k] = useState<FrohDog10kResult | null>(null);

  useEffect(() => {
    const base = samplePath.replace(/^\//, '');
    fetch(`/${base}/inbreeding_result.json`).then(r => r.ok ? r.json() : null).then(d => d && setData(d)).catch(() => {});
    fetch(`/${base}/inbreeding_parker_result.json`).then(r => r.ok ? r.json() : null).then(d => d && setParker(d)).catch(() => {});
    fetch(`/${base}/inbreeding_froh_parker_result.json`).then(r => r.ok ? r.json() : null).then(d => d && setFrohParker(d)).catch(() => {});
    fetch(`/${base}/inbreeding_froh_dog10k_result.json`).then(r => r.ok ? r.json() : null).then(d => d && setFrohDog10k(d)).catch(() => {});
  }, [samplePath]);

  if (!parker && !frohParker && !frohDog10k) return <div className="text-gray-400 text-sm py-8 text-center">Loading inbreeding data…</div>;

  const cosmoBenchmarkF = data?.Froh ?? data?.f_roh ?? 0;

  return (
    <div className="space-y-5">
      {/* Dog10K distribution — shown first and prominently when available */}
      {frohDog10k && <FrohDog10kHistogram result={frohDog10k} />}

      {/* Parker panel distribution — genotype F */}
      {parker && (
        <ParkerHistogram parker={parker} cosmoBenchmarkF={cosmoBenchmarkF} />
      )}

      {/* F_ROH distribution vs Parker panel */}
      {!frohDog10k && frohParker && <FrohHistogram frohParker={frohParker} />}
    </div>
  );
}
