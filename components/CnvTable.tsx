'use client';

import { useEffect, useState } from 'react';
import CnvCoverage from './CnvCoverage';

interface Region {
  chrom: string;
  start: number;
  end: number;
  size: string;
  mean_depth: number;
  norm: number;
  observed_reads: number;
  expected_reads: number;
  pct_diploid: number;
  pct_het: number;
  zygosity_call: 'likely_hom' | 'ambiguous' | 'likely_het';
}

interface Gene {
  chrom: string;
  start: number;
  end: number;
  size: string;
  gene: string;
  biotype: string;
  category: string;
}

interface CnvData {
  regions: Region[];
  disrupted_genes: Gene[];
  summary: {
    total_regions: number;
    unique_genes: number;
    protein_coding: number;
    by_category: Record<string, number>;
    note?: string;
    min_detectable_kb?: number;
    calling_resolution_kb?: number;
    zygosity_note?: string;
    genome_mean_depth?: number;
  };
}

const NOTABLE: Record<string, string> = {
  CDKN2B: 'Cyclin-dependent kinase inhibitor — tumour suppressor',
  MTAP: 'Methylthioadenosine phosphorylase — co-deleted with CDKN2A/B',
  PRKDC: 'DNA-PK catalytic subunit — DNA double-strand break repair',
  VEGFC: 'Vascular endothelial growth factor C — lymphangiogenesis',
  CSMD3: 'CUB and sushi domain protein — tumour suppressor candidate',
  PPFIBP1: 'Liprin-β1 — cell migration, axon guidance',
  SMCO2: 'Single-pass membrane protein',
  PRKG1: 'cGMP-dependent protein kinase — cardiac/smooth muscle',
  CAMK2B: 'Calcium/calmodulin kinase — synaptic plasticity',
};

const CAT_STYLE: Record<string, { label: string; cls: string }> = {
  CDS:      { label: 'CDS',      cls: 'bg-red-100 text-red-700' },
  '5UTR':   { label: "5' UTR",   cls: 'bg-orange-100 text-orange-700' },
  '3UTR':   { label: "3' UTR",   cls: 'bg-amber-100 text-amber-700' },
  EXON_NC:  { label: 'Exon',     cls: 'bg-yellow-100 text-yellow-700' },
  INTRONIC: { label: 'Intronic', cls: 'bg-blue-100 text-blue-700' },
};

const ZYG_STYLE: Record<string, { label: string; cls: string }> = {
  likely_hom: { label: 'likely hom', cls: 'bg-red-100 text-red-700' },
  ambiguous:  { label: 'ambiguous',  cls: 'bg-yellow-100 text-yellow-700' },
  likely_het: { label: 'likely het', cls: 'bg-blue-100 text-blue-700' },
};

const CAT_ORDER = ['CDS', '5UTR', '3UTR', 'EXON_NC', 'INTRONIC'];
const PRIORITY: Record<string, number> = { CDS: 0, '5UTR': 1, '3UTR': 2, EXON_NC: 3, INTRONIC: 4 };

function regionKey(r: Region) { return `${r.chrom}:${r.start}`; }

export default function CnvTable({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<CnvData | null>(null);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showRegions, setShowRegions] = useState(false);

  useEffect(() => {
    fetch(`${samplePath}/cnv_homdel.json`).then((r) => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading CNV data…</div>;

  const genes = (data.disrupted_genes ?? [])
    .filter((g) => catFilter === 'all' || g.category === catFilter)
    .filter((g) => !search ||
      g.gene.toLowerCase().includes(search.toLowerCase()) ||
      g.chrom.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const noteDiff = (NOTABLE[b.gene] ? 1 : 0) - (NOTABLE[a.gene] ? 1 : 0);
      if (noteDiff !== 0) return noteDiff;
      const catDiff = (PRIORITY[a.category] ?? 9) - (PRIORITY[b.category] ?? 9);
      if (catDiff !== 0) return catDiff;
      return a.chrom.localeCompare(b.chrom) || a.start - b.start;
    });

  const bc = data.summary?.by_category ?? {};

  // Build region lookup for gene table
  const regionByChrom: Record<string, Region> = {};
  for (const r of data.regions ?? []) regionByChrom[r.chrom] = r;

  return (
    <div className="space-y-4">
      {/* Coverage sensitivity banner */}
      {data.summary?.min_detectable_kb !== undefined && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-3 py-2">
          ℹ️ At 2x mean coverage, the minimum detectable deletion is{' '}
          <strong>{data.summary.min_detectable_kb} kb</strong> (called at {data.summary.calling_resolution_kb} kb resolution).
          Zygosity cannot be reliably determined at this depth — see table below.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Del. regions</p>
          <p className="text-xl font-semibold text-gray-700">{data.summary?.total_regions ?? 0}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
          <p className="text-xs text-red-400 mb-1">CDS-disrupting</p>
          <p className="text-xl font-semibold text-red-700">{bc.CDS ?? 0}</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
          <p className="text-xs text-orange-400 mb-1">UTR-overlapping</p>
          <p className="text-xl font-semibold text-orange-700">{(bc['5UTR'] ?? 0) + (bc['3UTR'] ?? 0)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs text-blue-400 mb-1">Intronic only</p>
          <p className="text-xl font-semibold text-blue-700">{bc.INTRONIC ?? 0}</p>
        </div>
      </div>

      {/* Deletion regions table */}
      <div>
        <button
          onClick={() => setShowRegions(v => !v)}
          className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1 hover:text-gray-700"
        >
          <span>{showRegions ? '▾' : '▸'}</span> Deletion regions
        </button>
        {showRegions && (
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-left">
                  <th className="py-2 pr-4 font-medium">Region</th>
                  <th className="py-2 pr-4 font-medium">Size</th>
                  <th className="py-2 pr-4 font-medium text-right">Observed reads</th>
                  <th className="py-2 pr-4 font-medium text-right">Expected reads</th>
                  <th className="py-2 pr-4 font-medium text-right">% of diploid</th>
                  <th className="py-2 pr-4 font-medium text-right">% of het</th>
                  <th className="py-2 font-medium">Zygosity</th>
                </tr>
              </thead>
              <tbody>
                {(data.regions ?? []).map((r) => {
                  const zs = ZYG_STYLE[r.zygosity_call] ?? ZYG_STYLE.ambiguous;
                  return (
                    <tr key={regionKey(r)} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-1.5 pr-4 font-mono text-gray-600">
                        {r.chrom}:{(r.start / 1e6).toFixed(1)}–{(r.end / 1e6).toFixed(1)} Mb
                      </td>
                      <td className="py-1.5 pr-4 text-gray-500">{r.size}</td>
                      <td className="py-1.5 pr-4 text-right font-semibold text-gray-800">{r.observed_reads.toLocaleString()}</td>
                      <td className="py-1.5 pr-4 text-right text-gray-400">{r.expected_reads.toLocaleString()}</td>
                      <td className="py-1.5 pr-4 text-right text-gray-600">{r.pct_diploid.toFixed(1)}%</td>
                      <td className="py-1.5 pr-4 text-right text-gray-600">{r.pct_het.toFixed(1)}%</td>
                      <td className="py-1.5">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${zs.cls}`}>{zs.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data.summary?.zygosity_note && (
          <p className="text-[10px] text-gray-400 mt-1">{data.summary.zygosity_note}</p>
        )}
      </div>

      {/* Gene table filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search gene or chromosome…"
          className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3540CA]/40"
        />
        <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs gap-0.5">
          <button
            onClick={() => setCatFilter('all')}
            className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${catFilter === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All
          </button>
          {CAT_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${catFilter === c ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {CAT_STYLE[c]?.label ?? c}
            </button>
          ))}
        </div>
      </div>

      {/* Gene table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-left">
              <th className="py-2 pr-4 font-medium">Gene</th>
              <th className="py-2 pr-4 font-medium">Location</th>
              <th className="py-2 pr-4 font-medium">Del. size</th>
              <th className="py-2 pr-4 font-medium">Overlap</th>
              <th className="py-2 pr-4 font-medium text-right">% of diploid</th>
              <th className="py-2 pr-4 font-medium">Zygosity</th>
              <th className="py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {genes.map((g, i) => {
              const style = CAT_STYLE[g.category] ?? { label: g.category, cls: 'bg-gray-100 text-gray-600' };
              const reg = regionByChrom[g.chrom];
              const zs = reg ? (ZYG_STYLE[reg.zygosity_call] ?? ZYG_STYLE.ambiguous) : null;
              return (
                <tr
                  key={i}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${NOTABLE[g.gene] ? 'bg-amber-50/40' : ''}`}
                >
                  <td className="py-1.5 pr-4 font-medium text-gray-800">
                    {g.gene}
                    {NOTABLE[g.gene] && <span className="ml-1 text-amber-500">★</span>}
                  </td>
                  <td className="py-1.5 pr-4 text-gray-500 font-mono">
                    {g.chrom}:{(g.start / 1e6).toFixed(1)} Mb
                  </td>
                  <td className="py-1.5 pr-4">
                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                      {g.size}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${style.cls}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-600">
                    {reg ? `${reg.pct_diploid.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-1.5 pr-4">
                    {zs && <span className={`px-1.5 py-0.5 rounded font-medium ${zs.cls}`}>{zs.label}</span>}
                  </td>
                  <td className="py-1.5 text-gray-400 max-w-xs truncate">
                    {NOTABLE[g.gene] ?? g.biotype}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {genes.length === 0 && (
          <p className="text-gray-400 text-center py-6">No results</p>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Large deletions called at 100 kb resolution (depth &lt;20% of genome mean 2.2×, merged ≥200 kb, MAPQ ≥20).
        Zygosity inferred from read depth — unreliable at 2× coverage.
      </p>

      <CnvCoverage samplePath={samplePath} />
    </div>
  );
}
