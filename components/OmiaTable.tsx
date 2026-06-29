'use client';

import { useEffect, useState } from 'react';

interface Match {
  gene: string;
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  zygosity: string;
  depth: number;
  hgvs_c: string;
  hgvs_p: string;
  omia_id: string;
  phene_name: string;
  phene_symbol: string;
  characterised: string;
  characterised_year?: string;
  deleterious: string;
  mol_gen: string;
  clinical_note: string;
}

interface OmiaResult {
  summary: {
    omia_variants_screened: number;
    positions_genotyped_from_bam: number;
    allele_matches_found: number;
    with_disease_or_trait_phene: number;
  };
  matches: Match[];
  method: string;
  database: string;
}

const ZYG_STYLE: Record<string, string> = {
  homozygous:  'bg-red-100 text-red-700',
  heterozygous:'bg-orange-100 text-orange-700',
  hom_ref:     'bg-green-100 text-green-700',
};

export default function OmiaTable() {
  const [data, setData]     = useState<OmiaResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch('/omia_result.json').then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading OMIA data…</div>;

  const s = data.summary;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">OMIA sites screened</p>
          <p className="text-xl font-semibold text-gray-700">{s.omia_variants_screened}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">genotyped from BAM</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          <p className="text-xs text-indigo-400 mb-1">Allele matches</p>
          <p className="text-xl font-semibold text-indigo-700">{s.allele_matches_found}</p>
          <p className="text-[10px] text-indigo-400 mt-0.5">exact position + allele</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <p className="text-xs text-amber-400 mb-1">With trait/disease</p>
          <p className="text-xl font-semibold text-amber-700">{s.with_disease_or_trait_phene}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
          <p className="text-xs text-green-400 mb-1">Pathogenic variants</p>
          <p className="text-xl font-semibold text-green-700">
            {data.matches.filter(m => m.deleterious === 'yes').length}
          </p>
        </div>
      </div>

      {/* Method */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <strong>Method:</strong> {data.method}
      </div>

      {/* Matches */}
      <div className="space-y-3">
        {data.matches.map((m, i) => (
          <div
            key={i}
            className={`border rounded-lg overflow-hidden ${m.phene_name ? 'border-amber-200' : 'border-gray-200'}`}
          >
            {/* Header row */}
            <div
              className={`px-4 py-3 flex items-start justify-between gap-3 cursor-pointer ${
                m.phene_name ? 'bg-amber-50 hover:bg-amber-100/60' : 'bg-gray-50 hover:bg-gray-100/60'
              }`}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div>
                  <span className="font-semibold text-gray-800 text-sm">{m.gene}</span>
                  {m.phene_symbol && (
                    <span className="ml-2 text-xs text-gray-500 italic" dangerouslySetInnerHTML={{__html: m.phene_symbol}} />
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="font-mono text-xs text-gray-500">
                      {m.chrom}:{m.pos.toLocaleString()} {m.ref}&gt;{m.alt}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ZYG_STYLE[m.zygosity] ?? 'bg-gray-100 text-gray-600'}`}>
                      {m.zygosity}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">
                      DP={m.depth}
                    </span>
                    {m.hgvs_c && (
                      <span className="font-mono text-[10px] text-gray-400">{m.hgvs_c} {m.hgvs_p}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                {m.phene_name ? (
                  <span className="text-xs font-medium text-amber-700">{m.phene_name}</span>
                ) : (
                  <span className="text-xs text-gray-400 italic">no phene</span>
                )}
                <div className="mt-1 text-[10px] text-gray-400">{expanded === i ? '▲ hide' : '▼ details'}</div>
              </div>
            </div>

            {/* Expanded details */}
            {expanded === i && (
              <div className="px-4 py-3 border-t border-gray-100 bg-white space-y-2 text-xs text-gray-600">
                {m.omia_id && (
                  <p><strong>OMIA ID:</strong> {m.omia_id}
                    {m.characterised === 'yes' && (
                      <span className="ml-2 bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Characterised {m.characterised_year}
                      </span>
                    )}
                  </p>
                )}
                {m.mol_gen && (
                  <p><strong>Molecular genetics:</strong> {m.mol_gen}</p>
                )}
                {m.clinical_note && (
                  <p className="text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded">
                    <strong>Note:</strong> {m.clinical_note}
                  </p>
                )}
                <p>
                  <strong>Deleterious:</strong>{' '}
                  {m.deleterious === 'yes'
                    ? <span className="text-red-600 font-medium">yes</span>
                    : m.deleterious === 'no'
                    ? <span className="text-green-600">no</span>
                    : <span className="text-gray-400">unknown</span>
                  }
                </p>
              </div>
            )}
          </div>
        ))}

        {data.matches.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-sm font-medium text-gray-500">No OMIA variant matches found</p>
            <p className="text-xs mt-1">No known OMIA pathogenic variants detected at the 139 screened sites.</p>
          </div>
        )}
      </div>
    </div>
  );
}
