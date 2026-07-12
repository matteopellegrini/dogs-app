'use client';

import { useEffect, useState } from 'react';

interface Heritability {
  h2: number;
  ci: string;
  source: string;
}

interface TraitResult {
  prs_z: number;
  percentile: number;
  predicted_score: number;
  n_ref_samples: number;
  nelk_akc_score: number | null;
  description: string;
  heritability?: Heritability;
}

interface PhysicalTrait {
  prs_z: number;
  percentile: number;
  n_ref_samples: number;
  nelk_akc_score: number | string;
  description: string;
  caveat?: string;
  heritability?: Heritability;
  // height
  pred_cm?: number;
  // weight
  pred_kg?: number;
  pred_lbs?: number;
  // coat
  predicted?: string;
}

interface PrsResult {
  traits: Record<string, TraitResult>;
  physical_traits?: Record<string, PhysicalTrait>;
  method: string;
  reference: string;
  snps: number;
  n_ref_breeds: number;
  coverage_note?: string;
  heritability_sources?: string;
}

const TRAIT_ICONS: Record<string, string> = {
  'Affectionate With Family': '❤️',
  'Good With Young Children': '👶',
  'Good With Other Dogs': '🐾',
  'Shedding Level': '🧹',
  'Coat Grooming Frequency': '✂️',
  'Drooling Level': '💧',
  'Openness To Strangers': '🤝',
  'Playfulness Level': '🎾',
  'Watchdog/Protective Nature': '🛡️',
  'Adaptability Level': '🌀',
  'Trainability Level': '🎓',
  'Energy Level': '⚡',
  'Barking Level': '📣',
  'Mental Stimulation Needs': '🧠',
};

function scoreColor(score: number) {
  if (score >= 4.5) return { bar: 'bg-[#3540CA]', text: 'text-[#3540CA]', bg: 'bg-[#C4F9FF]/20' };
  if (score >= 3.5) return { bar: 'bg-[#3540CA]', text: 'text-[#3540CA]', bg: 'bg-[#C4F9FF]/20' };
  if (score >= 2.5) return { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  if (score >= 1.5) return { bar: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50' };
  return { bar: 'bg-gray-300', text: 'text-gray-500', bg: 'bg-gray-50' };
}

function scoreLabel(score: number) {
  if (score >= 4.5) return 'Very high';
  if (score >= 3.5) return 'High';
  if (score >= 2.5) return 'Moderate';
  if (score >= 1.5) return 'Low';
  return 'Very low';
}

export default function PrsPanel({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<PrsResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${samplePath}/prs_result.json`).then(r => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading polygenic risk scores…</div>;

  const entries = Object.entries(data.traits);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#C4F9FF]/20 border border-[#C4F9FF]/40 rounded-lg p-3 text-xs text-[#3540CA]">
        <strong>Method:</strong> GWAS-based PRS · {data.snps.toLocaleString()} LD-pruned SNPs ·{' '}
        {data.n_ref_breeds} AKC breed trait profiles · Parker 2017 reference panel
      </div>

      {/* Coverage note for low-coverage samples */}
      {data.coverage_note && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          ⚠️ <strong>Coverage note:</strong> {data.coverage_note}
        </div>
      )}

      {/* Physical traits */}
      {data.physical_traits && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Physical Trait Predictions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Height */}
            {data.physical_traits.height_cm && (
              <div className="bg-[#C4F9FF]/20 rounded-lg p-3">
                <p className="text-xs font-medium text-[#3540CA] mb-1">Height</p>
                <p className="text-xl font-bold text-[#3540CA]">
                  {data.physical_traits.height_cm.percentile.toFixed(0)}<span className="text-sm font-normal">th pct</span>
                </p>
                <div className="mt-1.5 h-1.5 bg-[#C4F9FF]/60 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#3540CA]" style={{ width: `${data.physical_traits.height_cm.percentile}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">vs. reference breeds</p>
                {data.physical_traits.height_cm.heritability && (
                  <p className="text-[10px] text-gray-400">h² = {data.physical_traits.height_cm.heritability.h2}</p>
                )}
              </div>
            )}
            {/* Weight */}
            {data.physical_traits.weight_kg && (
              <div className="bg-[#C4F9FF]/20 rounded-lg p-3">
                <p className="text-xs font-medium text-[#3540CA] mb-1">Weight</p>
                <p className="text-xl font-bold text-[#3540CA]">
                  {data.physical_traits.weight_kg.percentile.toFixed(0)}<span className="text-sm font-normal">th pct</span>
                </p>
                <div className="mt-1.5 h-1.5 bg-[#C4F9FF]/60 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#3540CA]" style={{ width: `${data.physical_traits.weight_kg.percentile}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">vs. reference breeds</p>
                {data.physical_traits.weight_kg.heritability && (
                  <p className="text-[10px] text-gray-400">h² = {data.physical_traits.weight_kg.heritability.h2}</p>
                )}
              </div>
            )}
            {/* Coat type */}
            {data.physical_traits.coat_type && (
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-amber-700 leading-tight mt-0.5">
                  {data.physical_traits.coat_type.predicted}
                </p>
                <p className="text-xs text-amber-500 mt-0.5">Coat Type</p>
                {data.physical_traits.coat_type.heritability && (
                  <p className="text-[10px] text-gray-400">h² = {data.physical_traits.coat_type.heritability.h2}</p>
                )}
              </div>
            )}
            {/* Coat length */}
            {data.physical_traits.coat_length && (
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-orange-700 leading-tight mt-0.5">
                  {data.physical_traits.coat_length.predicted}
                </p>
                <p className="text-xs text-orange-500 mt-0.5">Coat Length</p>
                {data.physical_traits.coat_length.heritability && (
                  <p className="text-[10px] text-gray-400">h² = {data.physical_traits.coat_length.heritability.h2}</p>
                )}
              </div>
            )}
          </div>
          {/* Size context */}
          <p className="text-[10px] text-gray-400 mt-3">
            Genomic size percentile based on {(data.physical_traits.height_cm?.n_ref_samples ?? 0).toLocaleString()} reference dogs across {data.n_ref_breeds} breeds.
            Absolute height/weight predictions are omitted — they are unreliable for mixed-breed individuals due to the purebred reference panel. h² = SNP heritability from published GWAS studies.
          </p>
        </div>
      )}

      {/* Trait cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries.map(([trait, res]) => {
          const col = scoreColor(res.predicted_score);
          const isOpen = expanded === trait;
          return (
            <div
              key={trait}
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#3540CA]/20 transition-colors"
              onClick={() => setExpanded(isOpen ? null : trait)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TRAIT_ICONS[trait] ?? '📊'}</span>
                  <span className="text-sm font-medium text-gray-800">{trait}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.bg} ${col.text} shrink-0`}>
                  {scoreLabel(res.predicted_score)}
                </span>
              </div>

              {/* Score bar */}
              <div className="mb-1">
                <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                  <span>Genomic prediction</span>
                  <span>{res.predicted_score.toFixed(1)} / 5</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${col.bar}`}
                    style={{ width: `${(res.predicted_score / 5) * 100}%` }}
                  />
                </div>
              </div>


              {/* Expanded detail */}
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                  <p>{res.description}</p>
                  <p>PRS z-score: <span className="font-medium text-gray-700">{res.prs_z > 0 ? '+' : ''}{res.prs_z.toFixed(2)}</span></p>
                  <p>Reference population: {res.n_ref_samples.toLocaleString()} dogs from {data.n_ref_breeds} breeds</p>
                  {res.heritability && (
                    <p>
                      Heritability: <span className="font-medium text-gray-700">h² = {res.heritability.h2}</span>
                      <span className="text-gray-400"> (95% CI {res.heritability.ci}) · {res.heritability.source}</span>
                    </p>
                  )}
                  <p className="text-gray-400">Percentile rank among reference dogs based on genomic profile</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Radar-style summary table */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Summary — all traits
        </h3>
        <div className="space-y-1.5">
          {[...entries]
            .sort(([, a], [, b]) => b.predicted_score - a.predicted_score)
            .map(([trait, res]) => {
              const col = scoreColor(res.predicted_score);
              return (
                <div key={trait} className="flex items-center gap-3 text-xs">
                  <span className="w-5 text-base leading-none">{TRAIT_ICONS[trait] ?? '📊'}</span>
                  <span className="w-48 text-gray-600 truncate shrink-0">{trait}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${col.bar}`} style={{ width: `${(res.predicted_score / 5) * 100}%` }} />
                  </div>
                  <span className={`w-16 text-right font-medium ${col.text}`}>{scoreLabel(res.predicted_score)}</span>
                </div>
              );
            })}
        </div>
      </div>

      {data.heritability_sources && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
          <strong>Heritability sources:</strong> {data.heritability_sources}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1">
        <p><strong>Interpretation notes:</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li>PRS scores predict <em>genomic tendency</em> relative to the Parker 2017 reference panel — they reflect breed-level genetic predisposition, not individual certainty.</li>
          <li>h² (heritability) indicates what fraction of trait variation among purebred dogs is explained by genetics. High h² = PRS more predictive.</li>
          <li>Traits with z-score near 0 indicate an average genomic profile for the reference population; high/low percentiles indicate distinctive signal.</li>
          <li>PRS computed using {data.snps.toLocaleString()} SNPs genotyped from the Parker reference panel.</li>
          <li>Cross-breed dogs (e.g. labradoodles) may show predictions intermediate between parent breeds; size predictions are noisier at low coverage.</li>
        </ul>
      </div>
    </div>
  );
}
