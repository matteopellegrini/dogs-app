'use client';

import { useEffect, useState } from 'react';

interface CoverageRegion {
  chrom: string;
  del_start: number;
  del_end: number;
  plot_start: number;
  plot_end: number;
  window_bp: number;
  depths: number[];
}

interface CoverageData {
  regions: CoverageRegion[];
  genome_mean_depth: number;
}

const ZYG_LABEL: Record<string, { label: string; color: string }> = {
  likely_hom: { label: 'likely hom del', color: '#ef4444' },
  ambiguous:  { label: 'ambiguous',       color: '#f59e0b' },
  likely_het: { label: 'likely het del',  color: '#3b82f6' },
};

function CoveragePlot({
  region,
  genomeMean,
  zygosity,
  geneName,
}: {
  region: CoverageRegion;
  genomeMean: number;
  zygosity?: string;
  geneName?: string;
}) {
  const W = 560, H = 120;
  const PAD = { top: 12, right: 10, bottom: 24, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const { depths, del_start, del_end, plot_start, plot_end, chrom } = region;
  const n = depths.length;

  // Cap outliers at 3× genome mean for display
  const cap = genomeMean * 3;
  const yMax = cap;

  const xScale = (i: number) => PAD.left + (i / n) * plotW;
  const yScale = (d: number) => PAD.top + plotH - (Math.min(d, yMax) / yMax) * plotH;

  // Deletion highlight bounds in plot coords
  const totalBp = plot_end - plot_start;
  const delX1 = PAD.left + ((del_start - plot_start) / totalBp) * plotW;
  const delX2 = PAD.left + ((del_end - plot_start) / totalBp) * plotW;

  // Build polyline
  const points = depths.map((d, i) => {
    const x = xScale(i + 0.5);
    const y = yScale(d);
    return `${x},${y}`;
  }).join(' ');

  // Y-axis ticks: 0, 1×, 2×, 3×
  const yTicks = [0, 1, 2, 3].map(m => m * genomeMean);

  // X-axis ticks every 200kb
  const tickIntervalBp = 200_000;
  const xTicks: { x: number; label: string }[] = [];
  const firstTick = Math.ceil(plot_start / tickIntervalBp) * tickIntervalBp;
  for (let pos = firstTick; pos <= plot_end; pos += tickIntervalBp) {
    const frac = (pos - plot_start) / (plot_end - plot_start);
    xTicks.push({ x: PAD.left + frac * plotW, label: `${(pos / 1e6).toFixed(1)}` });
  }

  const zyg = zygosity ? ZYG_LABEL[zygosity] : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-gray-700">
          {chrom}:{(del_start / 1e6).toFixed(2)}–{(del_end / 1e6).toFixed(2)} Mb
          {geneName && <span className="ml-2 text-gray-400 font-normal">({geneName})</span>}
        </div>
        {zyg && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: zyg.color + '22', color: zyg.color }}>
            {zyg.label}
          </span>
        )}
      </div>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
        {/* Deletion highlight */}
        <rect x={delX1} y={PAD.top} width={delX2 - delX1} height={plotH}
          fill="#ef444422" stroke="#ef4444" strokeWidth={0.5} strokeDasharray="2,2" />

        {/* Y gridlines + ticks */}
        {yTicks.map((v) => {
          const y = yScale(v);
          return (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y}
                stroke={v === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth={v === 0 ? 1 : 0.5} />
              <text x={PAD.left - 3} y={y + 3} textAnchor="end" fontSize={7} fill="#9ca3af">
                {v.toFixed(1)}x
              </text>
            </g>
          );
        })}

        {/* Genome mean reference line */}
        <line x1={PAD.left} x2={PAD.left + plotW}
          y1={yScale(genomeMean)} y2={yScale(genomeMean)}
          stroke="#6366f1" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.6} />

        {/* Coverage bars */}
        {depths.map((d, i) => {
          const x = xScale(i);
          const barW = plotW / n;
          const barH = (Math.min(d, yMax) / yMax) * plotH;
          const inDel = (plot_start + i * region.window_bp) >= del_start &&
                        (plot_start + i * region.window_bp) < del_end;
          return (
            <rect key={i} x={x} y={PAD.top + plotH - barH} width={barW} height={barH}
              fill={inDel ? '#ef4444' : '#6366f1'} opacity={inDel ? 0.7 : 0.45} />
          );
        })}

        {/* X-axis */}
        <line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH}
          stroke="#d1d5db" strokeWidth={1} />
        {xTicks.map(({ x, label }) => (
          <g key={label}>
            <line x1={x} x2={x} y1={PAD.top + plotH} y2={PAD.top + plotH + 3} stroke="#9ca3af" strokeWidth={0.5} />
            <text x={x} y={PAD.top + plotH + 10} textAnchor="middle" fontSize={7} fill="#9ca3af">{label}</text>
          </g>
        ))}

        {/* "Mb" label */}
        <text x={PAD.left + plotW} y={H - 2} textAnchor="end" fontSize={7} fill="#9ca3af">Mb</text>
      </svg>
      <p className="text-[10px] text-gray-400 mt-0.5">
        10 kb bins · red = deletion region · dashed line = genome mean ({genomeMean}×) · capped at {(yMax).toFixed(1)}×
      </p>
    </div>
  );
}

// Gene names for each region's chrom
const REGION_GENES: Record<string, string[]> = {
  chr2:  ['ENSCAFG00845012582'],
  chr13: ['CSMD3'],
  chr16: ['VEGFC'],
  chr19: [],
  chr27: ['SMCO2', 'PPFIBP1'],
};

const REGION_ZYG: Record<string, string> = {
  chr2:  'likely_hom',
  chr13: 'ambiguous',
  chr16: 'ambiguous',
  chr19: 'likely_hom',
  chr27: 'ambiguous',
};

export default function CnvCoverage({ samplePath = '' }: { samplePath?: string }) {
  const [data, setData] = useState<CoverageData | null>(null);

  useEffect(() => {
    fetch(`${samplePath}/cnv_coverage.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => {});
  }, [samplePath]);

  if (!data) return null;

  return (
    <div className="space-y-3 mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Coverage profiles</h3>
      {data.regions.map((r) => (
        <CoveragePlot
          key={r.chrom}
          region={r}
          genomeMean={data.genome_mean_depth}
          zygosity={REGION_ZYG[r.chrom]}
          geneName={(REGION_GENES[r.chrom] ?? []).join(', ')}
        />
      ))}
    </div>
  );
}
