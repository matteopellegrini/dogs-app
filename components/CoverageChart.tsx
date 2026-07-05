'use client';

import { useEffect, useRef, useState } from 'react';

interface ChromData {
  cosmo:  number[];
  panel:  number[];
  ratio:  number[];
}

interface Centromeres {
  [chrom: string]: [number, number];
}

interface CoverageData {
  [chrom: string]: ChromData;
}

interface GeneMap {
  [chrom: string]: { [mb: string]: string[] };
}

const CHR_ORDER = [...Array(38).keys()].map((i) => `chr${i + 1}`).concat(['chrX']);

const DEL_THRESH = 0.65;
const DUP_THRESH = 1.35;
const CONTEXT_WINDOWS = 3;   // flanking Mb windows around each flagged region

function barColor(r: number) {
  if (r < DEL_THRESH) return '#E24B4A';
  if (r > DUP_THRESH) return '#f97316';
  return '#6366f1';
}

function chromUnusual(ratios: number[]) {
  return ratios.filter(r => r < DEL_THRESH || r > DUP_THRESH).length;
}

interface OutlierRegion { startIdx: number; endIdx: number; }

function groupOutliers(ratio: number[], gap = 2): OutlierRegion[] {
  const idxs = ratio.map((r, i) => i).filter(i => ratio[i] < DEL_THRESH || ratio[i] > DUP_THRESH);
  if (!idxs.length) return [];
  const out: OutlierRegion[] = [];
  let s = idxs[0], e = idxs[0];
  for (let k = 1; k < idxs.length; k++) {
    if (idxs[k] - e <= gap) { e = idxs[k]; } else { out.push({ startIdx: s, endIdx: e }); s = e = idxs[k]; }
  }
  out.push({ startIdx: s, endIdx: e });
  return out;
}

function ZoomedChart({
  chrom, ratio, region, cosmo, panel,
}: {
  chrom: string; ratio: number[]; region: OutlierRegion; cosmo: number[]; panel: number[];
}) {
  const vs = Math.max(0, region.startIdx - CONTEXT_WINDOWS);
  const ve = Math.min(ratio.length - 1, region.endIdx + CONTEXT_WINDOWS);
  const slice = ratio.slice(vs, ve + 1);

  const W = 600, H = 150;
  const PAD = { top: 14, right: 16, bottom: 26, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const barW  = plotW / slice.length;

  const yMax = Math.max(DUP_THRESH + 0.3, Math.max(...slice) * 1.05);
  const yScale = (v: number) => PAD.top + plotH - (Math.min(v, yMax) / yMax) * plotH;

  const refLines = [
    { v: 1.0,        color: '#f59e0b', dash: '4,3' },
    { v: DEL_THRESH, color: '#E24B4A', dash: '2,4' },
    { v: DUP_THRESH, color: '#f97316', dash: '2,4' },
  ];

  const yTicks = [0, 0.5, 1.0, 1.5, 2.0].filter(v => v <= yMax + 0.05);

  // highlight box over flagged window indices within the slice
  const hlStart = region.startIdx - vs;
  const hlEnd   = region.endIdx   - vs;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      className="w-full overflow-visible" style={{ maxWidth: W, display: 'block' }}>

      {/* highlight band */}
      <rect
        x={PAD.left + hlStart * barW} y={PAD.top}
        width={(hlEnd - hlStart + 1) * barW} height={plotH}
        fill={ratio[region.startIdx] < DEL_THRESH ? '#E24B4A10' : '#f9731610'}
        stroke={ratio[region.startIdx] < DEL_THRESH ? '#E24B4A' : '#f97316'}
        strokeWidth={0.5} strokeDasharray="3,2"
      />

      {/* y grid + ticks */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yScale(v)} y2={yScale(v)}
            stroke="#f3f4f6" strokeWidth={v === 0 ? 1 : 0.5} />
          <text x={PAD.left - 5} y={yScale(v) + 3.5} textAnchor="end" fontSize={8} fill="#9ca3af">
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* reference lines */}
      {refLines.map(({ v, color, dash }) => (
        <line key={v} x1={PAD.left} x2={W - PAD.right} y1={yScale(v)} y2={yScale(v)}
          stroke={color} strokeWidth={1.2} strokeDasharray={dash} />
      ))}

      {/* bars */}
      {slice.map((r, i) => {
        const bh = (Math.min(r, yMax) / yMax) * plotH;
        const x  = PAD.left + i * barW;
        return (
          <g key={i}>
            <rect x={x + 0.5} y={yScale(r)} width={Math.max(barW - 1, 1)} height={bh}
              fill={barColor(r)} opacity={0.8} rx={1} />
          </g>
        );
      })}

      {/* x axis */}
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom}
        stroke="#d1d5db" strokeWidth={1} />
      {slice.map((_, i) => {
        const mbPos = vs + i;
        const x = PAD.left + (i + 0.5) * barW;
        const show = slice.length <= 12 || i % 2 === 0;
        return show ? (
          <g key={i}>
            <line x1={x} x2={x} y1={H - PAD.bottom} y2={H - PAD.bottom + 3} stroke="#9ca3af" strokeWidth={0.5} />
            <text x={x} y={H - PAD.bottom + 10} textAnchor="middle" fontSize={7.5} fill="#9ca3af">
              {mbPos}Mb
            </text>
          </g>
        ) : null;
      })}

      {/* y axis label */}
      <text
        x={10} y={PAD.top + plotH / 2} textAnchor="middle" fontSize={7.5} fill="#9ca3af"
        transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}
      >
        Ratio
      </text>

      {/* region label */}
      <text x={W - PAD.right} y={PAD.top - 3} textAnchor="end" fontSize={8} fill="#6b7280" fontWeight="600">
        {chrom}:{region.startIdx}–{region.endIdx} Mb
      </text>
    </svg>
  );
}

function OutlierDetail({
  chrom, ratio, cosmo, panel, geneMap,
}: {
  chrom: string; ratio: number[]; cosmo: number[]; panel: number[];
  geneMap: { [mb: string]: string[] } | undefined;
}) {
  const regions = groupOutliers(ratio);
  if (!regions.length) return null;

  return (
    <div className="mt-4 space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Flagged regions — zoomed view
      </h3>

      {regions.map((reg, ri) => {
        const type = ratio[reg.startIdx] < DEL_THRESH ? 'del' : 'dup';
        const meanRatio = ratio
          .slice(reg.startIdx, reg.endIdx + 1)
          .reduce((s, v) => s + v, 0) / (reg.endIdx - reg.startIdx + 1);

        // Collect genes from all flagged windows in this region
        const geneSet = new Set<string>();
        for (let mb = reg.startIdx; mb <= reg.endIdx; mb++) {
          (geneMap?.[String(mb)] ?? []).forEach(g => geneSet.add(g));
        }
        const genes = [...geneSet].sort();

        return (
          <div key={ri} className={`border rounded-xl p-3 ${
            type === 'del' ? 'bg-red-50/30 border-red-200' : 'bg-orange-50/30 border-orange-200'
          }`}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-semibold ${type === 'del' ? 'text-red-700' : 'text-orange-700'}`}>
                {chrom}:{reg.startIdx}–{reg.endIdx + 1} Mb
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                type === 'del' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {type === 'del' ? '⬇ possible deletion' : '⬆ possible duplication'}
              </span>
              <span className="text-[10px] text-gray-400">
                {reg.endIdx - reg.startIdx + 1} window{reg.endIdx !== reg.startIdx ? 's' : ''} · mean ratio {meanRatio.toFixed(3)}
              </span>
            </div>

            <div className="overflow-x-auto -mx-1">
              <ZoomedChart chrom={chrom} ratio={ratio} region={reg} cosmo={cosmo} panel={panel} />
            </div>

            {genes.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Genes in flagged region ({genes.length})
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 text-left">
                        <th className="py-1 pr-6 font-medium">Gene</th>
                        <th className="py-1 font-medium">Window(s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {genes.map(gene => {
                        const windows = [];
                        for (let mb = reg.startIdx; mb <= reg.endIdx; mb++) {
                          if ((geneMap?.[String(mb)] ?? []).includes(gene)) windows.push(`${mb}–${mb + 1} Mb`);
                        }
                        return (
                          <tr key={gene} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="py-1 pr-6 font-semibold text-gray-700">{gene}</td>
                            <td className="py-1 text-gray-400 font-mono text-[10px]">{windows.join(', ')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {genes.length === 0 && (
              <p className="text-[10px] text-gray-400 mt-2">No annotated genes in flagged windows.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChromosomeSchematic({
  chrom, nWindows, centromere,
}: {
  chrom: string;
  nWindows: number;
  centromere?: [number, number];
}) {
  const W = nWindows;
  const H = 24;
  const midY = H / 2;
  const armH = 12;
  const cenH = 6;
  const capR = armH / 2;

  const cenStartMb = centromere ? centromere[0] / 1_000_000 : W * 0.45;
  const cenEndMb   = centromere ? centromere[1] / 1_000_000 : W * 0.55;
  const cenMid     = (cenStartMb + cenEndMb) / 2;

  const cs = Math.max(capR, Math.min(cenStartMb, W - capR));
  const ce = Math.max(cs + 0.5, Math.min(cenEndMb, W - capR));

  const pPath = [
    `M ${capR},${midY - armH/2}`,
    `A ${capR} ${capR} 0 0 0 ${capR},${midY + armH/2}`,
    `L ${cs},${midY + armH/2}`,
    `Q ${cenMid},${midY + cenH/2} ${ce},${midY + armH/2}`,
    `L ${ce},${midY - armH/2}`,
    `Q ${cenMid},${midY - cenH/2} ${cs},${midY - armH/2}`,
    `Z`,
  ].join(' ');

  const qPath = [
    `M ${ce},${midY - armH/2}`,
    `Q ${cenMid},${midY - cenH/2} ${cs},${midY - armH/2}`,
    `L ${cs},${midY + armH/2}`,
    `Q ${cenMid},${midY + cenH/2} ${ce},${midY + armH/2}`,
    `L ${W - capR},${midY + armH/2}`,
    `A ${capR} ${capR} 0 0 0 ${W - capR},${midY - armH/2}`,
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
      <path d={pPath} fill="#c7caf0" stroke="#3540CA" strokeWidth={0.4} />
      <path d={qPath} fill="#c7caf0" stroke="#3540CA" strokeWidth={0.4} />
      <ellipse
        cx={cenMid} cy={midY}
        rx={(ce - cs) / 2 + 0.5} ry={cenH / 2}
        fill="#6366f1" stroke="#3540CA" strokeWidth={0.4}
      />
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
  const [geneData, setGeneData]   = useState<GeneMap>({});
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
    fetch('/cosmo/genes_1mb.json')
      .then(r => r.ok ? r.json() : {})
      .then((d: GeneMap) => setGeneData(d))
      .catch(() => {});
  }, [samplePath]);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const chrom = data[selected];
    if (!chrom) return;

    const { ratio, cosmo, panel } = chrom;

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
  const cosmo = chrom?.cosmo ?? [];
  const panel = chrom?.panel ?? [];
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

      {/* Main chart */}
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

      {/* Zoomed outlier regions + gene tables */}
      {!isChrX && hasUnusual && (
        <OutlierDetail
          chrom={selected}
          ratio={ratio}
          cosmo={cosmo}
          panel={panel}
          geneMap={geneData[selected]}
        />
      )}
    </div>
  );
}
