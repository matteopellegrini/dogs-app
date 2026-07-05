'use client';

import { useEffect, useRef, useState } from 'react';

interface ChromData {
  cosmo:  number[];
  panel:  number[];
  ratio:  number[];
}

interface Centromeres {
  [chrom: string]: [number, number];  // [start_bp, end_bp]
}

interface CoverageData {
  [chrom: string]: ChromData;
}

const CHR_ORDER = [...Array(38).keys()].map((i) => `chr${i + 1}`).concat(['chrX']);

// Thresholds for flagging
const DEL_THRESH = 0.65;   // below → likely deletion
const DUP_THRESH = 1.35;   // above → likely duplication

function barColor(r: number) {
  if (r < DEL_THRESH) return '#E24B4A';
  if (r > DUP_THRESH) return '#f97316';
  return '#6366f1';
}

function chromUnusual(ratios: number[]) {
  return ratios.filter(r => r < DEL_THRESH || r > DUP_THRESH).length;
}

function ChromosomeSchematic({
  chrom, nWindows, centromere,
}: {
  chrom: string;
  nWindows: number;
  centromere?: [number, number];
}) {
  const W = nWindows;           // viewBox units = Mb windows (1 unit = 1 Mb)
  const H = 24;
  const midY = H / 2;
  const armH = 12;              // arm body height
  const cenH = 6;               // centromere constriction height
  const capR = armH / 2;

  // Centromere position in Mb (divide bp by 1_000_000)
  const cenStartMb = centromere ? centromere[0] / 1_000_000 : W * 0.45;
  const cenEndMb   = centromere ? centromere[1] / 1_000_000 : W * 0.55;
  const cenMid     = (cenStartMb + cenEndMb) / 2;

  // Clamp to chromosome extent
  const cs = Math.max(capR, Math.min(cenStartMb, W - capR));
  const ce = Math.max(cs + 0.5, Math.min(cenEndMb, W - capR));

  // p arm: from left telomere to centromere start
  // outline path (top edge left→right, bottom edge right→left)
  const pPath = [
    `M ${capR},${midY - armH/2}`,
    `A ${capR} ${capR} 0 0 0 ${capR},${midY + armH/2}`,   // left telomere arc
    `L ${cs},${midY + armH/2}`,
    `Q ${cenMid},${midY + cenH/2} ${ce},${midY + armH/2}`, // centromere bottom curve
    `L ${ce},${midY - armH/2}`,
    `Q ${cenMid},${midY - cenH/2} ${cs},${midY - armH/2}`, // centromere top curve
    `Z`,
  ].join(' ');

  // q arm: from centromere end to right telomere
  const qPath = [
    `M ${ce},${midY - armH/2}`,
    `Q ${cenMid},${midY - cenH/2} ${cs},${midY - armH/2}`, // centromere top curve
    `L ${cs},${midY + armH/2}`,
    `Q ${cenMid},${midY + cenH/2} ${ce},${midY + armH/2}`, // centromere bottom curve
    `L ${W - capR},${midY + armH/2}`,
    `A ${capR} ${capR} 0 0 0 ${W - capR},${midY - armH/2}`, // right telomere arc
    `Z`,
  ].join(' ');

  const pMid = cs / 2;
  const qMid = (ce + W) / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 36, display: 'block' }}
      preserveAspectRatio="none"
    >
      {/* p arm */}
      <path d={pPath} fill="#c7caf0" stroke="#3540CA" strokeWidth={0.4} />
      {/* q arm */}
      <path d={qPath} fill="#c7caf0" stroke="#3540CA" strokeWidth={0.4} />
      {/* centromere ellipse */}
      <ellipse
        cx={cenMid} cy={midY}
        rx={(ce - cs) / 2 + 0.5} ry={cenH / 2}
        fill="#6366f1" stroke="#3540CA" strokeWidth={0.4}
      />
      {/* arm labels */}
      {pMid > 3 && (
        <text x={pMid} y={midY + 3} textAnchor="middle"
          fontSize={Math.min(5, cs * 0.4)} fill="#3540CA" fontWeight="600" fontFamily="sans-serif">p</text>
      )}
      {(W - qMid) > 3 && (
        <text x={qMid} y={midY + 3} textAnchor="middle"
          fontSize={Math.min(5, (W - ce) * 0.4)} fill="#3540CA" fontWeight="600" fontFamily="sans-serif">q</text>
      )}
    </svg>
  );
}

export default function CoverageChart({ samplePath = '' }: { samplePath?: string } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<unknown>(null);
  const [data, setData]           = useState<CoverageData | null>(null);
  const [centromeres, setCentromeres] = useState<Centromeres>({});
  const [selected, setSelected]   = useState('chr1');
  const [chartPad, setChartPad]   = useState({ left: '0px', right: '0px' });
  const setPadRef  = useRef(setChartPad);
  const padDoneRef = useRef(false);

  useEffect(() => {
    fetch(`${samplePath}/coverage_1mb.json`)
      .then(r => r.json())
      .then((d: CoverageData) => setData(d));
    fetch('/cosmo/centromeres.json')
      .then(r => r.ok ? r.json() : {})
      .then((d: Centromeres) => setCentromeres(d))
      .catch(() => {});
  }, [samplePath]);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const chrom = data[selected];
    if (!chrom) return;

    const { ratio, cosmo, panel } = chrom;
    const low  = ratio.filter(r => r < DEL_THRESH).length;
    const high = ratio.filter(r => r > DUP_THRESH).length;
    const meanRatio = ratio.reduce((s, v) => s + v, 0) / ratio.length;
    const isChrX = selected === 'chrX';

    import('chart.js').then(({ Chart, BarController, LineController, BarElement, PointElement, LineElement, LinearScale, CategoryScale, Tooltip }) => {
      Chart.register(BarController, LineController, BarElement, PointElement, LineElement, LinearScale, CategoryScale, Tooltip);

      if (chartRef.current) (chartRef.current as { destroy: () => void }).destroy();
      padDoneRef.current = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromPadPlugin: any = {
        id: 'chromPad',
        afterDraw(chart: any) {
          if (padDoneRef.current) return;
          const ca = chart.chartArea;
          const cssWidth: number = chart.canvas?.clientWidth ?? 0;
          if (!ca || !cssWidth) return;
          padDoneRef.current = true;
          requestAnimationFrame(() => {
            setPadRef.current({ left: `${ca.left}px`, right: `${cssWidth - ca.right}px` });
          });
        },
      };

      const yMax = Math.min(2.2, Math.ceil(Math.max(...ratio) * 1.15 * 10) / 10);

      chartRef.current = new Chart(canvasRef.current!, {
        type: 'bar',
        plugins: [chromPadPlugin],
        data: {
          labels: ratio.map((_, i) => i),
          datasets: [
            {
              label: 'Ratio',
              data: ratio,
              backgroundColor: ratio.map(barColor),
              borderWidth: 0,
              borderRadius: 2,
              barPercentage: 0.95,
              categoryPercentage: 1.0,
            },
            // diploid reference line at 1.0
            {
              label: 'Diploid (1.0)',
              data: Array(ratio.length).fill(1.0),
              type: 'line' as const,
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              borderDash: [4, 3],
              pointRadius: 0,
              fill: false,
            },
            // deletion threshold
            {
              label: 'Del threshold',
              data: Array(ratio.length).fill(DEL_THRESH),
              type: 'line' as const,
              borderColor: '#E24B4A',
              borderWidth: 1,
              borderDash: [2, 4],
              pointRadius: 0,
              fill: false,
            },
            // duplication threshold
            {
              label: 'Dup threshold',
              data: Array(ratio.length).fill(DUP_THRESH),
              type: 'line' as const,
              borderColor: '#f97316',
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
                    const i = ctx.dataIndex;
                    const r = ratio[i];
                    const tag = r < DEL_THRESH ? ' ⬇ low' : r > DUP_THRESH ? ' ⬆ high' : '';
                    return [
                      `Ratio: ${r.toFixed(3)}${tag}`,
                      `Cosmo: ${cosmo[i]?.toFixed(2)}×`,
                      `Panel: ${panel[i]?.toFixed(2)}×`,
                    ];
                  }
                  if (ctx.datasetIndex === 1) return `Diploid expected: 1.000`;
                  if (ctx.datasetIndex === 2) return `Deletion threshold: ${DEL_THRESH}`;
                  return `Duplication threshold: ${DUP_THRESH}`;
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
              ticks: { font: { size: 10 }, color: '#9ca3af',
                callback: (v) => Number(v).toFixed(1) },
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

  const chrom = data[selected];
  const ratio = chrom?.ratio ?? [];
  const low   = ratio.filter(r => r < DEL_THRESH).length;
  const high  = ratio.filter(r => r > DUP_THRESH).length;
  const meanR = ratio.length ? ratio.reduce((s, v) => s + v, 0) / ratio.length : 1;
  const hasUnusual = low + high > 0;
  const isChrX = selected === 'chrX';

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500 mb-3">
          Cosmo depth normalised to the 4-dog reference panel per 1 Mb window.
          Ratio 1.0 = diploid; 0.5 = hemizygous deletion; 1.5 = duplication.
        </p>

        {/* Chromosome selector */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CHR_ORDER.filter(c => data[c]).map(c => {
            const unusual = chromUnusual(data[c].ratio);
            const isX = c === 'chrX';
            return (
              <button
                key={c}
                onClick={() => setSelected(c)}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors relative ${
                  selected === c ? 'bg-[#3540CA] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.replace('chr', '')}
                {unusual > 0 && selected !== c && !isX && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-orange-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Mean ratio</p>
            <p className="text-lg font-semibold text-gray-800">{meanR.toFixed(3)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Windows</p>
            <p className="text-lg font-semibold text-gray-800">{ratio.length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Low (&lt;{DEL_THRESH})</p>
            <p className={`text-lg font-semibold ${low > 0 ? 'text-red-500' : 'text-gray-800'}`}>{low}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">High (&gt;{DUP_THRESH})</p>
            <p className={`text-lg font-semibold ${high > 0 ? 'text-orange-500' : 'text-gray-800'}`}>{high}</p>
          </div>
        </div>

        {isChrX && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-3 py-2 mb-3">
            chrX mean ratio {meanR.toFixed(2)} — consistent with male (hemizygous X vs panel average)
          </div>
        )}

        {!isChrX && hasUnusual && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2 mb-3 flex gap-4">
            {low  > 0 && <span>⬇ {low}  window{low  > 1 ? 's' : ''} below {DEL_THRESH} (possible deletion)</span>}
            {high > 0 && <span>⬆ {high} window{high > 1 ? 's' : ''} above {DUP_THRESH} (possible duplication)</span>}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative w-full h-56">
        <canvas ref={canvasRef} />
      </div>

      {/* Chromosome schematic */}
      <div
        className="w-full"
        style={{ paddingLeft: chartPad.left, paddingRight: chartPad.right }}
        title={`Schematic of ${selected}`}
      >
        <ChromosomeSchematic
          chrom={selected}
          nWindows={ratio.length}
          centromere={centromeres[selected]}
        />
        <p className="text-center text-[10px] text-gray-400 mt-0.5">
          {selected} — bars above show Cosmo/panel depth ratio along this chromosome
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#6366f1] inline-block" />
          Normal ({DEL_THRESH}–{DUP_THRESH})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          Low (&lt;{DEL_THRESH}, possible deletion)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />
          High (&gt;{DUP_THRESH}, possible duplication)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-amber-400 inline-block" />
          Diploid (1.0)
        </span>
      </div>
    </div>
  );
}
