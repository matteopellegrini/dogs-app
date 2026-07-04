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
  nelk_del_pct: number;
  cosmo_del_pct: number;
  artefact: boolean;
}

interface CoverageData {
  regions: ComparisonRegion[];
  nelk_mean: number;
  cosmo_mean: number;
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

function ComparisonPlot({
  region,
  nelkMean,
  cosmoMean,
  genes,
}: {
  region: ComparisonRegion;
  nelkMean: number;
  cosmoMean: number;
  genes: GeneModel[];
}) {
  const W = 600;
  const PAD = { top: 8, right: 10, bottom: 6, left: 42 };
  const TRACK_H = 70;
  const TRACK_GAP = 6;
  const GENE_ROW_H = 14;
  const GENE_PAD_TOP = 10;

  const { nelk_depths, cosmo_depths, del_start, del_end, plot_start, plot_end, chrom } = region;
  const n = nelk_depths.length;
  const totalBp = plot_end - plot_start;
  const plotW = W - PAD.left - PAD.right;

  const layout = layoutGenes(genes);
  const nRows = layout.length > 0 ? Math.max(...layout.map(l => l.row)) + 1 : 0;
  const GENE_H = nRows > 0 ? GENE_PAD_TOP + nRows * GENE_ROW_H + 12 : 0;

  const nelkCapY = nelkMean * 2;
  const cosmoCapY = cosmoMean * 3;

  const H = PAD.top + TRACK_H + TRACK_GAP + TRACK_H + GENE_H + PAD.bottom + 16; // 16 for x-axis

  const xScale = (pos: number) => PAD.left + ((pos - plot_start) / totalBp) * plotW;
  const xBin   = (i: number)   => PAD.left + (i / n) * plotW;
  const binW   = plotW / n;

  const nelkY  = (d: number, trackTop: number) =>
    trackTop + TRACK_H - (Math.min(d, nelkCapY)  / nelkCapY)  * TRACK_H;
  const cosmoY = (d: number, trackTop: number) =>
    trackTop + TRACK_H - (Math.min(d, cosmoCapY) / cosmoCapY) * TRACK_H;

  const delX1 = xScale(del_start);
  const delX2 = xScale(del_end);

  const nelkTrackTop  = PAD.top;
  const cosmoTrackTop = PAD.top + TRACK_H + TRACK_GAP;
  const axisY = cosmoTrackTop + TRACK_H;
  const geneAreaY = axisY + 16 + GENE_PAD_TOP;

  const tickIntervalBp = 200_000;
  const xTicks: { x: number; label: string }[] = [];
  const firstTick = Math.ceil(plot_start / tickIntervalBp) * tickIntervalBp;
  for (let pos = firstTick; pos <= plot_end; pos += tickIntervalBp) {
    xTicks.push({ x: xScale(pos), label: `${(pos / 1e6).toFixed(1)}` });
  }

  const nelkTicks  = [0, nelkMean,  nelkMean * 2].map(v => ({ v, y: nelkY(v,  nelkTrackTop) }));
  const cosmoTicks = [0, cosmoMean, cosmoMean * 2].map(v => ({ v, y: cosmoY(v, cosmoTrackTop) }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-700">
          {chrom}:{(del_start/1e6).toFixed(2)}–{(del_end/1e6).toFixed(2)} Mb
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm inline-block" style={{background:'#6366f1', opacity:0.6}} />
            NELK {nelkMean}× ({region.nelk_del_pct}% in del)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm inline-block" style={{background:'#f59e0b', opacity:0.7}} />
            Cosmo {cosmoMean}× ({region.cosmo_del_pct}% in del)
          </span>
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">mappability artefact</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, display: 'block' }}>

        {/* Deletion highlight */}
        <rect x={delX1} y={PAD.top} width={delX2-delX1} height={TRACK_H+TRACK_GAP+TRACK_H+GENE_H+16}
          fill="#ef444408" stroke="#ef4444" strokeWidth={0.5} strokeDasharray="3,2" />

        {/* ── NELK track ── */}
        <text x={PAD.left - 4} y={nelkTrackTop + 6} textAnchor="end" fontSize={7} fontWeight="600" fill="#6366f1">NELK</text>
        {nelkTicks.map(({v, y}) => (
          <g key={v}>
            <line x1={PAD.left} x2={W-PAD.right} y1={y} y2={y}
              stroke={v===0?'#d1d5db':'#f3f4f6'} strokeWidth={v===0?1:0.5} />
            <text x={PAD.left-3} y={y+3} textAnchor="end" fontSize={6} fill="#9ca3af">{v.toFixed(0)}×</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W-PAD.right} y1={nelkY(nelkMean, nelkTrackTop)} y2={nelkY(nelkMean, nelkTrackTop)}
          stroke="#6366f1" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.4} />
        {nelk_depths.map((d, i) => {
          const bh = (Math.min(d, nelkCapY) / nelkCapY) * TRACK_H;
          const inDel = (plot_start + i*region.window_bp) >= del_start && (plot_start + i*region.window_bp) < del_end;
          return <rect key={i} x={xBin(i)} y={nelkTrackTop+TRACK_H-bh} width={binW} height={bh}
            fill={inDel ? '#ef4444' : '#6366f1'} opacity={inDel ? 0.5 : 0.4} />;
        })}

        {/* Divider */}
        <line x1={PAD.left} x2={W-PAD.right} y1={nelkTrackTop+TRACK_H+TRACK_GAP/2}
          y2={nelkTrackTop+TRACK_H+TRACK_GAP/2} stroke="#e5e7eb" strokeWidth={0.5} />

        {/* ── Cosmo track ── */}
        <text x={PAD.left-4} y={cosmoTrackTop+6} textAnchor="end" fontSize={7} fontWeight="600" fill="#f59e0b">Cosmo</text>
        {cosmoTicks.map(({v, y}) => (
          <g key={v}>
            <line x1={PAD.left} x2={W-PAD.right} y1={y} y2={y}
              stroke={v===0?'#d1d5db':'#f3f4f6'} strokeWidth={v===0?1:0.5} />
            <text x={PAD.left-3} y={y+3} textAnchor="end" fontSize={6} fill="#9ca3af">{v.toFixed(1)}×</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W-PAD.right} y1={cosmoY(cosmoMean, cosmoTrackTop)} y2={cosmoY(cosmoMean, cosmoTrackTop)}
          stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.4} />
        {cosmo_depths.map((d, i) => {
          const bh = (Math.min(d, cosmoCapY) / cosmoCapY) * TRACK_H;
          const inDel = (plot_start + i*region.window_bp) >= del_start && (plot_start + i*region.window_bp) < del_end;
          return <rect key={i} x={xBin(i)} y={cosmoTrackTop+TRACK_H-bh} width={binW} height={bh}
            fill={inDel ? '#ef4444' : '#f59e0b'} opacity={inDel ? 0.5 : 0.55} />;
        })}

        {/* X-axis */}
        <line x1={PAD.left} x2={W-PAD.right} y1={axisY} y2={axisY} stroke="#d1d5db" strokeWidth={1} />
        {xTicks.map(({x, label}) => (
          <g key={label}>
            <line x1={x} x2={x} y1={axisY} y2={axisY+3} stroke="#9ca3af" strokeWidth={0.5} />
            <text x={x} y={axisY+9} textAnchor="middle" fontSize={7} fill="#9ca3af">{label}</text>
          </g>
        ))}
        <text x={W-PAD.right} y={axisY+9} textAnchor="end" fontSize={7} fill="#9ca3af">Mb</text>

        {/* ── Gene track ── */}
        {nRows > 0 && (
          <line x1={PAD.left} x2={W-PAD.right} y1={axisY+16} y2={axisY+16} stroke="#f3f4f6" strokeWidth={0.5} />
        )}
        {layout.map(({ gene, row }, gi) => {
          const gx1 = Math.max(xScale(gene.start), PAD.left);
          const gx2 = Math.min(xScale(gene.end), W-PAD.right);
          if (gx2 <= gx1) return null;
          const baseY = geneAreaY + row * GENE_ROW_H;
          const midY  = baseY + 4;
          const color = GENE_COLORS[gene.biotype] ?? DEFAULT_GENE_COLOR;
          const arrowDir = gene.strand === '+' ? 1 : -1;
          const arrows: number[] = [];
          for (let ax = gx1+15; ax < gx2-5; ax += 40) arrows.push(ax);
          return (
            <g key={gi}>
              <line x1={gx1} x2={gx2} y1={midY} y2={midY} stroke={color} strokeWidth={1} opacity={0.4} />
              {arrows.map((ax, ai) => (
                <path key={ai}
                  d={arrowDir>0
                    ? `M${ax-3},${midY-2} L${ax},${midY} L${ax-3},${midY+2}`
                    : `M${ax+3},${midY-2} L${ax},${midY} L${ax+3},${midY+2}`}
                  stroke={color} strokeWidth={0.8} fill="none" opacity={0.4} />
              ))}
              {gene.exons.map(([es, ee], ei) => {
                const ex1 = Math.max(xScale(es), PAD.left);
                const ex2 = Math.min(xScale(ee), W-PAD.right);
                if (ex2 <= ex1) return null;
                return <rect key={ei} x={ex1} y={midY-3} width={ex2-ex1} height={6}
                  fill={color} opacity={0.3} rx={1} />;
              })}
              {gene.cds.map(([cs, ce], ci) => {
                const cx1 = Math.max(xScale(cs), PAD.left);
                const cx2 = Math.min(xScale(ce), W-PAD.right);
                if (cx2 <= cx1) return null;
                return <rect key={ci} x={cx1} y={midY-4.5} width={cx2-cx1} height={9}
                  fill={color} opacity={0.7} rx={1} />;
              })}
              {(gx2-gx1) > 20 && (
                <text x={(gx1+gx2)/2} y={midY+10} textAnchor="middle" fontSize={7} fill={color} fontWeight="500">
                  {gene.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      </div>
      <p className="text-[10px] text-gray-400 mt-1">
        10 kb bins · both samples show the same low-coverage pattern → mappability dead zone in canFam4 reference
      </p>
    </div>
  );
}

const REGION_GENE_CHROM: Record<string, string> = {
  chr2: '2', chr13: '13', chr16: '16', chr19: '19', chr27: '27',
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

  return (
    <div className="space-y-3 mt-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Coverage profiles — NELK vs Cosmo
      </h3>
      {covData.regions.map(r => (
        <ComparisonPlot
          key={r.chrom}
          region={r}
          nelkMean={covData.nelk_mean}
          cosmoMean={covData.cosmo_mean}
          genes={geneData?.[REGION_GENE_CHROM[r.chrom] ?? ''] ?? []}
        />
      ))}
    </div>
  );
}
