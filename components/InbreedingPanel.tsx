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
  f_roh: number;
  f_roh_pct: number;
  n_roh: number;
  total_roh_mb: number;
  avg_roh_mb: number;
  autosomal_genome_mb: number;
  level: 'low' | 'moderate' | 'high' | 'very_high';
  interpretation: string;
  method: string;
  roh_segments: RohSegment[];
}

const LEVEL_STYLE = {
  low:       { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700',  label: 'Low' },
  moderate:  { bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', label: 'Moderate' },
  high:      { bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'High' },
  very_high: { bar: 'bg-red-600',    badge: 'bg-red-100 text-red-700',       label: 'Very High' },
};

const BENCHMARKS = [
  { label: 'Outbred',           f: 0.00, desc: 'Unrelated parents' },
  { label: '3rd cousins',       f: 0.016, desc: 'F = 0.016' },
  { label: '2nd cousins',       f: 0.031, desc: 'F = 0.031' },
  { label: '1st cousins',       f: 0.063, desc: 'F = 0.063' },
  { label: 'Half-siblings',     f: 0.125, desc: 'F = 0.125' },
  { label: 'Full siblings',     f: 0.250, desc: 'F = 0.250' },
  { label: 'Parent × offspring',f: 0.250, desc: 'F = 0.250' },
];

export default function InbreedingPanel({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<InbreedingResult | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`${samplePath}/inbreeding_result.json`).then(r => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading inbreeding data…</div>;

  const style = LEVEL_STYLE[data.level];
  const pct = data.f_roh_pct;
  const segments = showAll ? data.roh_segments : data.roh_segments.slice(0, 10);

  return (
    <div className="space-y-5">
      {/* F_ROH gauge */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Inbreeding coefficient (F<sub>ROH</sub>)</p>
            <p className="text-4xl font-bold text-gray-800">{pct.toFixed(1)}%</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${style.badge}`}>
            {style.label}
          </span>
        </div>

        {/* Gauge bar */}
        <div className="relative mt-2">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${style.bar}`}
              style={{ width: `${Math.min(pct / 30 * 100, 100)}%` }}
            />
          </div>
          {/* Tick marks */}
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>0%</span><span>5%</span><span>10%</span><span>15%</span>
            <span>20%</span><span>25%</span><span>30%+</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 mt-3">{data.interpretation}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">ROH segments</p>
          <p className="text-xl font-semibold text-gray-700">{data.n_roh}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Total ROH length</p>
          <p className="text-xl font-semibold text-gray-700">{data.total_roh_mb.toFixed(0)} Mb</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Avg ROH length</p>
          <p className="text-xl font-semibold text-gray-700">{data.avg_roh_mb.toFixed(1)} Mb</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Genome covered</p>
          <p className="text-xl font-semibold text-gray-700">
            {((data.total_roh_mb / data.autosomal_genome_mb) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Benchmarks */}
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
              {Math.abs(data.f_roh - b.f) < 0.02 && (
                <span className="text-[#3540CA] font-medium">← this dog</span>
              )}
            </div>
          ))}
          {/* Dog's actual value */}
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

      {/* ROH segments table */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Runs of Homozygosity ({data.n_roh} segments ≥ 1 Mb)
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
        {data.roh_segments.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 text-xs text-[#3540CA] hover:text-[#0E1B05]"
          >
            {showAll ? 'Show fewer' : `Show all ${data.n_roh} segments`}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400">{data.method}</p>
    </div>
  );
}
