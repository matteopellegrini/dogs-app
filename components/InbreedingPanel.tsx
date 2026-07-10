'use client';

import { useEffect, useState } from 'react';

interface FrohDog10kResult {
  cosmo_froh: number;
  cosmo_percentile: number;
  n_samples: number;
  ref_froh_mean: number;
  ref_froh_p50: number;
  ref_froh_p25: number;
  ref_froh_p75: number;
  hist_counts: number[];
  hist_edges: number[];
  note?: string;
  metric?: string;
}

function FrohDog10kHistogram({ result }: { result: FrohDog10kResult }) {
  const maxCount = Math.max(...result.hist_counts);
  const cosmoF = result.cosmo_froh;
  const edges = result.hist_edges;
  const range = edges[edges.length - 1] - edges[0];
  const cosmoLeftPct = ((cosmoF - edges[0]) / range) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Inbreeding vs. Dog10K panel (1,929 dogs · 21M SNPs)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {result.n_samples.toLocaleString()} dogs · whole-genome genotype F
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
        {' '}Note: all F values are elevated by the Wahlund effect (stratification across breeds); the relative position is what matters.
      </p>

      {/* Histogram */}
      <div className="relative mt-4 mb-1" style={{ height: 100 }}>
        <div className="flex items-end gap-px h-full">
          {result.hist_counts.map((count, i) => {
            const h = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const binStart = edges[i];
            const binEnd = edges[i + 1];
            const hasCosmo = cosmoF >= binStart && cosmoF < binEnd;
            return (
              <div
                key={i}
                title={`${(binStart * 100).toFixed(1)}–${(binEnd * 100).toFixed(1)}%: ${count} dogs`}
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

export default function InbreedingPanel({ samplePath = '' }: { samplePath?: string } = {}) {
  const [frohDog10k, setFrohDog10k] = useState<FrohDog10kResult | null>(null);

  useEffect(() => {
    const base = samplePath.replace(/^\//, '');
    fetch(`/${base}/inbreeding_froh_dog10k_result.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setFrohDog10k(d))
      .catch(() => {});
  }, [samplePath]);

  if (!frohDog10k) return <div className="text-gray-400 text-sm py-8 text-center">Loading inbreeding data…</div>;

  return (
    <div className="space-y-5">
      <FrohDog10kHistogram result={frohDog10k} />
    </div>
  );
}
