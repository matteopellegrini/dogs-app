'use client';

import { useEffect, useState } from 'react';

interface SampleGenotype {
  zygosity: string;
  affected: boolean;
  call_confidence: string;
  glimpse2_gt?: string;
  glimpse2_gp?: number[] | null;
  source?: string;
  af_dog10k?: number | null;
  note?: string;
}

interface Variant {
  gene: string;
  chrom: string;
  pos: number;
  ref?: string;
  alt?: string;
  variant_type?: string;
  hgvs_c?: string;
  hgvs_p?: string;
  phene_name?: string;
  trait?: string;
  omia_id?: string;
  deleterious?: string;
  characterised?: string;
  mol_gen?: string;
  clinical_note?: string;
  variant_breed?: string;
  panel?: string;
  reference?: string;
  source?: string;
  kiki?: SampleGenotype;
  // legacy field (other dogs)
  cosmo?: SampleGenotype;
}

interface OmiaResult {
  variants: Variant[];
  summary: {
    total_screened: number;
    affected_snv?: number;
    affected_high_confidence?: number;
    in_dog10k_panel?: number;
  };
  method: string;
}

const ZYG_STYLE: Record<string, string> = {
  'alt/alt':             'bg-red-100 text-red-700',
  'het':                 'bg-orange-100 text-orange-700',
  'ref/alt':             'bg-orange-100 text-orange-700',
  'ref/ref':             'bg-green-100 text-green-700',
  'low_gp_no_call':      'bg-gray-100 text-gray-400',
  'no_coverage':         'bg-gray-100 text-gray-400',
  'indel_region':        'bg-purple-100 text-purple-700',
  'indel_unresolved':    'bg-purple-100 text-purple-700',
};

const CONF_STYLE: Record<string, string> = {
  high:   'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-500',
};

function traitLabel(v: Variant) {
  return v.phene_name || v.trait || '';
}

function sampleGt(v: Variant): SampleGenotype | undefined {
  return v.kiki ?? v.cosmo;
}

export default function OmiaTable({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData]         = useState<OmiaResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAll, setShowAll]   = useState(false);

  useEffect(() => {
    fetch(`${samplePath}/omia_result.json`).then(r => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading variant data…</div>;

  const allVariants = data.variants ?? [];

  // Only show variants that were actually tested (have a genotype call)
  const tested    = allVariants.filter(v => sampleGt(v) !== undefined);
  const affected  = tested.filter(v => sampleGt(v)?.affected === true);
  const cleared   = tested.filter(v => sampleGt(v)?.affected === false);
  const notTested = allVariants.length - tested.length;

  return (
    <div className="space-y-4">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Tested</p>
          <p className="text-xl font-semibold text-gray-700">{tested.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">present in Dog10K panel</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Not in panel</p>
          <p className="text-xl font-semibold text-gray-500">{notTested}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">of {allVariants.length} total known</p>
        </div>
        <div className={`border rounded-lg p-3 ${affected.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-100'}`}>
          <p className={`text-xs mb-1 ${affected.length > 0 ? 'text-amber-600' : 'text-green-500'}`}>
            Alt allele detected
          </p>
          <p className={`text-xl font-semibold ${affected.length > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {affected.length}
          </p>
          <p className={`text-[10px] mt-0.5 ${affected.length > 0 ? 'text-amber-500' : 'text-green-400'}`}>
            high confidence
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Clear (ref/ref)</p>
          <p className="text-xl font-semibold text-gray-700">{cleared.length}</p>
        </div>
      </div>

      {/* Method */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <strong>Method:</strong> {data.method}
      </div>

      {/* Affected — always shown at top */}
      {affected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              {affected.length} variant{affected.length > 1 ? 's' : ''} detected
            </span>
            <div className="flex-1 border-t border-amber-300" />
          </div>
          {affected.map((v, i) => (
            <VariantRow key={`aff-${i}`} v={v} idx={i} expanded={expanded} setExpanded={setExpanded} />
          ))}
        </div>
      )}

      {/* Cleared — collapsible */}
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-[10px] text-gray-400">{cleared.length} tested — clear</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {!showAll ? (
        <button onClick={() => setShowAll(true)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
          Show all {tested.length} tested variants
        </button>
      ) : (
        <>
          <div className="space-y-1.5">
            {cleared.map((v, i) => (
              <VariantRow key={`clr-${i}`} v={v} idx={1000 + i} expanded={expanded} setExpanded={setExpanded} compact />
            ))}
          </div>
          <button onClick={() => setShowAll(false)}
            className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-lg transition-colors">
            Collapse
          </button>
        </>
      )}

      {notTested > 0 && (
        <p className="text-[10px] text-gray-400 text-center">
          {notTested} of {allVariants.length} screened variants were not present in the Dog10K imputation panel and could not be genotyped.
        </p>
      )}
    </div>
  );
}

function VariantRow({
  v, idx, expanded, setExpanded, compact = false,
}: {
  v: Variant;
  idx: number;
  expanded: number | null;
  setExpanded: (n: number | null) => void;
  compact?: boolean;
}) {
  const sg    = sampleGt(v);
  const isAff = sg?.affected === true;
  const conf  = sg?.call_confidence ?? '';
  const label = traitLabel(v);

  return (
    <div className={`border rounded-lg overflow-hidden ${isAff ? 'border-amber-200' : 'border-gray-100'}`}>
      <div
        className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'} flex items-start justify-between gap-3 cursor-pointer ${
          isAff ? 'bg-amber-50 hover:bg-amber-100/60' : 'bg-gray-50/40 hover:bg-gray-100/40'
        }`}
        onClick={() => setExpanded(expanded === idx ? null : idx)}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="min-w-0">
            <span className={`font-semibold text-sm ${isAff ? 'text-gray-800' : 'text-gray-400'}`}>
              {v.gene || '—'}
            </span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              <span className="font-mono text-[10px] text-gray-400">
                {v.chrom}:{v.pos?.toLocaleString()}
                {v.ref && v.alt ? ` ${v.ref}>${v.alt}` : v.variant_type ? ` (${v.variant_type})` : ''}
              </span>
              {sg && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ZYG_STYLE[sg.zygosity] ?? 'bg-gray-100 text-gray-500'}`}>
                  {sg.zygosity}
                </span>
              )}
              {isAff && conf && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CONF_STYLE[conf] ?? 'bg-gray-100 text-gray-500'}`}>
                  {conf}
                </span>
              )}
              {v.hgvs_p && !compact && (
                <span className="font-mono text-[10px] text-gray-400">{v.hgvs_p}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {label ? (
            <span className={`text-xs font-medium max-w-[160px] block truncate ${isAff ? 'text-amber-700' : 'text-gray-400'}`} title={label}>
              {label}
            </span>
          ) : (
            <span className="text-[10px] text-gray-300 italic">no phene</span>
          )}
          <div className="mt-0.5 text-[10px] text-gray-300">{expanded === idx ? '▲' : '▼'}</div>
        </div>
      </div>

      {expanded === idx && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white space-y-2 text-xs text-gray-600">
          {sg && (
            <div className="flex gap-3 flex-wrap">
              <div>
                <span className="text-gray-400">Genotype: </span>
                <span className={`px-1.5 py-0.5 rounded font-medium ${ZYG_STYLE[sg.zygosity] ?? 'bg-gray-100 text-gray-500'}`}>
                  {sg.zygosity}
                </span>
                {sg.glimpse2_gt && (
                  <span className="ml-1 text-gray-400">({sg.glimpse2_gt})</span>
                )}
              </div>
              {Array.isArray(sg.glimpse2_gp) && (
                <div>
                  <span className="text-gray-400">GP: </span>
                  <span className="font-mono">[{sg.glimpse2_gp.map(p => p.toFixed(3)).join(', ')}]</span>
                </div>
              )}
              {sg.af_dog10k !== undefined && sg.af_dog10k !== null && (
                <div>
                  <span className="text-gray-400">Dog10K AF: </span>
                  <span>{(sg.af_dog10k * 100).toFixed(1)}%</span>
                </div>
              )}
              {sg.note && (
                <p className="text-gray-500 italic w-full">{sg.note}</p>
              )}
            </div>
          )}
          {v.omia_id && (
            <p><strong>OMIA ID:</strong> {v.omia_id}
              {v.characterised === 'yes' && (
                <span className="ml-2 bg-green-100 text-green-700 px-1.5 py-0.5 rounded">characterised</span>
              )}
            </p>
          )}
          {v.hgvs_c && <p><strong>HGVS:</strong> <span className="font-mono">{v.hgvs_c} {v.hgvs_p}</span></p>}
          {v.variant_breed && (
            <p><strong>Breed association:</strong> {v.variant_breed}</p>
          )}
          {v.panel && (
            <p><strong>Commercial panel:</strong> {v.panel}</p>
          )}
          {v.mol_gen && <p><strong>Molecular genetics:</strong> {v.mol_gen}</p>}
          {v.clinical_note && (
            <p className="text-[#3540CA] bg-[#C4F9FF]/20 px-2 py-1.5 rounded">
              <strong>Note:</strong> {v.clinical_note}
            </p>
          )}
          {v.deleterious !== undefined && (
            <p>
              <strong>Deleterious:</strong>{' '}
              {v.deleterious === 'yes'
                ? <span className="text-red-600 font-medium">yes</span>
                : v.deleterious === 'no'
                ? <span className="text-green-600">no</span>
                : <span className="text-gray-400">unknown</span>
              }
            </p>
          )}
          {v.reference && (
            <p><strong>Reference:</strong> <span className="font-mono text-[10px] break-all">{v.reference}</span></p>
          )}
          {v.source && (
            <p className="text-gray-400">Source: {v.source}</p>
          )}
        </div>
      )}
    </div>
  );
}
