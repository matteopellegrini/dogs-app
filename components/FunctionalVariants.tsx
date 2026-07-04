'use client';

import { useEffect, useState, useMemo } from 'react';

interface VariantRow {
  impact: string;
  gene: string;
  chr: string;
  pos: string;
  ref: string;
  alt: string;
  effect: string;
  zygosity: string;
}

interface ModGene {
  gene: string;
  n_moderate: number;
  hom_alt: number;
  het: number;
  effects: string[];
}

interface FunctionalData {
  summary: {
    high_total: number;
    high_hom_alt: number;
    high_het: number;
    moderate_total: number;
    moderate_hom_alt: number;
    moderate_het: number;
  };
  high_effect_counts: Record<string, number>;
  high_variants: VariantRow[];
  moderate_by_gene: ModGene[];
  source: string;
}

const EFFECT_LABELS: Record<string, string> = {
  stop_gained: 'Stop gained',
  splice_acceptor_variant: 'Splice acceptor',
  splice_donor_variant: 'Splice donor',
  stop_lost: 'Stop lost',
  start_lost: 'Start lost',
  missense_variant: 'Missense',
  inframe_insertion: 'Inframe ins',
  inframe_deletion: 'Inframe del',
};

const EFFECT_COLOR: Record<string, string> = {
  stop_gained: 'bg-red-100 text-red-700',
  splice_acceptor_variant: 'bg-orange-100 text-orange-700',
  splice_donor_variant: 'bg-orange-100 text-orange-700',
  stop_lost: 'bg-purple-100 text-purple-700',
  start_lost: 'bg-purple-100 text-purple-700',
  missense_variant: 'bg-yellow-100 text-yellow-700',
};

function EffectBadge({ effect }: { effect: string }) {
  const base = effect.split('&')[0];
  const cls = EFFECT_COLOR[base] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {EFFECT_LABELS[base] ?? base.replace(/_/g, ' ')}
    </span>
  );
}

function ZygBadge({ zygosity }: { zygosity: string }) {
  return zygosity === 'hom_alt'
    ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600">hom</span>
    : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-500">het</span>;
}

export default function FunctionalVariants({ samplePath = '' }: { samplePath?: string }) {
  const [data, setData] = useState<FunctionalData | null>(null);
  const [filter, setFilter] = useState<'all' | 'hom'>('hom');
  const [impactFilter, setImpactFilter] = useState<'HIGH' | 'MODERATE'>('HIGH');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    const base = samplePath.replace(/^\//, '');
    fetch(`/${base}/functional_variants.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => {});
  }, [samplePath]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (impactFilter === 'HIGH') {
      let rows = data.high_variants;
      if (filter === 'hom') rows = rows.filter(r => r.zygosity === 'hom_alt');
      if (search) rows = rows.filter(r => r.gene.toLowerCase().includes(search.toLowerCase()));
      return rows;
    } else {
      let rows = data.moderate_by_gene;
      if (filter === 'hom') rows = rows.filter(r => r.hom_alt > 0);
      if (search) rows = rows.filter(r => r.gene.toLowerCase().includes(search.toLowerCase()));
      return rows;
    }
  }, [data, filter, impactFilter, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  useEffect(() => { setPage(0); }, [filter, impactFilter, search]);

  if (!data) return null;
  const { summary } = data;

  return (
    <div className="space-y-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-700">Functional variant annotation</h2>
      <p className="text-xs text-gray-400">{data.source}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <p className="text-sm font-semibold text-gray-800">HIGH impact</p>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-gray-800">{summary.high_total.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Homozygous</span><span className="font-bold text-red-600">{summary.high_hom_alt.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Heterozygous</span><span className="font-bold text-gray-600">{summary.high_het.toLocaleString()}</span></div>
            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
              {Object.entries(data.high_effect_counts).map(([eff, n]) => (
                <div key={eff} className="flex justify-between">
                  <span className="text-gray-400">{EFFECT_LABELS[eff] ?? eff.replace(/_/g,' ')}</span>
                  <span className="font-medium">{n.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
            <p className="text-sm font-semibold text-gray-800">MODERATE impact</p>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-gray-800">{summary.moderate_total.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Homozygous</span><span className="font-bold text-yellow-600">{summary.moderate_hom_alt.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Heterozygous</span><span className="font-bold text-gray-600">{summary.moderate_het.toLocaleString()}</span></div>
            <p className="text-gray-400 mt-2 text-[10px]">Missense, inframe insertions/deletions</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {(['HIGH', 'MODERATE'] as const).map(v => (
            <button key={v}
              onClick={() => setImpactFilter(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${impactFilter === v ? (v === 'HIGH' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-white') : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {v}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {([['all', 'All'], ['hom', 'Homozygous only']] as const).map(([v, label]) => (
            <button key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === v ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search gene…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
        <span className="text-xs text-gray-400 ml-auto">{filtered.length.toLocaleString()} variants</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Gene</th>
              {impactFilter === 'HIGH' ? (
                <>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Effect</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Chr:Pos</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Ref→Alt</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Zygosity</th>
                </>
              ) : (
                <>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Missense variants</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Hom</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Het</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Effects</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {impactFilter === 'HIGH'
              ? (paged as VariantRow[]).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-800">{r.gene}</td>
                  <td className="px-3 py-2"><EffectBadge effect={r.effect} /></td>
                  <td className="px-3 py-2 text-gray-500">{r.chr}:{parseInt(r.pos).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{r.ref}→{r.alt}</td>
                  <td className="px-3 py-2"><ZygBadge zygosity={r.zygosity} /></td>
                </tr>
              ))
              : (paged as ModGene[]).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-800">{r.gene}</td>
                  <td className="px-3 py-2 text-gray-600">{r.n_moderate}</td>
                  <td className="px-3 py-2 font-bold text-yellow-600">{r.hom_alt}</td>
                  <td className="px-3 py-2 text-gray-500">{r.het}</td>
                  <td className="px-3 py-2 text-gray-400">{r.effects.join(', ')}</td>
                </tr>
              ))
            }
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
            <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
              className="text-xs px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-white">← Prev</button>
            <span className="text-xs text-gray-500">Page {page+1} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page === totalPages-1}
              className="text-xs px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-white">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
