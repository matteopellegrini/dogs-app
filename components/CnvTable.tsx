'use client';

import { useEffect, useState } from 'react';

interface Gene {
  chrom: string;
  start: number;
  end: number;
  size: string;
  gene: string;
  biotype: string;
  category: string;   // CDS | 5UTR | 3UTR | EXON_NC | INTRONIC
}

interface Region {
  chrom: string;
  start: number;
  end: number;
  size: string;
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
  };
}

const NOTABLE: Record<string, string> = {
  CDKN2B: 'Cyclin-dependent kinase inhibitor — tumour suppressor',
  MTAP: 'Methylthioadenosine phosphorylase — co-deleted with CDKN2A/B',
  PRKDC: 'DNA-PK catalytic subunit — DNA double-strand break repair',
  GRIA4: 'Glutamate receptor subunit — neurological function',
  TRPM6: 'Magnesium transporter — hypomagnesaemia',
  IL37: 'Anti-inflammatory cytokine',
  IL36B: 'Pro-inflammatory interleukin',
  IL36RN: 'IL-36 receptor antagonist',
  IL1F10: 'IL-1 family member',
  VEGFC: 'Vascular endothelial growth factor C — lymphangiogenesis',
  PRKG1: 'cGMP-dependent protein kinase — cardiac/smooth muscle',
  CAMK2B: 'Calcium/calmodulin kinase — synaptic plasticity',
  COL11A2: 'Collagen type XI — skeletal dysplasia',
  CSMD3: 'CUB and sushi domain protein — tumour suppressor candidate',
  AFF2: 'X-linked intellectual disability gene',
  ARHGEF9: 'Rho GEF — synaptic inhibition',
  TENM1: 'Teneurin — neural circuit development',
  CD84: 'SLAM family receptor — immune regulation',
  AGPAT2: 'Acylglycerophospholipid transferase — lipodystrophy',
  NFS1: 'Cysteine desulfurase — iron-sulfur cluster biogenesis',
  CADM2: 'Cell adhesion molecule — obesity/cognitive traits',
  CALD1: 'Caldesmon — smooth muscle regulation',
  SYT14: 'Synaptotagmin — vesicle trafficking',
  RFT1: 'Dolichyl-phosphate mannose transferase — CDG syndrome',
  ZFPM2: 'Zinc finger — cardiac development',
  TPCN2: 'Two-pore channel 2 — lysosomal Ca2+ signalling',
  RCHY1: 'RING finger E3 ubiquitin ligase — p53 regulation',
};

const CAT_STYLE: Record<string, { label: string; cls: string }> = {
  CDS:      { label: 'CDS',     cls: 'bg-red-100 text-red-700' },
  '5UTR':   { label: "5' UTR",  cls: 'bg-orange-100 text-orange-700' },
  '3UTR':   { label: "3' UTR",  cls: 'bg-amber-100 text-amber-700' },
  EXON_NC:  { label: 'Exon',    cls: 'bg-yellow-100 text-yellow-700' },
  INTRONIC: { label: 'Intronic', cls: 'bg-blue-100 text-blue-700' },
};

const CAT_ORDER = ['CDS', '5UTR', '3UTR', 'EXON_NC', 'INTRONIC'];
const PRIORITY: Record<string, number> = { CDS: 0, '5UTR': 1, '3UTR': 2, EXON_NC: 3, INTRONIC: 4 };

export default function CnvTable({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<CnvData | null>(null);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

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
      // Notable genes first, then by category priority, then chromosomal order
      const noteDiff = (NOTABLE[b.gene] ? 1 : 0) - (NOTABLE[a.gene] ? 1 : 0);
      if (noteDiff !== 0) return noteDiff;
      const catDiff = (PRIORITY[a.category] ?? 9) - (PRIORITY[b.category] ?? 9);
      if (catDiff !== 0) return catDiff;
      return a.chrom.localeCompare(b.chrom) || a.start - b.start;
    });

  const bc = data.summary?.by_category ?? {};

  return (
    <div className="space-y-4">
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

      {data.summary?.note && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
          ⚠️ {data.summary.note}
        </div>
      )}
      <p className="text-xs text-gray-400">
        Homozygous deletions at 10 kb resolution (depth &lt;15% of mean, ≥20 kb). Each gene classified
        by highest-impact overlap: CDS &gt; 5&#39;UTR &gt; 3&#39;UTR &gt; intronic.
      </p>

      {/* Filters */}
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-left">
              <th className="py-2 pr-4 font-medium">Gene</th>
              <th className="py-2 pr-4 font-medium">Location</th>
              <th className="py-2 pr-4 font-medium">Del. size</th>
              <th className="py-2 pr-4 font-medium">Overlap</th>
              <th className="py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {genes.map((g, i) => {
              const style = CAT_STYLE[g.category] ?? { label: g.category, cls: 'bg-gray-100 text-gray-600' };
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
    </div>
  );
}
