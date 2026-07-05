'use client';

import { useEffect, useState } from 'react';

interface ComparisonRegion {
  chrom: string;
  del_start: number;
  del_end: number;
  plot_start: number;
  plot_end: number;
  window_bp: number;
  nelk_depths: number[];
  cosmo_depths: number[];
  panel_depths?: number[];
  nelk_del_pct: number;
  cosmo_del_pct: number;
  panel_del_pct?: number;
  artefact: boolean;
}

interface CoverageData {
  regions: ComparisonRegion[];
  nelk_mean: number;
  cosmo_mean: number;
  panel_mean?: number;
}

interface GeneModel {
  gene_id: string;
  name: string;
  start: number;
  end: number;
  strand: string;
  biotype: string;
  exons: [number, number][];
  cds: [number, number][];
}

type GeneData = Record<string, GeneModel[]>;

const GENE_COLORS: Record<string, string> = {
  protein_coding: '#6366f1',
  lncRNA: '#10b981',
};
const DEFAULT_GENE_COLOR = '#94a3b8';

function layoutGenes(genes: GeneModel[]): { gene: GeneModel; row: number }[] {
  const rows: number[] = [];
  return genes.map(g => {
    let row = 0;
    while (rows[row] !== undefined && rows[row] > g.start) row++;
    rows[row] = g.end;
    return { gene: g, row };
  });
}

function Track({
  depths, capY, trackTop, trackH, plotW, padLeft, n, binW, color, label, inDelFn,
}: {
  depths: number[]; capY: number; trackTop: number; trackH: number;
  plotW: number; padLeft: number; n: number; binW: number; color: string; label: string;
  inDelFn: (i: number) => boolean;
}) {
  const xBin = (i: number) => padLeft + (i / n) * plotW;
  const yVal = (d: number) => trackTop + trackH - (Math.min(d, capY) / capY) * trackH;
  const ticks = [0, capY / 2, capY];
  return (
    <g>
      <text x={padLeft - 4} y={trackTop + 7} textAnchor="end" fontSize={7} fontWeight="600" fill={color}>{label}</text>
      {ticks.map(v => {
        const y = yVal(v);
        return (
          <g key={v}>
            <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y}
              stroke={v === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth={v === 0 ? 1 : 0.5} />
            <text x={padLeft - 3} y={y + 3} textAnchor="end" fontSize={6} fill="#9ca3af">{v.toFixed(0)}×</text>
          </g>
        );
      })}
      <line x1={padLeft} x2={padLeft + plotW} y1={yVal(capY / 2)} y2={yVal(capY / 2)}
        stroke={color} strokeWidth={0.8} strokeDasharray="3,2" opacity={0.35} />
      {depths.map((d, i) => {
        const bh = (Math.min(d, capY) / capY) * trackH;
        const inDel = inDelFn(i);
        return <rect key={i} x={xBin(i)} y={trackTop + trackH - bh} width={binW} height={bh}
          fill={inDel ? '#ef4444' : color} opacity={inDel ? 0.55 : 0.45} />;
      })}
    </g>
  );
}

function ComparisonPlot({
  region, cosmoMean, panelMean, genes,
}: {
  region: ComparisonRegion; cosmoMean: number; panelMean: number; genes: GeneModel[];
}) {
  const W = 620;
  const PAD = { top: 8, right: 10, bottom: 6, left: 46 };
  const TRACK_H = 60;
  const TRACK_GAP = 5;
  const GENE_ROW_H = 14;
  const GENE_PAD_TOP = 10;

  const hasPanel = Array.isArray(region.panel_depths);
  const numTracks = hasPanel ? 2 : 1;

  const { cosmo_depths, panel_depths, del_start, del_end, plot_start, plot_end, chrom } = region;
  const n = cosmo_depths.length;
  const totalBp = plot_end - plot_start;
  const plotW = W - PAD.left - PAD.right;
  const binW = plotW / n;

  const layout = layoutGenes(genes);
  const nRows = layout.length > 0 ? Math.max(...layout.map(l => l.row)) + 1 : 0;
  const GENE_H = nRows > 0 ? GENE_PAD_TOP + nRows * GENE_ROW_H + 12 : 0;

  const cosmoCap = cosmoMean * 2;
  const panelCap = panelMean * 2;

  const totalTracksH = numTracks * TRACK_H + (numTracks - 1) * TRACK_GAP;
  const H = PAD.top + totalTracksH + GENE_H + PAD.bottom + 16;

  const xScale = (pos: number) => PAD.left + ((pos - plot_start) / totalBp) * plotW;

  const delX1 = xScale(del_start);
  const delX2 = xScale(del_end);

  const panelTop = PAD.top;
  const cosmoTop = hasPanel ? panelTop + TRACK_H + TRACK_GAP : PAD.top;
  const axisY    = cosmoTop + TRACK_H;
  const geneAreaY = axisY + 16 + GENE_PAD_TOP;

  const inDel = (i: number) => {
    const pos = plot_start + i * region.window_bp;
    return pos >= del_start && pos < del_end;
  };

  const tickIntervalBp = 100_000;
  const xTicks: { x: number; label: string }[] = [];
  const firstTick = Math.ceil(plot_start / tickIntervalBp) * tickIntervalBp;
  for (let pos = firstTick; pos <= plot_end; pos += tickIntervalBp) {
    xTicks.push({ x: xScale(pos), label: `${(pos / 1e6).toFixed(1)}` });
  }

  return (
    <div className={`border rounded-xl p-3 ${region.artefact ? 'bg-white border-gray-200' : 'bg-red-50/30 border-red-200'}`}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="text-xs font-semibold text-gray-700">
          {chrom}:{(del_start/1e6).toFixed(3)}–{(del_end/1e6).toFixed(3)} Mb
          {!region.artefact && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">confirmed deletion</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
          {hasPanel && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm inline-block" style={{background:'#10b981',opacity:0.6}} />
              Panel {panelMean}× ({region.panel_del_pct ?? '?'}% in del)
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm inline-block" style={{background:'#f59e0b',opacity:0.7}} />
            Cosmo {cosmoMean}× ({region.cosmo_del_pct}% in del)
          </span>
          {region.artefact && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">mappability artefact</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, display: 'block' }}>

          <rect x={delX1} y={PAD.top} width={delX2 - delX1} height={totalTracksH + GENE_H + 16}
            fill="#ef444408" stroke="#ef4444" strokeWidth={0.5} strokeDasharray="3,2" />

          {hasPanel && panel_depths && (
            <Track depths={panel_depths} capY={panelCap} trackTop={panelTop} trackH={TRACK_H}
              plotW={plotW} padLeft={PAD.left} n={n} binW={binW} color="#10b981" label="Panel" inDelFn={inDel} />
          )}

          <line x1={PAD.left} x2={W - PAD.right} y1={cosmoTop - TRACK_GAP / 2} y2={cosmoTop - TRACK_GAP / 2}
            stroke="#e5e7eb" strokeWidth={0.5} />

          <Track depths={cosmo_depths} capY={cosmoCap} trackTop={cosmoTop} trackH={TRACK_H}
            plotW={plotW} padLeft={PAD.left} n={n} binW={binW} color="#f59e0b" label="Cosmo" inDelFn={inDel} />

          <line x1={PAD.left} x2={W - PAD.right} y1={axisY} y2={axisY} stroke="#d1d5db" strokeWidth={1} />
          {xTicks.map(({ x, label }) => (
            <g key={label}>
              <line x1={x} x2={x} y1={axisY} y2={axisY + 3} stroke="#9ca3af" strokeWidth={0.5} />
              <text x={x} y={axisY + 9} textAnchor="middle" fontSize={7} fill="#9ca3af">{label}</text>
            </g>
          ))}
          <text x={W - PAD.right} y={axisY + 9} textAnchor="end" fontSize={7} fill="#9ca3af">Mb</text>

          {nRows > 0 && (
            <line x1={PAD.left} x2={W - PAD.right} y1={axisY + 16} y2={axisY + 16} stroke="#f3f4f6" strokeWidth={0.5} />
          )}
          {layout.map(({ gene, row }, gi) => {
            const gx1 = Math.max(xScale(gene.start), PAD.left);
            const gx2 = Math.min(xScale(gene.end), W - PAD.right);
            if (gx2 <= gx1) return null;
            const baseY = geneAreaY + row * GENE_ROW_H;
            const midY  = baseY + 4;
            const color = GENE_COLORS[gene.biotype] ?? DEFAULT_GENE_COLOR;
            const arrowDir = gene.strand === '+' ? 1 : -1;
            const arrows: number[] = [];
            for (let ax = gx1 + 15; ax < gx2 - 5; ax += 40) arrows.push(ax);
            return (
              <g key={gi}>
                <line x1={gx1} x2={gx2} y1={midY} y2={midY} stroke={color} strokeWidth={1} opacity={0.4} />
                {arrows.map((ax, ai) => (
                  <path key={ai}
                    d={arrowDir > 0
                      ? `M${ax-3},${midY-2} L${ax},${midY} L${ax-3},${midY+2}`
                      : `M${ax+3},${midY-2} L${ax},${midY} L${ax+3},${midY+2}`}
                    stroke={color} strokeWidth={0.8} fill="none" opacity={0.4} />
                ))}
                {gene.exons.map(([es, ee], ei) => {
                  const ex1 = Math.max(xScale(es), PAD.left);
                  const ex2 = Math.min(xScale(ee), W - PAD.right);
                  if (ex2 <= ex1) return null;
                  return <rect key={ei} x={ex1} y={midY - 3} width={ex2 - ex1} height={6}
                    fill={color} opacity={0.3} rx={1} />;
                })}
                {gene.cds.map(([cs, ce], ci) => {
                  const cx1 = Math.max(xScale(cs), PAD.left);
                  const cx2 = Math.min(xScale(ce), W - PAD.right);
                  if (cx2 <= cx1) return null;
                  return <rect key={ci} x={cx1} y={midY - 4.5} width={cx2 - cx1} height={9}
                    fill={color} opacity={0.7} rx={1} />;
                })}
                {(gx2 - gx1) > 20 && (
                  <text x={(gx1 + gx2) / 2} y={midY + 10} textAnchor="middle" fontSize={7} fill={color} fontWeight="500">
                    {gene.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[10px] text-gray-400 mt-1">
        {region.artefact
          ? '10 kb bins · both samples show the same low-coverage pattern → mappability dead zone in canFam4 reference'
          : '10 kb bins · NELK and reference panel show normal depth; only Cosmo is depleted → confident deletion'}
      </p>
    </div>
  );
}

const REGION_GENE_CHROM: Record<string, string> = {
  chr2: '2', chr13: '13', chr16: '16', chr19: '19', chr27: '27', chr35: '35',
};

export default function CnvCoverage({ samplePath = '' }: { samplePath?: string }) {
  const [covData,  setCovData]  = useState<CoverageData | null>(null);
  const [geneData, setGeneData] = useState<GeneData | null>(null);

  useEffect(() => {
    fetch(`${samplePath}/cnv_coverage.json`)
      .then(r => r.ok ? r.json() : null).then(d => d && setCovData(d)).catch(() => {});
    fetch(`${samplePath}/cnv_genes.json`)
      .then(r => r.ok ? r.json() : null).then(d => d && setGeneData(d)).catch(() => {});
  }, [samplePath]);

  if (!covData) return null;

  const realRegions = covData.regions.filter(r => !r.artefact);

  if (realRegions.length === 0) return null;

  return (
    <div className="space-y-3 mt-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Coverage profiles
      </h3>
      {realRegions.map(r => (
        <ComparisonPlot key={r.chrom} region={r}
          cosmoMean={covData.cosmo_mean}
          panelMean={covData.panel_mean ?? 8.76}
          genes={geneData?.[REGION_GENE_CHROM[r.chrom] ?? ''] ?? []} />
      ))}
    </div>
  );
}
