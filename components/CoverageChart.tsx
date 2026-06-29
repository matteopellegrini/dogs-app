'use client';

import { useEffect, useRef, useState } from 'react';

interface CoverageData {
  [chrom: string]: number[];
}

const MEAN = 28.6;
const LOW = 22;
const CHR_ORDER = [...Array(38).keys()].map((i) => `chr${i + 1}`).concat(['chrX']);

const IMPACT_NOTE: Record<string, string> = {
  chr9: 'Spikes at 9–10 Mb — likely repeat/duplication artifact',
  chr13: 'Low-coverage window at 37 Mb (18.4x)',
  chr17: 'Spike at terminal window (117x) — telomeric repeat artifact',
  chrX: 'Single dip to 15x at 72 Mb',
};

export default function CoverageChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);
  const [data, setData] = useState<CoverageData | null>(null);
  const [selected, setSelected] = useState('chr1');
  const [stats, setStats] = useState({ mean: 0, low: 0, total: 0 });

  useEffect(() => {
    fetch('/coverage_1mb.json')
      .then((r) => r.json())
      .then((d: CoverageData) => setData(d));
  }, []);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const depths = data[selected];
    if (!depths) return;

    const mean = depths.reduce((s, v) => s + v, 0) / depths.length;
    const low = depths.filter((v) => v < LOW).length;
    setStats({ mean: parseFloat(mean.toFixed(2)), low, total: depths.length });

    import('chart.js').then(({ Chart, BarController, LineController, BarElement, PointElement, LineElement, LinearScale, CategoryScale, Tooltip }) => {
      Chart.register(BarController, LineController, BarElement, PointElement, LineElement, LinearScale, CategoryScale, Tooltip);
      if (chartRef.current) (chartRef.current as { destroy: () => void }).destroy();

      const maxDepth = Math.max(...depths);
      const yMax = maxDepth > 40 ? Math.ceil(maxDepth / 10) * 10 : 36;

      chartRef.current = new Chart(canvasRef.current!, {
        type: 'bar',
        data: {
          labels: depths.map((_, i) => i),
          datasets: [
            {
              label: 'Depth',
              data: depths,
              backgroundColor: depths.map((v) => (v < LOW ? '#E24B4A' : '#6366f1')),
              borderWidth: 0,
              borderRadius: 2,
              barPercentage: 0.95,
              categoryPercentage: 1.0,
            },
            {
              label: 'Genome mean',
              data: Array(depths.length).fill(MEAN),
              type: 'line' as const,
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              borderDash: [4, 3],
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
                label: (ctx) =>
                  ctx.dataset.type === 'line'
                    ? `Genome mean: ${MEAN}x`
                    : `Depth: ${Number(ctx.raw).toFixed(1)}x`,
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500 mb-3">
          Mean sequencing depth per 1 Mb window across all chromosomes. Click a chromosome to view
          its profile.
        </p>

        {/* Chromosome selector */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CHR_ORDER.filter((c) => data[c]).map((c) => (
            <button
              key={c}
              onClick={() => setSelected(c)}
              className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                selected === c
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.replace('chr', '')}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Chromosome</p>
            <p className="text-lg font-semibold text-gray-800">{selected}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Mean depth</p>
            <p className="text-lg font-semibold text-gray-800">{stats.mean}x</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Windows &lt;{LOW}x</p>
            <p className={`text-lg font-semibold ${stats.low > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {stats.low} / {stats.total}
            </p>
          </div>
        </div>

        {IMPACT_NOTE[selected] && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2 mb-3">
            ⚠ {IMPACT_NOTE[selected]}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative w-full h-56">
        <canvas ref={canvasRef} />
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
          Normal depth
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          Low coverage (&lt;{LOW}x)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-amber-400 inline-block" />
          Genome mean ({MEAN}x)
        </span>
      </div>
    </div>
  );
}
