'use client';

import { useEffect, useRef, useState } from 'react';

interface CoverageData {
  [chrom: string]: number[];
}

const CHR_ORDER = [...Array(38).keys()].map((i) => `chr${i + 1}`).concat(['chrX']);

function chromStats(depths: number[]) {
  const n = depths.length;
  const mean = depths.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(depths.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { mean, sd };
}

function barColor(v: number, mean: number, sd: number) {
  if (v < mean - 2 * sd) return '#E24B4A';   // low — red
  if (v > mean + 2 * sd) return '#f97316';   // high / spike — orange
  return '#6366f1';                           // normal — indigo
}

export default function CoverageChart({ samplePath = '' }: { samplePath?: string } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);
  const [data, setData] = useState<CoverageData | null>(null);
  const [selected, setSelected] = useState('chr1');
  const [stats, setStats] = useState({ mean: 0, sd: 0, low: 0, high: 0, total: 0, max: 0 });

  useEffect(() => {
    fetch(`${samplePath}/coverage_1mb.json`)
      .then((r) => r.json())
      .then((d: CoverageData) => setData(d));
  }, [samplePath]);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const depths = data[selected];
    if (!depths) return;

    const { mean, sd } = chromStats(depths);
    const low  = depths.filter((v) => v < mean - 2 * sd).length;
    const high = depths.filter((v) => v > mean + 2 * sd).length;
    const max  = Math.max(...depths);
    setStats({ mean: parseFloat(mean.toFixed(1)), sd: parseFloat(sd.toFixed(1)), low, high, total: depths.length, max: parseFloat(max.toFixed(1)) });

    import('chart.js').then(({ Chart, BarController, LineController, BarElement, PointElement, LineElement, LinearScale, CategoryScale, Tooltip }) => {
      Chart.register(BarController, LineController, BarElement, PointElement, LineElement, LinearScale, CategoryScale, Tooltip);
      if (chartRef.current) (chartRef.current as { destroy: () => void }).destroy();

      const yMax = Math.ceil(max * 1.08);

      chartRef.current = new Chart(canvasRef.current!, {
        type: 'bar',
        data: {
          labels: depths.map((_, i) => i),
          datasets: [
            {
              label: 'Depth',
              data: depths,
              backgroundColor: depths.map((v) => barColor(v, mean, sd)),
              borderWidth: 0,
              borderRadius: 2,
              barPercentage: 0.95,
              categoryPercentage: 1.0,
            },
            {
              label: 'Chromosome mean',
              data: Array(depths.length).fill(mean),
              type: 'line' as const,
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              borderDash: [4, 3],
              pointRadius: 0,
              fill: false,
            },
            {
              label: '+2 SD',
              data: Array(depths.length).fill(mean + 2 * sd),
              type: 'line' as const,
              borderColor: '#f97316',
              borderWidth: 1,
              borderDash: [2, 4],
              pointRadius: 0,
              fill: false,
            },
            {
              label: '−2 SD',
              data: Array(depths.length).fill(Math.max(0, mean - 2 * sd)),
              type: 'line' as const,
              borderColor: '#E24B4A',
              borderWidth: 1,
              borderDash: [2, 4],
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 100 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (ctx) =>
                  `${selected}:${ctx[0].label}–${parseInt(String(ctx[0].label)) + 1} Mb`,
                label: (ctx) => {
                  if (ctx.datasetIndex === 0) {
                    const v = Number(ctx.raw);
                    const tag = v < mean - 2 * sd ? ' ⬇ low' : v > mean + 2 * sd ? ' ⬆ high' : '';
                    return `Depth: ${v.toFixed(1)}x${tag}`;
                  }
                  if (ctx.datasetIndex === 1) return `Mean: ${mean.toFixed(1)}x`;
                  if (ctx.datasetIndex === 2) return `+2 SD: ${(mean + 2 * sd).toFixed(1)}x`;
                  return `−2 SD: ${Math.max(0, mean - 2 * sd).toFixed(1)}x`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { size: 9 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 15,
                color: '#9ca3af',
                callback: (v) => `${v}Mb`,
              },
            },
            y: {
              min: 0,
              max: yMax,
              ticks: { callback: (v) => `${v}x`, font: { size: 10 }, color: '#9ca3af' },
              grid: { color: 'rgba(156,163,175,0.2)' },
            },
          },
        },
      });
    });

    return () => {
      if (chartRef.current) (chartRef.current as { destroy: () => void }).destroy();
    };
  }, [data, selected]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading coverage data...
      </div>
    );
  }

  const hasUnusual = stats.low + stats.high > 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500 mb-3">
          Mean sequencing depth per 1 Mb window. Y-axis auto-scaled per chromosome.
          Coloured bars deviate more than 2 SD from the chromosome mean.
        </p>

        {/* Chromosome selector */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CHR_ORDER.filter((c) => data[c]).map((c) => {
            const d = data[c];
            const { mean, sd } = chromStats(d);
            const unusual = d.filter((v) => v < mean - 2 * sd || v > mean + 2 * sd).length;
            return (
              <button
                key={c}
                onClick={() => setSelected(c)}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors relative ${
                  selected === c
                    ? 'bg-[#3540CA] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.replace('chr', '')}
                {unusual > 0 && selected !== c && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-orange-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Mean depth</p>
            <p className="text-lg font-semibold text-gray-800">{stats.mean}x</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Std dev</p>
            <p className="text-lg font-semibold text-gray-800">±{stats.sd}x</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Max depth</p>
            <p className="text-lg font-semibold text-gray-800">{stats.max}x</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Unusual windows</p>
            <p className={`text-lg font-semibold ${hasUnusual ? 'text-orange-500' : 'text-gray-800'}`}>
              {stats.low + stats.high} / {stats.total}
            </p>
          </div>
        </div>

        {hasUnusual && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2 mb-3 flex gap-4">
            {stats.low  > 0 && <span>⬇ {stats.low}  window{stats.low  > 1 ? 's' : ''} below mean − 2 SD</span>}
            {stats.high > 0 && <span>⬆ {stats.high} window{stats.high > 1 ? 's' : ''} above mean + 2 SD</span>}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative w-full h-56">
        <canvas ref={canvasRef} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#6366f1] inline-block" />
          Normal (within ±2 SD)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          Low (&lt; mean − 2 SD)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />
          High (&gt; mean + 2 SD)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-amber-400 inline-block" />
          Chromosome mean
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-orange-400 inline-block" />
          ±2 SD bounds
        </span>
      </div>
    </div>
  );
}
