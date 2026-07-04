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

type GeneData = Record<string, GeneModel[]>;  // chrom (no "chr") -> genes

const ZYG_LABEL: Record<string, { label: string; color: string }> = {
  likely_hom: { label: 'likely hom del', color: '#ef4444' },
  ambiguous:  { label: 'ambiguous',      color: '#f59e0b' },
  likely_het: { label: 'likely het del', color: '#3b82f6' },
};

const GENE_COLORS: Record<string, string> = {
  protein_coding: '#6366f1',
  lncRNA: '#10b981',
  processed_pseudogene: '#9ca3af',
  unprocessed_pseudogene: '#9ca3af',
};
const DEFAULT_GENE_COLOR = '#94a3b8';

// Assign non-overlapping rows to genes
function layoutGenes(genes: GeneModel[]): { gene: GeneModel; row: number }[] {
  const rows: number[] = [];
  return genes.map(g => {
    let row = 0;
    while (rows[row] !== undefined && rows[row] > g.start) row++;
    rows[row] = g.end;
    return { gene: g, row };
  });
}

function CoveragePlot({
  region,
  genomeMean,
  zygosity,
  genes,
}: {
  region: CoverageRegion;
  genomeMean: number;
  zygosity?: string;
  genes: GeneModel[];
}) {
  const W = 600;
  const PAD = { top: 12, right: 10, bottom: 6, left: 38 };
  const COV_H = 100;
  const GENE_ROW_H = 14;
  const GENE_PAD_TOP = 8;

  const { depths, del_start, del_end, plot_start, plot_end, chrom } = region;
  const n = depths.length;
  const totalBp = plot_end - plot_start;

  const layout = layoutGenes(genes);
  const nRows = layout.length > 0 ? Math.max(...layout.map(l => l.row)) + 1 : 0;
  const GENE_H = GENE_PAD_TOP + nRows * GENE_ROW_H + 14; // +14 for gene labels
  const H = PAD.top + COV_H + GENE_H + PAD.bottom;

  const xScale = (pos: number) => PAD.left + ((pos - plot_start) / totalBp) * (W - PAD.left - PAD.right);
  const xBin   = (i: number) => PAD.left + (i / n) * (W - PAD.left - PAD.right);
  const binW   = (W - PAD.left - PAD.right) / n;

  const cap = genomeMean * 3;
  const yScale = (d: number) => PAD.top + COV_H - (Math.min(d, cap) / cap) * COV_H;

  const delX1 = xScale(del_start);
  const delX2 = xScale(del_end);

  const yTicks = [0, 1, 2, 3].map(m => m * genomeMean);

  const tickIntervalBp = 200_000;
  const xTicks: { x: number; label: string }[] = [];
  const firstTick = Math.ceil(plot_start / tickIntervalBp) * tickIntervalBp;
  for (let pos = firstTick; pos <= plot_end; pos += tickIntervalBp) {
    xTicks.push({ x: xScale(pos), label: `${(pos / 1e6).toFixed(1)}` });
  }

  const geneAreaY = PAD.top + COV_H + GENE_PAD_TOP;
  const zyg = zygosity ? ZYG_LABEL[zygosity] : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-gray-700">
          {chrom}:{(del_start / 1e6).toFixed(2)}–{(del_end / 1e6).toFixed(2)} Mb
        </div>
        {zyg && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: zyg.color + '22', color: zyg.color }}>
            {zyg.label}
          </span>
        )}
      </div>

      <div className="overflow-x-auto -mx-1">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, display: 'block' }}>
        {/* Deletion highlight spans full height */}
        <rect x={delX1} y={PAD.top} width={delX2 - delX1} height={COV_H + GENE_H}
          fill="#ef444411" stroke="#ef4444" strokeWidth={0.5} strokeDasharray="3,2" />

        {/* ── Coverage track ── */}
        {yTicks.map(v => {
          const y = yScale(v);
          return (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke={v === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth={v === 0 ? 1 : 0.5} />
              <text x={PAD.left - 3} y={y + 3} textAnchor="end" fontSize={7} fill="#9ca3af">
                {v.toFixed(1)}x
              </text>
            </g>
          );
        })}

        {/* Genome mean reference line */}
        <line x1={PAD.left} x2={W - PAD.right}
          y1={yScale(genomeMean)} y2={yScale(genomeMean)}
          stroke="#6366f1" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.5} />

        {/* Coverage bars */}
        {depths.map((d, i) => {
          const x = xBin(i);
          const bh = (Math.min(d, cap) / cap) * COV_H;
          const inDel = (plot_start + i * region.window_bp) >= del_start &&
                        (plot_start + i * region.window_bp) < del_end;
          return (
            <rect key={i} x={x} y={PAD.top + COV_H - bh} width={binW} height={bh}
              fill={inDel ? '#ef4444' : '#6366f1'} opacity={inDel ? 0.65 : 0.4} />
          );
        })}

        {/* ── Gene track ── */}
        {/* Baseline */}
        <line x1={PAD.left} x2={W - PAD.right}
          y1={PAD.top + COV_H + GENE_PAD_TOP} y2={PAD.top + COV_H + GENE_PAD_TOP}
          stroke="#e5e7eb" strokeWidth={0.5} />

        {layout.map(({ gene, row }, gi) => {
          const gx1 = Math.max(xScale(gene.start), PAD.left);
          const gx2 = Math.min(xScale(gene.end), W - PAD.right);
          if (gx2 <= gx1) return null;

          const baseY = geneAreaY + row * GENE_ROW_H;
          const midY  = baseY + 4;
          const color = GENE_COLORS[gene.biotype] ?? DEFAULT_GENE_COLOR;

          // Arrow direction every ~40px
          const arrowDir = gene.strand === '+' ? 1 : -1;
          const arrows: number[] = [];
          for (let ax = gx1 + 15; ax < gx2 - 5; ax += 40) arrows.push(ax);

          return (
            <g key={gi}>
              {/* Gene body line */}
              <line x1={gx1} x2={gx2} y1={midY} y2={midY} stroke={color} strokeWidth={1} opacity={0.5} />

              {/* Strand arrows */}
              {arrows.map((ax, ai) => (
                <path key={ai}
                  d={arrowDir > 0
                    ? `M${ax - 3},${midY - 2} L${ax},${midY} L${ax - 3},${midY + 2}`
                    : `M${ax + 3},${midY - 2} L${ax},${midY} L${ax + 3},${midY + 2}`}
                  stroke={color} strokeWidth={0.8} fill="none" opacity={0.5} />
              ))}

              {/* Intron regions (thin line already drawn) — UTR exons */}
              {gene.exons.map(([es, ee], ei) => {
                const ex1 = Math.max(xScale(es), PAD.left);
                const ex2 = Math.min(xScale(ee), W - PAD.right);
                if (ex2 <= ex1) return null;
                return (
                  <rect key={ei} x={ex1} y={midY - 3} width={ex2 - ex1} height={6}
                    fill={color} opacity={0.35} rx={1} />
                );
              })}

              {/* CDS exons (taller) */}
              {gene.cds.map(([cs, ce], ci) => {
                const cx1 = Math.max(xScale(cs), PAD.left);
                const cx2 = Math.min(xScale(ce), W - PAD.right);
                if (cx2 <= cx1) return null;
                return (
                  <rect key={ci} x={cx1} y={midY - 4.5} width={cx2 - cx1} height={9}
                    fill={color} opacity={0.75} rx={1} />
                );
              })}

              {/* Gene label — only if wide enough */}
              {(gx2 - gx1) > 20 && (
                <text x={(gx1 + gx2) / 2} y={midY + 10} textAnchor="middle"
                  fontSize={7} fill={color} fontWeight="500">
                  {gene.name}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis ticks */}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + COV_H} y2={PAD.top + COV_H}
          stroke="#d1d5db" strokeWidth={1} />
        {xTicks.map(({ x, label }) => (
          <g key={label}>
            <line x1={x} x2={x} y1={PAD.top + COV_H} y2={PAD.top + COV_H + 3}
              stroke="#9ca3af" strokeWidth={0.5} />
            <text x={x} y={PAD.top + COV_H + 9} textAnchor="middle" fontSize={7} fill="#9ca3af">
              {label}
            </text>
          </g>
        ))}
        <text x={W - PAD.right} y={PAD.top + COV_H + 9} textAnchor="end" fontSize={7} fill="#9ca3af">Mb</text>
      </svg>
      </div>
      <p className="text-[10px] text-gray-400 mt-0.5">
        10 kb bins · red = deletion · dashed line = genome mean ({genomeMean}×) ·
        gene models: CDS (solid) / UTR (faint) / intron (line) · arrows = strand direction
      </p>
    </div>
  );
}

const REGION_ZYG: Record<string, string> = {
  chr2:  'likely_hom',
  chr13: 'ambiguous',
  chr16: 'ambiguous',
  chr19: 'likely_hom',
  chr27: 'ambiguous',
};

export default function CnvCoverage({ samplePath = '' }: { samplePath?: string }) {
  const [covData, setCovData]   = useState<CoverageData | null>(null);
  const [geneData, setGeneData] = useState<GeneData | null>(null);

  useEffect(() => {
    fetch(`${samplePath}/cnv_coverage.json`)
      .then(r => r.ok ? r.json() : null).then(d => d && setCovData(d)).catch(() => {});
    fetch(`${samplePath}/cnv_genes.json`)
      .then(r => r.ok ? r.json() : null).then(d => d && setGeneData(d)).catch(() => {});
  }, [samplePath]);

  if (!covData) return null;

  return (
    <div className="space-y-3 mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Coverage profiles</h3>
      {covData.regions.map((r) => {
        // GTF uses no "chr" prefix
        const chromKey = r.chrom.replace(/^chr/, '');
        const genes = geneData?.[chromKey] ?? [];
        return (
          <CoveragePlot
            key={r.chrom}
            region={r}
            genomeMean={covData.genome_mean_depth}
            zygosity={REGION_ZYG[r.chrom]}
            genes={genes}
          />
        );
      })}
    </div>
  );
}
