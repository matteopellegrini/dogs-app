'use client';

import { useEffect, useState } from 'react';

interface ChromStat {
  chrom: string;
  mean_depth: number;
  median_depth: number;
  p10_depth: number;
  n_bins: number;
  low_bins: number;
}

interface QcResult {
  genome_mean_depth: number;
  genome_median_depth: number;
  genome_std_depth: number;
  uniformity_cv: number;
  pct_bins_gt10x: number;
  pct_bins_gt15x: number;
  pct_bins_gt20x: number;
  pct_bins_gt30x: number;
  n_low_bins: number;
  n_total_bins: number;
  chromosomes: ChromStat[];
  qc_status: 'PASS' | 'WARN' | 'FAIL';
  warning: string | null;
  assessment: string;
  method: string;
  // Read count fields
  total_reads_raw?: number;
  total_reads_after_qc?: number;
  reads_mapped?: number;
  duplication_rate_pct?: number;
  fragment_size_mean_bp?: number;
  read_length_bp?: number;
  read_length_after_trimming_bp?: number;
  pct_q20_raw?: number;
  pct_q30_raw?: number;
  pct_q20_trimmed?: number;
  pct_q30_trimmed?: number;
  gc_content_pct?: number;
  total_bases_raw_gb?: number;
  sequencing?: string;
}

const STATUS_STYLE = {
  PASS: { badge: 'bg-green-100 text-green-700 border-green-200', icon: '✓', label: 'PASS' },
  WARN: { badge: 'bg-amber-100 text-amber-700 border-amber-200', icon: '⚠', label: 'WARN' },
  FAIL: { badge: 'bg-red-100 text-red-700 border-red-200', icon: '✗', label: 'FAIL' },
};

function depthColor(depth: number) {
  if (depth >= 30) return 'bg-green-500';
  if (depth >= 20) return 'bg-[#3540CA]';
  if (depth >= 15) return 'bg-amber-400';
  if (depth >= 10) return 'bg-orange-500';
  return 'bg-red-600';
}

function depthText(depth: number) {
  if (depth >= 30) return 'text-green-700';
  if (depth >= 20) return 'text-[#3540CA]';
  if (depth >= 15) return 'text-amber-700';
  return 'text-red-700';
}

export default function QcPanel({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<QcResult | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`${samplePath}/qc_result.json`).then(r => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading QC data…</div>;

  const status = STATUS_STYLE[data.qc_status];
  const chroms = showAll ? data.chromosomes : data.chromosomes.slice(0, 10);
  const maxMean = Math.max(...data.chromosomes.map(c => c.mean_depth));

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      {data.warning && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
          <span className="text-lg leading-none">⚠️</span>
          <div>
            <p className="font-semibold mb-0.5">Coverage Warning</p>
            <p>{data.warning}</p>
          </div>
        </div>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className={`text-3xl font-bold ${depthText(data.genome_mean_depth)}`}>
            {data.genome_mean_depth}x
          </p>
          <p className="text-xs text-gray-400 mt-1">Mean depth</p>
          <span className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${status.badge}`}>
            {status.icon} {status.label}
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-700">{data.genome_median_depth}x</p>
          <p className="text-xs text-gray-400 mt-1">Median depth</p>
          <p className="text-xs text-gray-400 mt-1">CV: {(data.uniformity_cv * 100).toFixed(1)}%</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-[#3540CA]">{data.pct_bins_gt20x}%</p>
          <p className="text-xs text-gray-400 mt-1">Bins ≥ 20x</p>
          <p className="text-xs text-gray-400 mt-1">{data.pct_bins_gt10x}% ≥ 10x</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-700">{data.n_low_bins}</p>
          <p className="text-xs text-gray-400 mt-1">Bins below 15x</p>
          <p className="text-xs text-gray-400 mt-1">of {data.n_total_bins.toLocaleString()} total</p>
        </div>
      </div>

      {/* Read statistics */}
      {data.total_reads_raw != null && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Read statistics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-lg font-bold text-gray-800">
                {(data.total_reads_raw / 1e6).toFixed(1)}M
              </p>
              <p className="text-xs text-gray-400">Raw reads</p>
            </div>
            {data.total_reads_after_qc != null && (
              <div>
                <p className="text-lg font-bold text-gray-800">
                  {(data.total_reads_after_qc / 1e6).toFixed(1)}M
                </p>
                <p className="text-xs text-gray-400">After QC</p>
              </div>
            )}
            {data.reads_mapped != null && (
              <div>
                <p className="text-lg font-bold text-[#3540CA]">
                  {(data.reads_mapped / 1e6).toFixed(1)}M
                </p>
                <p className="text-xs text-gray-400">
                  Mapped reads&nbsp;
                  <span className="text-gray-500">
                    ({data.total_reads_after_qc
                      ? ((data.reads_mapped / data.total_reads_after_qc) * 100).toFixed(1)
                      : ((data.reads_mapped / (data.total_reads_raw ?? 1)) * 100).toFixed(1)}%)
                  </span>
                </p>
              </div>
            )}
            {data.duplication_rate_pct != null && (
              <div>
                <p className={`text-lg font-bold ${data.duplication_rate_pct > 20 ? 'text-amber-600' : 'text-gray-800'}`}>
                  {data.duplication_rate_pct}%
                </p>
                <p className="text-xs text-gray-400">Duplication rate</p>
              </div>
            )}
            {data.fragment_size_mean_bp != null && (
              <div>
                <p className="text-lg font-bold text-gray-800">{data.fragment_size_mean_bp} bp</p>
                <p className="text-xs text-gray-400">Mean fragment size</p>
              </div>
            )}
            {data.read_length_bp != null && (
              <div>
                <p className="text-lg font-bold text-gray-800">{data.read_length_bp} bp</p>
                <p className="text-xs text-gray-400">
                  Read length{data.read_length_after_trimming_bp ? ' (raw)' : ''}
                </p>
              </div>
            )}
            {data.read_length_after_trimming_bp != null && (
              <div>
                <p className="text-lg font-bold text-gray-800">{data.read_length_after_trimming_bp} bp</p>
                <p className="text-xs text-gray-400">Read length (trimmed)</p>
              </div>
            )}
            {data.total_bases_raw_gb != null && (
              <div>
                <p className="text-lg font-bold text-gray-800">{data.total_bases_raw_gb} Gb</p>
                <p className="text-xs text-gray-400">Total bases (raw)</p>
              </div>
            )}
            {data.pct_q30_raw != null && (
              <div>
                <p className="text-lg font-bold text-gray-800">{data.pct_q30_raw}%</p>
                <p className="text-xs text-gray-400">Q30 bases (raw)</p>
              </div>
            )}
            {data.pct_q30_trimmed != null && (
              <div>
                <p className="text-lg font-bold text-green-700">{data.pct_q30_trimmed}%</p>
                <p className="text-xs text-gray-400">Q30 bases (trimmed)</p>
              </div>
            )}
            {data.gc_content_pct != null && (
              <div>
                <p className="text-lg font-bold text-gray-800">{data.gc_content_pct}%</p>
                <p className="text-xs text-gray-400">GC content</p>
              </div>
            )}
          </div>
          {data.sequencing && (
            <p className="mt-3 text-xs text-gray-400">{data.sequencing}</p>
          )}
        </div>
      )}

      {/* Assessment */}
      <div className="bg-[#C4F9FF]/20 border border-[#C4F9FF]/40 rounded-lg p-3 text-sm text-[#0E1B05]">
        <strong>Assessment:</strong> {data.assessment}
      </div>

      {/* Coverage thresholds */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Coverage thresholds
        </h3>
        <div className="space-y-2">
          {[
            { label: '≥ 10x (minimum callable)', pct: data.pct_bins_gt10x, color: 'bg-orange-400' },
            { label: '≥ 15x (de novo variants)', pct: data.pct_bins_gt15x, color: 'bg-amber-400' },
            { label: '≥ 20x (reliable SNV calls)', pct: data.pct_bins_gt20x, color: 'bg-[#3540CA]' },
            { label: '≥ 30x (high-confidence calls)', pct: data.pct_bins_gt30x, color: 'bg-green-500' },
          ].map(({ label, pct, color }) => (
            <div key={label} className="flex items-center gap-3 text-xs">
              <span className="w-48 text-gray-600 shrink-0">{label}</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-12 text-right font-medium text-gray-700">{pct}%</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
          <p><span className="text-red-600 font-medium">Red flag:</span> If &lt;95% of bins ≥15x, de novo variant calls are unreliable.</p>
          <p><span className="text-amber-600 font-medium">Standard WGS</span> targets ≥30x for reliable variant discovery.</p>
        </div>
      </div>

      {/* Per-chromosome table */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Per-chromosome mean depth
        </h3>
        <div className="space-y-1.5">
          {chroms.map(c => (
            <div key={c.chrom} className="flex items-center gap-2 text-xs">
              <span className="w-14 font-mono text-gray-500 shrink-0 whitespace-nowrap">{c.chrom.replace('chr', 'chr ')}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${depthColor(c.mean_depth)}`}
                  style={{ width: `${(c.mean_depth / maxMean) * 100}%` }}
                />
              </div>
              <span className={`w-10 text-right font-medium ${depthText(c.mean_depth)}`}>
                {c.mean_depth}x
              </span>
              {c.low_bins > 0 && (
                <span className="text-amber-600 text-[10px]">⚠ {c.low_bins} low</span>
              )}
            </div>
          ))}
        </div>
        {data.chromosomes.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 text-xs text-[#3540CA] hover:text-[#0E1B05]"
          >
            {showAll ? 'Show fewer' : `Show all ${data.chromosomes.length} chromosomes`}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400">{data.method}</p>
    </div>
  );
}
