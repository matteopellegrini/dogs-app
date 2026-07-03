'use client';

import { useEffect, useState } from 'react';

interface CallerStats {
  tool: string;
  version: string;
  runtime_sec: number;
  runtime_label: string;
  total_variants: number;
  snvs: number;
  indels: number;
  mnps: number;
  tstv: number;
  filters: string;
  threads: number;
}

interface ComparisonResult {
  bcftools: CallerStats;
  freebayes: CallerStats;
  overlap: {
    unique_to_bcftools: number;
    unique_to_freebayes: number;
    in_both: number;
    note: string;
  };
  notes: string[];
}

function StatCell({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-800">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function RuntimeBar({ sec, maxSec, color }: { sec: number; maxSec: number; color: string }) {
  const pct = (sec / maxSec) * 100;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-24 text-right">{min}m {s}s</span>
    </div>
  );
}

export default function VariantCallerComparison({ samplePath = '' }: { samplePath?: string }) {
  const [data, setData] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    const base = samplePath.replace(/^\//, '');
    fetch(`/${base}/private_variants_comparison.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => {});
  }, [samplePath]);

  if (!data) return null;

  const { bcftools, freebayes, overlap } = data;
  const maxRuntime = Math.max(bcftools.runtime_sec, freebayes.runtime_sec);
  const totalOverlap = overlap.in_both + overlap.unique_to_bcftools + overlap.unique_to_freebayes;
  const speedup = (bcftools.runtime_sec / freebayes.runtime_sec).toFixed(1);

  return (
    <div className="space-y-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-700">Variant caller comparison</h2>

      {/* Side-by-side stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* bcftools */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
            <p className="text-sm font-semibold text-gray-800">bcftools</p>
            <span className="text-[10px] text-gray-400 ml-auto">{bcftools.version}</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Total variants</span><span className="font-semibold">{bcftools.total_variants.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">SNVs</span><span className="font-semibold">{bcftools.snvs.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Indels</span><span className="font-semibold">{bcftools.indels.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">MNPs</span><span className="font-semibold">{bcftools.mnps.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
              <span className="text-gray-500">Ts/Tv</span>
              <span className={`font-semibold ${bcftools.tstv >= 1.8 ? 'text-green-600' : 'text-amber-600'}`}>{bcftools.tstv.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* freebayes */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shrink-0" />
            <p className="text-sm font-semibold text-gray-800">freebayes</p>
            <span className="text-[10px] text-gray-400 ml-auto">{freebayes.version}</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Total variants</span><span className="font-semibold">{freebayes.total_variants.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">SNVs</span><span className="font-semibold">{freebayes.snvs.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Indels</span><span className="font-semibold">{freebayes.indels.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">MNPs</span><span className="font-semibold">{freebayes.mnps.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
              <span className="text-gray-500">Ts/Tv</span>
              <span className={`font-semibold ${freebayes.tstv >= 1.8 ? 'text-green-600' : 'text-amber-600'}`}>{freebayes.tstv.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Runtime comparison */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Compute time · {bcftools.threads} threads each
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block"/>bcftools</span>
            </div>
            <RuntimeBar sec={bcftools.runtime_sec} maxSec={maxRuntime} color="bg-sky-400" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block"/>freebayes</span>
            </div>
            <RuntimeBar sec={freebayes.runtime_sec} maxSec={maxRuntime} color="bg-violet-400" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Freebayes was <span className="font-semibold text-violet-600">{speedup}× faster</span> — run in parallel per chromosome vs bcftools streaming mpileup.
        </p>
      </div>

      {/* Overlap Venn */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Variant overlap (exact CHROM·POS·REF·ALT match)
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
            <p className="text-sky-600 font-bold text-lg">{overlap.unique_to_bcftools.toLocaleString()}</p>
            <p className="text-sky-500 mt-0.5">bcftools only</p>
          </div>
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
            <p className="text-gray-700 font-bold text-lg">{overlap.in_both.toLocaleString()}</p>
            <p className="text-gray-500 mt-0.5">in both</p>
          </div>
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
            <p className="text-violet-600 font-bold text-lg">{overlap.unique_to_freebayes.toLocaleString()}</p>
            <p className="text-violet-500 mt-0.5">freebayes only</p>
          </div>
        </div>
        {/* Stacked bar */}
        <div className="h-4 rounded-full overflow-hidden flex">
          <div className="bg-sky-400 h-full" style={{ width: `${(overlap.unique_to_bcftools / totalOverlap) * 100}%` }} />
          <div className="bg-gray-300 h-full" style={{ width: `${(overlap.in_both / totalOverlap) * 100}%` }} />
          <div className="bg-violet-400 h-full" style={{ width: `${(overlap.unique_to_freebayes / totalOverlap) * 100}%` }} />
        </div>
        <p className="text-[10px] text-gray-400 mt-2">{overlap.note}</p>
      </div>

      {/* Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
        {data.notes.map((note, i) => (
          <p key={i} className="text-xs text-amber-800">· {note}</p>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">bcftools variant annotations</h2>
      </div>
    </div>
  );
}
