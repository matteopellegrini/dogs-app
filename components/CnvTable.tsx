'use client';

import { useEffect, useState } from 'react';
import CnvCoverage from './CnvCoverage';

interface RealRegion {
  chrom: string;
  start: number;
  end: number;
  size: string;
  sample_pct_mean?: number;
  ref_depth_pct: number | null;
  disrupted_genes: string[];
  verdict: string;
}

interface DisruptedGene {
  gene: string;
  biotype: string;
  chrom: string;
  start: number;
  end: number;
  overlap: string;
  exon_overlap?: string;
}

interface ArtefactRegion {
  chrom: string;
  start: number;
  end: number;
  size: string;
  verdict: string;
  sample_pct_mean?: number;
  ref_depth_pct?: number | null;
  disrupted_genes?: string[];
}

interface CnvData {
  regions: RealRegion[];
  disrupted_genes: DisruptedGene[];
  artefact_regions?: ArtefactRegion[];
  summary: {
    total_regions: number;
    panel_note?: string;
    artefact_note?: string;
    min_detectable_kb?: number;
    calling_resolution_kb?: number;
    method?: string;
  };
}

const OVERLAP_COLORS: Record<string, string> = {
  full: 'bg-red-100 text-red-700',
  partial: 'bg-orange-100 text-orange-700',
};

export default function CnvTable({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<CnvData | null>(null);

  useEffect(() => {
    fetch(`${samplePath}/cnv_homdel.json`).then(r => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading CNV data…</div>;

  const hasRealDeletions = data.summary.total_regions > 0;
  const artefacts = data.artefact_regions ?? [];

  return (
    <div className="space-y-5">

      {/* ── Real deletions ── */}
      {hasRealDeletions ? (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-3 text-xs">
            <p className="font-semibold text-red-800 mb-1">
              {data.summary.total_regions} confirmed CNV deletion{data.summary.total_regions > 1 ? 's' : ''} detected
            </p>
            <p className="text-red-700">{data.summary.panel_note}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-left">
                  <th className="py-2 pr-4 font-medium">Region</th>
                  <th className="py-2 pr-4 font-medium">Size</th>
                  <th className="py-2 pr-3 font-medium text-right">Sample %</th>
                  <th className="py-2 pr-3 font-medium text-right" title="Median normalized depth in reference dogs at this region (100% = normal coverage in refs → sample-specific deletion)">Ref depth %</th>
                  <th className="py-2 font-medium">Genes affected</th>
                </tr>
              </thead>
              <tbody>
                {data.regions.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 bg-red-50/40">
                    <td className="py-1.5 pr-4 font-mono text-gray-600">
                      {r.chrom}:{(r.start/1e6).toFixed(2)}–{(r.end/1e6).toFixed(2)} Mb
                    </td>
                    <td className="py-1.5 pr-4 text-gray-400">{r.size}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold text-red-600">
                      {r.sample_pct_mean != null ? `${r.sample_pct_mean}%` : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-gray-500">
                      {r.ref_depth_pct != null ? `${r.ref_depth_pct}%` : <span className="text-gray-300">N/A</span>}
                    </td>
                    <td className="py-1.5">
                      <span className="flex gap-1 flex-wrap">
                        {r.disrupted_genes.map(g => (
                          <span key={g} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">{g}</span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.disrupted_genes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Disrupted genes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-left">
                      <th className="py-2 pr-4 font-medium">Gene</th>
                      <th className="py-2 pr-4 font-medium">Location</th>
                      <th className="py-2 pr-4 font-medium">Biotype</th>
                      <th className="py-2 pr-4 font-medium">Overlap</th>
                      <th className="py-2 font-medium" title="Whether the deleted region covers exons or only intronic sequence">Exon overlap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.disrupted_genes.map((g, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 pr-4 font-semibold text-gray-700">{g.gene}</td>
                        <td className="py-1.5 pr-4 font-mono text-gray-400 text-[10px]">
                          {g.chrom}:{(g.start/1e6).toFixed(2)}–{(g.end/1e6).toFixed(2)} Mb
                        </td>
                        <td className="py-1.5 pr-4 text-gray-500">{g.biotype.replace('_',' ')}</td>
                        <td className="py-1.5 pr-4">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${OVERLAP_COLORS[g.overlap] ?? 'bg-gray-100 text-gray-500'}`}>
                            {g.overlap}
                          </span>
                        </td>
                        <td className="py-1.5">
                          {g.exon_overlap ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              g.exon_overlap === 'exonic'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {g.exon_overlap}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg px-3 py-3">
          <p className="font-semibold mb-1">✓ No confident CNV deletions detected</p>
          <p className="text-green-700">{data.summary.artefact_note}</p>
        </div>
      )}

      {/* ── Mappability artefacts (collapsible) ── */}
      {artefacts.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-600 select-none">
            {artefacts.length} mappability artefact{artefacts.length > 1 ? 's' : ''} excluded (low coverage in reference panel too)
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-left">
                  <th className="py-1.5 pr-4 font-medium">Region</th>
                  <th className="py-1.5 pr-4 font-medium">Size</th>
                  <th className="py-1.5 pr-3 font-medium text-right">Sample %</th>
                  <th className="py-1.5 pr-3 font-medium text-right">Ref depth %</th>
                  <th className="py-1.5 font-medium">Genes</th>
                </tr>
              </thead>
              <tbody>
                {artefacts.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 text-gray-400">
                    <td className="py-1 pr-4 font-mono">{r.chrom}:{(r.start/1e6).toFixed(2)}–{(r.end/1e6).toFixed(2)} Mb</td>
                    <td className="py-1 pr-4">{r.size}</td>
                    <td className="py-1 pr-3 text-right">{r.sample_pct_mean != null ? `${r.sample_pct_mean}%` : '—'}</td>
                    <td className="py-1 pr-3 text-right">{r.ref_depth_pct != null ? `${r.ref_depth_pct}%` : 'N/A'}</td>
                    <td className="py-1">{r.disrupted_genes?.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <CnvCoverage samplePath={samplePath} />
    </div>
  );
}
