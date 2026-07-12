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

interface ZoomRegion {
  chrom: string;
  view_start: number; view_end: number;
  flag_start: number; flag_end: number;
  window_bp: number;
  cosmo_depths: number[];
  panel_depths: number[];
  cosmo_mean: number;
  panel_mean: number;
}

interface ZoomData {
  [key: string]: ZoomRegion;
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

function DualTrackPlot({ zoom }: { zoom: ZoomRegion }) {
  const {
    chrom, view_start, view_end, flag_start, flag_end,
    window_bp, cosmo_depths, panel_depths, cosmo_mean, panel_mean,
  } = zoom;

  const W = 620;
  const PAD = { top: 8, right: 10, bottom: 6, left: 46 };
  const TRACK_H = 60;
  const TRACK_GAP = 5;
  const n = cosmo_depths.length;
  const totalBp = view_end - view_start;
  const plotW = W - PAD.left - PAD.right;
  const binW  = plotW / n;

  const cosmoCap = cosmo_mean * 2;
  const panelCap = panel_mean * 2;

  const panelTop = PAD.top;
  const cosmoTop = panelTop + TRACK_H + TRACK_GAP;
  const axisY    = cosmoTop + TRACK_H;
  const totalTracksH = 2 * TRACK_H + TRACK_GAP;
  const H = PAD.top + totalTracksH + PAD.bottom + 20;

  const xBin   = (i: number) => PAD.left + (i / n) * plotW;
  const xScale = (pos: number) => PAD.left + ((pos - view_start) / totalBp) * plotW;
  const yVal   = (d: number, cap: number, top: number) =>
    top + TRACK_H - (Math.min(d, cap) / cap) * TRACK_H;

  const inFlag = (i: number) => {
    const pos = view_start + i * window_bp;
    return pos >= flag_start && pos < flag_end;
  };

  const delX1 = xScale(flag_start);
  const delX2 = xScale(flag_end);

  // x-axis ticks every 1 Mb
  const tickBp = 1_000_000;
  const xTicks: { x: number; label: string }[] = [];
  const first = Math.ceil(view_start / tickBp) * tickBp;
  for (let pos = first; pos <= view_end; pos += tickBp) {
    xTicks.push({ x: xScale(pos), label: `${(pos / 1e6).toFixed(0)}` });
  }

  function Track({
    depths, cap, top, color, label,
  }: { depths: number[]; cap: number; top: number; color: string; label: string }) {
    const ticks = [0, cap / 2, cap];
    return (
      <g>
        <text x={PAD.left - 4} y={top + 7} textAnchor="end" fontSize={7} fontWeight="600" fill={color}>{label}</text>
        {ticks.map(v => {
          const y = yVal(v, cap, top);
          return (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y}
                stroke={v === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth={v === 0 ? 1 : 0.5} />
              <text x={PAD.left - 3} y={y + 3} textAnchor="end" fontSize={6} fill="#9ca3af">{v.toFixed(0)}×</text>
            </g>
          );
        })}
        {/* mean dashed line */}
        <line x1={PAD.left} x2={PAD.left + plotW}
          y1={yVal(cap / 2, cap, top)} y2={yVal(cap / 2, cap, top)}
          stroke={color} strokeWidth={0.8} strokeDasharray="3,2" opacity={0.35} />
        {depths.map((d, i) => {
          const bh = (Math.min(d, cap) / cap) * TRACK_H;
          const flagged = inFlag(i);
          return <rect key={i} x={xBin(i)} y={top + TRACK_H - bh} width={Math.max(binW, 0.5)} height={bh}
            fill={flagged ? '#ef4444' : color} opacity={flagged ? 0.55 : 0.45} />;
        })}
      </g>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, display: 'block' }}>
        {/* flagged region highlight */}
        <rect x={delX1} y={PAD.top} width={delX2 - delX1} height={totalTracksH + 16}
          fill="#ef444408" stroke="#ef4444" strokeWidth={0.5} strokeDasharray="3,2" />

        <Track depths={panel_depths} cap={panelCap} top={panelTop} color="#10b981" label="Panel" />
        <line x1={PAD.left} x2={W - PAD.right} y1={cosmoTop - TRACK_GAP / 2} y2={cosmoTop - TRACK_GAP / 2}
          stroke="#e5e7eb" strokeWidth={0.5} />
        <Track depths={cosmo_depths} cap={cosmoCap} top={cosmoTop} color="#f59e0b" label="Sample" />

        {/* x axis */}
        <line x1={PAD.left} x2={W - PAD.right} y1={axisY} y2={axisY} stroke="#d1d5db" strokeWidth={1} />
        {xTicks.map(({ x, label }) => (
          <g key={label}>
            <line x1={x} x2={x} y1={axisY} y2={axisY + 3} stroke="#9ca3af" strokeWidth={0.5} />
            <text x={x} y={axisY + 9} textAnchor="middle" fontSize={7} fill="#9ca3af">{label}</text>
          </g>
        ))}
        <text x={W - PAD.right} y={axisY + 9} textAnchor="end" fontSize={7} fill="#9ca3af">Mb</text>
      </svg>
    </div>
  );
}

function OutlierDetail({
  chrom, ratio, geneMap, zoomData,
}: {
  chrom: string; ratio: number[];
  geneMap: { [mb: string]: string[] } | undefined;
  zoomData: ZoomData;
}) {
  const regions = groupOutliers(ratio);
  if (!regions.length) return null;

  return (
    <div className="mt-4 space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Flagged regions — zoomed view (10 kb bins)
      </h3>

      {regions.map((reg, ri) => {
        const type = ratio[reg.startIdx] < DEL_THRESH ? 'del' : 'dup';
        const meanRatio = ratio
          .slice(reg.startIdx, reg.endIdx + 1)
          .reduce((s, v) => s + v, 0) / (reg.endIdx - reg.startIdx + 1);

        // Look up pre-computed 10kb zoom for this region
        const vs = Math.max(0, reg.startIdx - CONTEXT_WINDOWS) * 1_000_000;
        const ve = (reg.endIdx + CONTEXT_WINDOWS + 1) * 1_000_000;
        const zoomKey = `${chrom}:${vs}-${ve}`;
        const zoom = zoomData[zoomKey];

        // Collect genes from flagged Mb windows
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
                {reg.endIdx - reg.startIdx + 1} Mb window{reg.endIdx !== reg.startIdx ? 's' : ''} · mean ratio {meanRatio.toFixed(3)}
              </span>
              {/* track legend */}
              <span className="ml-auto flex items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-2 rounded-sm inline-block" style={{background:'#10b981',opacity:0.6}} />
                  Panel (4-dog ref)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-2 rounded-sm inline-block" style={{background:'#f59e0b',opacity:0.7}} />
                  Sample
                </span>
              </span>
            </div>

            {zoom ? (
              <DualTrackPlot zoom={zoom} />
            ) : (
              <p className="text-[10px] text-gray-400 py-4 text-center">10 kb data not available for this region.</p>
            )}

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
  const [zoomData, setZoomData]   = useState<ZoomData>({});
  const [selected, setSelected]   = useState('chr1');
  const [chartPad, setChartPad]   = useState({ left: '0px', right: '0px' });
  const setPadRef  = useRef(setChartPad);
  const padDoneRef = useRef(false);

  useEffect(() => {
    fetch(`${samplePath}/coverage_1mb.json`)
      .then(r => r.json())
      .then((d: CoverageData) => setData(d));
    fetch(`${samplePath}/centromeres.json`)
      .then(r => r.ok ? r.json() : {})
      .then((d: Centromeres) => setCentromeres(d))
      .catch(() => {});
    fetch(`${samplePath}/genes_1mb.json`)
      .then(r => r.ok ? r.json() : {})
      .then((d: GeneMap) => setGeneData(d))
      .catch(() => {});
    fetch(`${samplePath}/karyotype_zoom.json`)
      .then(r => r.ok ? r.json() : {})
      .then((d: ZoomData) => setZoomData(d))
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
                      `Sample: ${cosmo[i]?.toFixed(2)}×`,
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
  const isChrX     = selected === 'chrX';

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500 mb-3">
          Sample depth normalised to the reference panel per 1 Mb window.
          Autosomes: 4-dog panel (Gen-2, Gen-3, Gen-30, Gen-47).
          chrX: 3-male panel (Gen-6, Gen-9, Gen-47).
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
            chrX normalised to 3-male reference panel (Gen-6, Gen-9, Gen-47) — ratio 1.0 confirms one intact X (expected for female; ~0.5 for male).
          </div>
        )}

        {hasUnusual && (
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
        {/* Chromosome schematic legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-1.5 text-[10px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <svg width="22" height="10" viewBox="0 0 22 10">
              <path d="M3,1 A3 3 0 0 0 3,9 L19,9 A3 3 0 0 0 19,1 Z"
                fill="#c7caf0" stroke="#3540CA" strokeWidth="0.8" />
            </svg>
            Chromosome arm
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="10" viewBox="0 0 14 10">
              <ellipse cx="7" cy="5" rx="6" ry="4" fill="#6366f1" stroke="#3540CA" strokeWidth="0.8" />
            </svg>
            Centromere
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="10" viewBox="0 0 14 10">
              <path d="M7,1 A6 4 0 0 0 7,9 A6 4 0 0 0 7,1"
                fill="#c7caf0" stroke="#3540CA" strokeWidth="0.8" />
            </svg>
            Telomere (rounded cap)
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-[#3540CA]">
            p
            <span className="font-normal text-gray-400">short arm</span>
            ·
            <span className="font-semibold text-[#3540CA]">q</span>
            <span className="font-normal text-gray-400">long arm</span>
          </span>
        </div>
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
      {hasUnusual && (
        <OutlierDetail
          chrom={selected}
          ratio={ratio}
          geneMap={geneData[selected]}
          zoomData={zoomData}
        />
      )}
    </div>
  );
}
