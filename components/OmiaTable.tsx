'use client';

import { useEffect, useState } from 'react';

interface SampleGenotype {
  zygosity: string;
  depth: number;
  ref_count: number | null;
  alt_count: number | null;
  affected: boolean;
}

interface Variant {
  variant_id: string;
  gene: string;
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  hgvs_c: string;
  hgvs_p: string;
  phene_name: string;
  omia_id: string;
  deleterious: string;
  characterised?: string;
  mol_gen?: string;
  clinical_note?: string;
  nelk: SampleGenotype;
  cosmo: SampleGenotype;
}

interface OmiaResult {
  variants: Variant[];
  summary: {
    total_screened: number;
    nelk_affected: number;
    cosmo_affected: number;
  };
  method: string;
}

const ZYG_STYLE: Record<string, string> = {
  'alt/alt':   'bg-red-100 text-red-700',
  'ref/alt':   'bg-orange-100 text-orange-700',
  'ref/ref':   'bg-green-100 text-green-700',
  'no call':   'bg-gray-100 text-gray-400',
  'indel':     'bg-purple-100 text-purple-700',
};

export default function OmiaTable({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData]         = useState<OmiaResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAll, setShowAll]   = useState(false);

  useEffect(() => {
    fetch(`${samplePath}/omia_result.json`).then((r) => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading OMIA data…</div>;

  // Determine which sample we're looking at
  const isCosmo = samplePath.includes('cosmo');
  const sampleKey: 'nelk' | 'cosmo' = isCosmo ? 'cosmo' : 'nelk';
  const otherKey:  'nelk' | 'cosmo' = isCosmo ? 'nelk' : 'cosmo';
  const otherLabel = isCosmo ? 'NELK' : 'Cosmo';

  // Sort: affected first, then by gene
  const sorted = [...(data.variants ?? [])].sort((a, b) => {
    const aAff = a[sampleKey].affected ? 1 : 0;
    const bAff = b[sampleKey].affected ? 1 : 0;
    if (bAff !== aAff) return bAff - aAff;
    return a.gene.localeCompare(b.gene);
  });

  const affected   = sorted.filter(v => v[sampleKey].affected);
  const unaffected = sorted.filter(v => !v[sampleKey].affected);
  const displayed  = showAll ? sorted : (affected.length > 0 ? sorted : sorted.slice(0, 20));

  const affCount = affected.length;
  const totalCount = sorted.length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">OMIA sites screened</p>
          <p className="text-xl font-semibold text-gray-700">{totalCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">genotyped from BAM</p>
        </div>
        <div className={`border rounded-lg p-3 ${affCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-100'}`}>
          <p className={`text-xs mb-1 ${affCount > 0 ? 'text-amber-600' : 'text-green-500'}`}>Allele matches</p>
          <p className={`text-xl font-semibold ${affCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>{affCount}</p>
          <p className={`text-[10px] mt-0.5 ${affCount > 0 ? 'text-amber-500' : 'text-green-500'}`}>
            {affCount > 0 ? 'alt allele detected' : 'none detected'}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">With trait/phene</p>
          <p className="text-xl font-semibold text-gray-700">
            {sorted.filter(v => v.phene_name).length}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Pathogenic</p>
          <p className="text-xl font-semibold text-gray-700">
            {sorted.filter(v => v.deleterious === 'yes' && v[sampleKey].affected).length}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">deleterious + matched</p>
        </div>
      </div>

      {/* Method */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <strong>Method:</strong> {data.method}
      </div>

      {/* Section header for affected */}
      {affCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded">
            {affCount} variant{affCount > 1 ? 's' : ''} with alt allele detected
          </span>
          <div className="flex-1 border-t border-amber-200" />
        </div>
      )}

      {/* Variant list */}
      <div className="space-y-2">
        {displayed.map((v, i) => {
          const sg     = v[sampleKey];
          const og     = v[otherKey];
          const isAff  = sg.affected;
          const isIndel = !v.ref || !v.alt || sg.zygosity === 'indel';

          // Divider between affected and unaffected
          const prevIsAff = i > 0 && displayed[i-1][sampleKey].affected;
          const showDiv   = affCount > 0 && !isAff && prevIsAff;

          return (
            <div key={v.variant_id}>
              {showDiv && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-[10px] text-gray-400">
                    {unaffected.length} sites — ref/ref or no allele data
                  </span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
              )}
              <div className={`border rounded-lg overflow-hidden ${isAff ? 'border-amber-200' : 'border-gray-100'}`}>
                {/* Header row */}
                <div
                  className={`px-4 py-2.5 flex items-start justify-between gap-3 cursor-pointer ${
                    isAff ? 'bg-amber-50 hover:bg-amber-100/60' : 'bg-gray-50/60 hover:bg-gray-100/40'
                  }`}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="min-w-0">
                      <span className={`font-semibold text-sm ${isAff ? 'text-gray-800' : 'text-gray-500'}`}>
                        {v.gene || '—'}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <span className="font-mono text-[10px] text-gray-400">
                          {v.chrom}:{v.pos?.toLocaleString()}
                          {!isIndel && v.ref && v.alt ? ` ${v.ref}>${v.alt}` : ' (indel)'}
                        </span>
                        {/* Current sample genotype */}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ZYG_STYLE[sg.zygosity] ?? 'bg-gray-100 text-gray-500'}`}>
                          {sg.zygosity}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400">
                          DP={sg.depth}
                        </span>
                        {sg.ref_count !== null && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400">
                            {sg.ref_count}R/{sg.alt_count}A
                          </span>
                        )}
                        {v.hgvs_c && (
                          <span className="font-mono text-[10px] text-gray-400">{v.hgvs_c}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {v.phene_name ? (
                      <span className="text-xs font-medium text-amber-700 max-w-[160px] block truncate" title={v.phene_name}>
                        {v.phene_name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-300 italic">no phene</span>
                    )}
                    <div className="mt-0.5 text-[10px] text-gray-300">{expanded === i ? '▲' : '▼'}</div>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded === i && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-white space-y-2 text-xs text-gray-600">
                    {/* Other sample comparison */}
                    <div className="flex gap-4 flex-wrap">
                      <div>
                        <span className="text-gray-400">This sample: </span>
                        <span className={`px-1.5 py-0.5 rounded font-medium ${ZYG_STYLE[sg.zygosity] ?? 'bg-gray-100 text-gray-500'}`}>
                          {sg.zygosity}
                        </span>
                        {sg.ref_count !== null && (
                          <span className="ml-1 text-gray-400">({sg.ref_count}R / {sg.alt_count}A)</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-400">{otherLabel}: </span>
                        <span className={`px-1.5 py-0.5 rounded font-medium ${ZYG_STYLE[og.zygosity] ?? 'bg-gray-100 text-gray-500'}`}>
                          {og.zygosity}
                        </span>
                        {og.ref_count !== null && (
                          <span className="ml-1 text-gray-400">({og.ref_count}R / {og.alt_count}A)</span>
                        )}
                      </div>
                    </div>

                    {v.omia_id && (
                      <p><strong>OMIA ID:</strong> {v.omia_id}
                        {v.characterised === 'yes' && (
                          <span className="ml-2 bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Characterised</span>
                        )}
                      </p>
                    )}
                    {v.hgvs_c && <p><strong>HGVS:</strong> <span className="font-mono">{v.hgvs_c} {v.hgvs_p}</span></p>}
                    {v.mol_gen && <p><strong>Molecular genetics:</strong> {v.mol_gen}</p>}
                    {v.clinical_note && (
                      <p className="text-[#3540CA] bg-[#C4F9FF]/20 px-2 py-1.5 rounded">
                        <strong>Note:</strong> {v.clinical_note}
                      </p>
                    )}
                    <p>
                      <strong>Deleterious:</strong>{' '}
                      {v.deleterious === 'yes'
                        ? <span className="text-red-600 font-medium">yes</span>
                        : v.deleterious === 'no'
                        ? <span className="text-green-600">no</span>
                        : <span className="text-gray-400">unknown</span>
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show all toggle */}
      {!showAll && unaffected.length > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
        >
          Show all {totalCount} screened sites (currently showing {displayed.length})
        </button>
      )}
      {showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-lg transition-colors"
        >
          Collapse to affected only
        </button>
      )}
    </div>
  );
}
