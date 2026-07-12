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
  af_dog10k: number | null;
}

interface ModGene {
  gene: string;
  n_moderate: number;
  hom_alt: number;
  het: number;
  effects: string[];
  min_af: number | null;
}

interface FunctionalData {
  summary: {
    high_total: number;
    high_hom_alt: number;
    high_het: number;
    high_hom_rare_1pct: number;
    high_hom_rare_5pct: number;
    high_hom_rare_10pct: number;
    moderate_total: number;
    moderate_hom_alt: number;
    moderate_het: number;
  };
  high_effect_counts: Record<string, number>;
  high_variants: VariantRow[];
  moderate_by_gene: ModGene[];
  source: string;
  af_note: string;
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

function AfBadge({ af }: { af: number | null }) {
  if (af === null) return <span className="text-gray-300 text-[10px]">—</span>;
  const pct = (af * 100).toFixed(af < 0.001 ? 3 : af < 0.01 ? 2 : 1);
  const cls = af < 0.01 ? 'text-red-600 font-bold'
    : af < 0.05 ? 'text-orange-600 font-semibold'
    : af < 0.10 ? 'text-yellow-600'
    : 'text-gray-400';
  return <span className={`text-[11px] ${cls}`}>{pct}%</span>;
}

export default function FunctionalVariants({ samplePath = '' }: { samplePath?: string }) {
  const [data, setData] = useState<FunctionalData | null>(null);
  const [filter, setFilter] = useState<'all' | 'hom'>('hom');
  const [impactFilter, setImpactFilter] = useState<'HIGH' | 'MODERATE'>('HIGH');
  const [afFilter, setAfFilter] = useState<'all' | '10' | '5' | '1'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [fetchDebug, setFetchDebug] = useState('');

  useEffect(() => {
    const base = samplePath.replace(/^\//, '');
    const url = `/${base}/functional_variants.json`;
    setFetchDebug(`fetching ${url}…`);
    fetch(url)
      .then(r => {
        setFetchDebug(`${url} → status ${r.status}`);
        return r.ok ? r.json() : null;
      })
      .then(d => {
        if (d) {
          setFetchDebug(`OK: high=${d.summary?.high_total} mod=${d.summary?.moderate_total}`);
          setData(d);
        } else {
          setFetchDebug(`fetch returned null for ${url}`);
        }
      })
      .catch(e => setFetchDebug(`error: ${String(e)}`));
  }, [samplePath]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const afThresh = afFilter === '1' ? 0.01 : afFilter === '5' ? 0.05 : afFilter === '10' ? 0.10 : null;
    if (impactFilter === 'HIGH') {
      let rows = data.high_variants;
      if (filter === 'hom') rows = rows.filter(r => r.zygosity === 'hom_alt');
      if (afThresh !== null) rows = rows.filter(r => r.af_dog10k !== null && r.af_dog10k < afThresh);
      if (search) rows = rows.filter(r => r.gene.toLowerCase().includes(search.toLowerCase()));
      return rows;
    } else {
      let rows = data.moderate_by_gene;
      if (filter === 'hom') rows = rows.filter(r => r.hom_alt > 0);
      if (afThresh !== null) rows = rows.filter(r => r.min_af !== null && r.min_af < afThresh);
      if (search) rows = rows.filter(r => r.gene.toLowerCase().includes(search.toLowerCase()));
      return rows;
    }
  }, [data, filter, impactFilter, afFilter, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  useEffect(() => { setPage(0); }, [filter, impactFilter, afFilter, search]);

  if (!data) return (
    <div className="text-xs text-gray-500 p-4 font-mono bg-gray-50 rounded">{fetchDebug || 'waiting…'}</div>
  );
  const { summary } = data;

  return (
    <div className="space-y-4 mb-6">
      <div className="text-xs text-gray-400 font-mono">
        {fetchDebug} | impact={impactFilter} filter={filter} af={afFilter} | high_variants={data.high_variants.length} filtered={filtered.length} page={page}
      </div>
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
              <p className="text-[10px] text-gray-400 mb-1">Hom alt · rare in Dog10K</p>
              <div className="flex justify-between"><span className="text-orange-500">AF &lt; 5%</span><span className="font-bold text-orange-600">{summary.high_hom_rare_5pct}</span></div>
              <div className="flex justify-between"><span className="text-red-500">AF &lt; 1%</span><span className="font-bold text-red-600">{summary.high_hom_rare_1pct}</span></div>
            </div>
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
            <p className="text-gray-400 mt-2 text-[10px]">Missense, inframe insertions/deletions. Sorted by rarest hom alt variant per gene.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {(['HIGH', 'MODERATE'] as const).map(v => (
            <button key={v} onClick={() => setImpactFilter(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${impactFilter === v ? (v === 'HIGH' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-white') : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {v}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {([['all', 'All'], ['hom', 'Hom only']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === v ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {([['all', 'Any AF'], ['10', 'AF<10%'], ['5', 'AF<5%'], ['1', 'AF<1%']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setAfFilter(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${afFilter === v ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <input type="text" placeholder="Search gene…" value={search} onChange={e => setSearch(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-32 focus:outline-none focus:ring-1 focus:ring-gray-300" />
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
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Zyg</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Pop AF</th>
                </>
              ) : (
                <>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Variants</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Hom</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Het</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Min hom AF</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {impactFilter === 'HIGH'
              ? (paged as VariantRow[]).map((r, i) => (
                <tr key={i} className={`hover:bg-gray-50 ${r.af_dog10k !== null && r.af_dog10k < 0.05 ? 'bg-red-50/30' : ''}`}>
                  <td className="px-3 py-2 font-semibold text-gray-800">{r.gene}</td>
                  <td className="px-3 py-2"><EffectBadge effect={r.effect} /></td>
                  <td className="px-3 py-2 text-gray-500">{r.chr}:{parseInt(r.pos).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{r.ref}→{r.alt}</td>
                  <td className="px-3 py-2"><ZygBadge zygosity={r.zygosity} /></td>
                  <td className="px-3 py-2 text-right"><AfBadge af={r.af_dog10k} /></td>
                </tr>
              ))
              : (paged as ModGene[]).map((r, i) => (
                <tr key={i} className={`hover:bg-gray-50 ${r.min_af !== null && r.min_af < 0.05 ? 'bg-yellow-50/30' : ''}`}>
                  <td className="px-3 py-2 font-semibold text-gray-800">{r.gene}</td>
                  <td className="px-3 py-2 text-gray-600">{r.n_moderate}</td>
                  <td className="px-3 py-2 font-bold text-yellow-600">{r.hom_alt}</td>
                  <td className="px-3 py-2 text-gray-500">{r.het}</td>
                  <td className="px-3 py-2 text-right"><AfBadge af={r.min_af} /></td>
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
      <p className="text-[10px] text-gray-400">{data.af_note}</p>
    </div>
  );
}
