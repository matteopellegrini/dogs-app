'use client';

import { useEffect, useRef, useState } from 'react';

interface BreedComponent {
  breed: string;
  code: string;
  component?: number;
  proportion: number;
}

interface BreedResult {
  breed_composition: BreedComponent[];
  method: string;
  reference_panel: string;
  snps_used: number;
  cv_error?: number;
  k?: number;
  note?: string;
}

const THRESHOLD = 0.04; // collapse breeds below 4% into "Unresolved ancestry"

// Colour palette — distinct for each breed group
const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#f97316', '#14b8a6', '#ec4899', '#84cc16',
];
const UNRESOLVED_COLOR = '#d1d5db';

function buildDisplayBreeds(raw: { breed: string; proportion: number }[]) {
  const sorted = [...raw].sort((a, b) => b.proportion - a.proportion);
  const major = sorted.filter((b) => b.proportion >= THRESHOLD);
  const minorSum = sorted.filter((b) => b.proportion < THRESHOLD).reduce((s, b) => s + b.proportion, 0);
  if (minorSum > 0.001) major.push({ breed: 'Unresolved ancestry', proportion: minorSum });
  return major;
}

export default function BreedChart({ samplePath = '' }: { samplePath?: string } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);
  const [data, setData] = useState<BreedResult | null>(null);

  useEffect(() => {
    fetch(`${samplePath}/breed_result.json`).then((r) => r.json()).then(setData);
  }, [samplePath]);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const breeds = buildDisplayBreeds(data.breed_composition);

    import('chart.js').then(({
      Chart, BarController, BarElement, LinearScale, CategoryScale,
      DoughnutController, ArcElement, Tooltip, Legend
    }) => {
      Chart.register(BarController, BarElement, LinearScale, CategoryScale,
        DoughnutController, ArcElement, Tooltip, Legend);
      if (chartRef.current) (chartRef.current as { destroy: () => void }).destroy();

      const bgColors = breeds.map((b, i) =>
        b.breed === 'Unresolved ancestry' ? UNRESOLVED_COLOR : COLORS[i % COLORS.length]
      );

      chartRef.current = new Chart(canvasRef.current!, {
        type: 'doughnut',
        data: {
          labels: breeds.map((b) => `${b.breed} (${(b.proportion * 100).toFixed(1)}%)`),
          datasets: [{
            data: breeds.map((b) => b.proportion * 100),
            backgroundColor: bgColors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverBorderWidth: 3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                font: { size: 11 },
                color: '#374151',
                padding: 12,
                boxWidth: 14,
                boxHeight: 14,
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${(Number(ctx.raw)).toFixed(1)}% ${ctx.label?.split(' (')[0]}`,
              },
            },
          },
        },
      });
    });

    return () => {
      if (chartRef.current) (chartRef.current as { destroy: () => void }).destroy();
    };
  }, [data]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading breed results…</div>;

  const breeds = buildDisplayBreeds(data.breed_composition);

  return (
    <div className="space-y-6">
      {/* Method note */}
      <div className="bg-[#C4F9FF]/20 border border-[#C4F9FF]/40 rounded-lg p-3 text-xs text-[#3540CA]">
        <strong>Method:</strong> {data.method} · {data.snps_used.toLocaleString()} SNPs · K={data.k ?? 177} breeds ·{' '}
        Reference: {data.reference_panel}
      </div>

      {/* Chart + bar table layout */}
      <div className="flex gap-6 items-start flex-wrap">
        {/* Doughnut chart */}
        <div className="relative w-72 h-64 flex-shrink-0">
          <canvas ref={canvasRef} />
        </div>

        {/* Bar table */}
        <div className="flex-1 min-w-52 space-y-2">
          {breeds.map((b, i) => {
            const isUnresolved = b.breed === 'Unresolved ancestry';
            const color = isUnresolved ? UNRESOLVED_COLOR : COLORS[i % COLORS.length];
            return (
              <div key={i}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className={`font-medium ${isUnresolved ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                    {b.breed}
                  </span>
                  <span className="text-gray-500">{(b.proportion * 100).toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${b.proportion * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caveats */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1">
        <p><strong>Interpretation notes:</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li>Breeds below 4% are collapsed into "Unresolved ancestry" — at low WGS coverage, minor components reflect noise rather than true admixture.</li>
          {data.note && <li>{data.note}</li>}
        </ul>
      </div>
    </div>
  );
}
