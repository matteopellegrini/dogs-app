'use client';

import { useEffect, useState } from 'react';

interface LocusData {
  gene: string;
  chrom: string;
  name: string;
  role: string;
  alleles_reference: Record<string, string>;
  observed_variants: { pos?: number; gt?: string; effect?: string; af?: number; source: string }[];
  interpretation: string;
  predicted_alleles: string[];
  confidence: 'high' | 'medium' | 'low';
  phenotype_contribution: string;
}

interface CoatColorResult {
  summary: {
    predicted_base_color: string;
    predicted_pattern: string;
    predicted_dilution: string;
    predicted_white: string;
    predicted_merle: string;
    overall_confidence: string;
    validation_warning?: string;
    caveat: string;
    irf4_note: string;
  };
  loci: Record<string, LocusData>;
}

const LOCUS_ORDER = ['E', 'K', 'A', 'B', 'D', 'M', 'S', 'W'];

const LOCUS_COLORS: Record<string, string> = {
  E: '#f59e0b', K: '#6366f1', A: '#10b981', B: '#7c3aed',
  D: '#3b82f6', M: '#ec4899', S: '#14b8a6', W: '#f97316',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-500',
};

function deriveSwatches(summary: CoatColorResult['summary'], loci: Record<string, LocusData>) {
  const eAlleles = loci['E']?.predicted_alleles ?? [];
  const bAlleles = loci['B']?.predicted_alleles ?? [];
  const dAlleles = loci['D']?.predicted_alleles ?? [];
  const isRecRed  = eAlleles[0] === 'e' && eAlleles[1] === 'e';
  const isBrown   = bAlleles[0] === 'b' && bAlleles[1] === 'b';
  const isDilute  = dAlleles[0] === 'd' && dAlleles[1] === 'd';

  if (isRecRed) {
    const baseColor = isDilute ? '#E8D5A3' : '#D4A855';
    return [
      { color: baseColor, caption: isDilute ? 'Cream (phaeomelanin, dilute)' : 'Yellow/cream (phaeomelanin)' },
    ];
  }
  let eumeColor = isBrown ? '#7B4F2E' : '#2C2C2C';
  if (isDilute) eumeColor = isBrown ? '#B8967A' : '#7A8FA6';
  return [
    { color: eumeColor, caption: `${isBrown ? 'Brown' : 'Black'} eumelanin${isDilute ? ' (dilute)' : ''}` },
    { color: '#C8A468', caption: 'Phaeomelanin (tan/cream areas)' },
  ];
}

function VariantBadge({ gt, af }: { gt?: string; af?: number }) {
  const isHom = gt === '1|1' || gt === '1/1' || gt === 'hom_alt';
  const isHet = gt === '0/1' || gt === '1|0' || gt === '0|1' || gt === 'het';
  if (isHom) return (
    <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-700 font-mono font-semibold">HOM ALT</span>
  );
  if (isHet) return (
    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-mono font-semibold">HET</span>
  );
  return null;
}

export default function CoatColorPanel({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<CoatColorResult | null>(null);
  const [expandedLocus, setExpandedLocus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${samplePath}/coat_color.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => {});
  }, [samplePath]);

  if (!data) return (
    <div className="text-gray-400 text-sm py-8 text-center">Loading coat color analysis…</div>
  );

  const { summary, loci } = data;
  const swatches = deriveSwatches(summary, loci);

  return (
    <div className="space-y-5">

      {/* Header banner */}
      <div className="bg-[#C4F9FF]/20 border border-[#C4F9FF]/40 rounded-lg p-3 text-xs text-[#3540CA]">
        <strong>Method:</strong> Mendelian locus genotyping · Dog10K GLIMPSE2 imputed WGS ·
        7 classical coat color loci · variants cross-referenced with published canFam4 coordinates
      </div>

      {/* Summary card */}
      <div className="border border-gray-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Predicted coat color — summary
        </h3>
        <div className="flex gap-4 flex-wrap">
          {/* Data-driven color swatches */}
          <div className="flex gap-2 items-start">
            {swatches.map(s => (
              <div key={s.caption} className="text-center">
                <div className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm mb-1"
                  style={{ background: s.color }} />
                <p className="text-[9px] text-gray-400 leading-tight max-w-[48px]">{s.caption}</p>
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-48 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Base color</span>
              <span className="font-medium text-gray-700">{summary.predicted_base_color}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pattern</span>
              <span className="font-medium text-gray-700">{summary.predicted_pattern}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Dilution</span>
              <span className="font-medium text-gray-700">{summary.predicted_dilution}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">White markings</span>
              <span className="font-medium text-gray-700">{summary.predicted_white}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Merle</span>
              <span className="font-medium text-gray-700">{summary.predicted_merle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Overall confidence</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONFIDENCE_STYLES[summary.overall_confidence] ?? CONFIDENCE_STYLES['low']}`}>
                {summary.overall_confidence}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation warning (e.g. tagging SNP miscall) */}
      {summary.validation_warning && (
        <div className="rounded-lg px-3 py-2 text-xs border bg-amber-50 border-amber-300">
          <p className="font-semibold text-amber-800 mb-0.5">⚠ E locus validation warning</p>
          <p className="text-amber-700">{summary.validation_warning}</p>
        </div>
      )}

      {/* IRF4 callout */}
      {(() => {
        const hasIrf4 = !/^No IRF4/i.test(summary.irf4_note ?? '');
        return (
          <div className={`rounded-lg px-3 py-2 text-xs border ${hasIrf4 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className={`font-semibold mb-0.5 ${hasIrf4 ? 'text-red-800' : 'text-green-800'}`}>
              IRF4 deletion — pigmentation modifier
            </p>
            <p className={hasIrf4 ? 'text-red-700' : 'text-green-700'}>{summary.irf4_note}</p>
          </div>
        );
      })()}

      {/* Locus-by-locus table */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Locus-by-locus genotypes
        </h3>
        <div className="space-y-2">
          {LOCUS_ORDER.map(locusKey => {
            const locus = loci[locusKey];
            if (!locus) return null;
            const isExpanded = expandedLocus === locusKey;
            const accentColor = LOCUS_COLORS[locusKey];
            const confStyle = CONFIDENCE_STYLES[locus.confidence];

            return (
              <div key={locusKey}
                className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedLocus(isExpanded ? null : locusKey)}
                >
                  {/* Locus badge */}
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: accentColor }}>
                    {locusKey}
                  </span>

                  {/* Gene + name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700">{locus.gene}</span>
                      <span className="text-[10px] text-gray-400">{locus.name}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{locus.phenotype_contribution}</p>
                  </div>

                  {/* Predicted alleles */}
                  <div className="text-right flex-shrink-0">
                    <div className="flex gap-1 justify-end">
                      {locus.predicted_alleles.map((a, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-gray-100 text-gray-600">
                          {a}
                        </span>
                      ))}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium mt-1 inline-block ${confStyle}`}>
                      {locus.confidence} confidence
                    </span>
                  </div>

                  {/* Expand arrow */}
                  <span className="text-gray-300 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/50">
                    {/* Role */}
                    <p className="text-xs text-gray-500">{locus.role}</p>

                    {/* Interpretation */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Interpretation</p>
                      <p className="text-xs text-gray-600">{locus.interpretation}</p>
                    </div>

                    {/* Observed variants */}
                    {locus.observed_variants.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                          Observed variants ({locus.observed_variants.length})
                        </p>
                        <div className="space-y-1">
                          {locus.observed_variants.map((v, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                              {v.pos && (
                                <span className="font-mono text-gray-400">
                                  {locus.chrom}:{v.pos.toLocaleString()}
                                </span>
                              )}
                              <VariantBadge gt={v.gt} af={v.af} />
                              {v.af !== undefined && (
                                <span className="text-gray-400">AF={v.af.toFixed(2)}</span>
                              )}
                              {v.effect && <span className="text-gray-500">{v.effect}</span>}
                              <span className="text-gray-300">· {v.source}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Known alleles reference */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        Known alleles at this locus
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        {Object.entries(locus.alleles_reference).map(([allele, desc]) => (
                          <div key={allele} className="flex gap-1.5 text-[10px]">
                            <span className="font-mono font-semibold text-gray-600 flex-shrink-0">{allele}</span>
                            <span className="text-gray-400">{desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Caveat */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
        <strong>Note:</strong> {summary.caveat}
      </div>

    </div>
  );
}
