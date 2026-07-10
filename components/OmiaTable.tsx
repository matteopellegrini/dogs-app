'use client';

import { useEffect, useState } from 'react';

interface SampleGenotype {
  zygosity: string;
  depth: number;
  ref_count: number | null;
  alt_count: number | null;
  affected: boolean | null;
  call_confidence?: string;
  confidence_source?: string;
  glimpse2_gt?: string;
  glimpse2_af?: number;
  glimpse2_gp?: number[] | null;
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
  cosmo: SampleGenotype;
  nelk?: SampleGenotype;
}

interface OmiaResult {
  variants: Variant[];
  summary: {
    total_screened: number;
    affected_snv?: number;
    affected_high_or_medium_confidence?: number;
  };
  method: string;
}

const ZYG_STYLE: Record<string, string> = {
  'alt/alt':           'bg-red-100 text-red-700',
  'het':               'bg-orange-100 text-orange-700',
  'ref/alt':           'bg-orange-100 text-orange-700',
  'ref/ref':           'bg-green-100 text-green-700',
  'no_coverage':       'bg-gray-100 text-gray-400',
  'indel_region':      'bg-purple-100 text-purple-700',
  'indel_unresolved':  'bg-purple-100 text-purple-700',
};

const CONF_STYLE: Record<string, string> = {
  high:                   'bg-green-100 text-green-700',
  medium:                 'bg-amber-100 text-amber-700',
  low:                    'bg-gray-100 text-gray-500',
  likely_false_positive:  'bg-red-100 text-red-600',
  indel_unresolved:       'bg-purple-100 text-purple-600',
  no_coverage:            'bg-gray-100 text-gray-400',
};

const CONF_LABEL: Record<string, string> = {
  high:                   'high',
  medium:                 'medium',
  low:                    'low',
  likely_false_positive:  'likely FP',
  indel_unresolved:       'indel',
  no_coverage:            'no coverage',
};

const SOURCE_LABEL: Record<string, string> = {
  'bam+glimpse2':              'BAM + GLIMPSE2 ✓',
  'bam+glimpse2_discordant':   'BAM / GLIMPSE2 ⚠',
  'glimpse2_v2':               'GLIMPSE2 v2 ✓',
  'glimpse2_contradicts_bam':  'GLIMPSE2 contradicts BAM',
  'bam_only':                  'BAM only',
};

function traitLabel(v: Variant) {
  return v.phene_name || v.trait || '';
}

export default function OmiaTable({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData]         = useState<OmiaResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAll, setShowAll]   = useState(false);

  useEffect(() => {
    fetch(`${samplePath}/omia_result.json`).then(r => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading variant data…</div>;

  const variants = data.variants ?? [];

  const affected     = variants.filter(v => v.cosmo?.affected === true);
  const unaffected   = variants.filter(v => v.cosmo?.affected === false);
  const indel        = variants.filter(v => v.cosmo?.affected === null);
  const affHighMed   = affected.filter(v =>
    v.cosmo?.call_confidence === 'high' || v.cosmo?.call_confidence === 'medium'
  );
  const affLow       = affected.filter(v => v.cosmo?.call_confidence === 'low');

  const displayed = showAll ? variants : variants;

  return (
    <div className="space-y-4">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Sites screened</p>
          <p className="text-xl font-semibold text-gray-700">{variants.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">OMIA + commercial panel</p>
        </div>
        <div className={`border rounded-lg p-3 ${affHighMed.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-100'}`}>
          <p className={`text-xs mb-1 ${affHighMed.length > 0 ? 'text-amber-600' : 'text-green-500'}`}>
            Alt allele detected
          </p>
          <p className={`text-xl font-semibold ${affHighMed.length > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {affected.length}
          </p>
          <p className={`text-[10px] mt-0.5 ${affHighMed.length > 0 ? 'text-amber-500' : 'text-green-500'}`}>
            {affHighMed.length} high/med conf
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Indels (unresolved)</p>
          <p className="text-xl font-semibold text-gray-700">{indel.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">depth only, no zygosity</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Clear (ref/ref)</p>
          <p className="text-xl font-semibold text-gray-700">{unaffected.length}</p>
        </div>
      </div>

      {/* Method */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <strong>Method:</strong> {data.method}
      </div>

      {/* Confidence note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <strong>Coverage note:</strong> At 2.5× WGS, most positions have 1–4 reads.
        Calls with depth ≥5 are <span className="font-medium text-green-700">high confidence</span>,
        depth 3–4 are <span className="font-medium text-amber-700">medium</span>, and
        depth 1–2 are <span className="font-medium text-gray-600">low</span> (possible sequencing noise).
        Alt alleles at low-confidence sites should be confirmed with a targeted panel.
      </div>

      {/* Affected section */}
      {affected.length > 0 && (
        <>
          {affHighMed.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                {affHighMed.length} variant{affHighMed.length > 1 ? 's' : ''} — medium/high confidence
              </span>
              <div className="flex-1 border-t border-amber-300" />
            </div>
          )}
          <div className="space-y-2">
            {affHighMed.map((v, i) => <VariantRow key={`hm-${i}`} v={v} idx={i} expanded={expanded} setExpanded={setExpanded} />)}
          </div>

          {affLow.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                  {affLow.length} variant{affLow.length > 1 ? 's' : ''} — low confidence (depth 1–2)
                </span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
              <div className="space-y-2">
                {affLow.map((v, i) => <VariantRow key={`lo-${i}`} v={v} idx={1000+i} expanded={expanded} setExpanded={setExpanded} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-[10px] text-gray-400">{unaffected.length + indel.length} sites — ref/ref or indel</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Show all toggle */}
      {!showAll ? (
        <button onClick={() => setShowAll(true)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
          Show all {variants.length} screened sites
        </button>
      ) : (
        <>
          <div className="space-y-1.5">
            {[...unaffected, ...indel].map((v, i) => (
              <VariantRow key={`all-${i}`} v={v} idx={2000+i} expanded={expanded} setExpanded={setExpanded} compact />
            ))}
          </div>
          <button onClick={() => setShowAll(false)}
            className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-lg transition-colors">
            Collapse
          </button>
        </>
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
  const sg      = v.cosmo;
  const isAff   = sg?.affected === true;
  const isIndel = sg?.zygosity === 'indel_region' || sg?.zygosity === 'indel_unresolved';
  const conf    = sg?.call_confidence ?? 'no_coverage';
  const label   = traitLabel(v);

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
                {v.ref && v.alt ? ` ${v.ref}>${v.alt}` : v.variant_type ? ` (${v.variant_type})` : ' (indel)'}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ZYG_STYLE[sg?.zygosity ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                {sg?.zygosity ?? '—'}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400">
                DP={sg?.depth ?? 0}
              </span>
              {isAff && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CONF_STYLE[conf]}`}>
                  {CONF_LABEL[conf] ?? conf}
                </span>
              )}
              {sg?.glimpse2_gt && sg.glimpse2_gt !== sg.zygosity && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 font-medium">
                  G2:{sg.glimpse2_gt}
                </span>
              )}
              {sg?.confidence_source === 'bam+glimpse2' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-600">
                  GLIMPSE2 ✓
                </span>
              )}
              {v.hgvs_c && !compact && (
                <span className="font-mono text-[10px] text-gray-400">{v.hgvs_c}</span>
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
          <div className="flex gap-3 flex-wrap">
            <div>
              <span className="text-gray-400">BAM pileup: </span>
              <span className={`px-1.5 py-0.5 rounded font-medium ${ZYG_STYLE[sg?.zygosity ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                {sg?.zygosity}
              </span>
              {sg?.ref_count !== null && sg?.ref_count !== undefined && (
                <span className="ml-1 text-gray-400">({sg.ref_count}R / {sg.alt_count}A, depth={sg.depth})</span>
              )}
            </div>
            {sg?.glimpse2_gt && (
              <div>
                <span className="text-gray-400">GLIMPSE2: </span>
                <span className={`px-1.5 py-0.5 rounded font-medium ${ZYG_STYLE[sg.glimpse2_gt] ?? 'bg-gray-100 text-gray-500'}`}>
                  {sg.glimpse2_gt}
                </span>
                {sg.glimpse2_af !== undefined && (
                  <span className="ml-1 text-gray-400">AF={sg.glimpse2_af.toFixed(4)}</span>
                )}
                {Array.isArray(sg.glimpse2_gp) && (
                  <span className="ml-1 text-gray-400">GP=[{sg.glimpse2_gp.map(p => p.toFixed(3)).join(', ')}]</span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <div>
              <span className="text-gray-400">Confidence: </span>
              <span className={`px-1.5 py-0.5 rounded font-medium ${CONF_STYLE[conf]}`}>
                {CONF_LABEL[conf] ?? conf}
              </span>
            </div>
            {sg?.confidence_source && (
              <div>
                <span className="text-gray-400">Source: </span>
                <span className="text-gray-600">{SOURCE_LABEL[sg.confidence_source] ?? sg.confidence_source}</span>
              </div>
            )}
          </div>
          {sg?.note && (
            <p className="text-gray-500 italic">{sg.note}</p>
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
