'use client';

import { useEffect, useState } from 'react';

interface TraitResult {
  prs_z: number;
  percentile: number;
  predicted_score: number;
  n_ref_samples: number;
  nelk_akc_score: number | null;
  description: string;
}

interface PhysicalTrait {
  prs_z: number;
  percentile: number;
  n_ref_samples: number;
  nelk_akc_score: number | string;
  description: string;
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

function percentileColor(p: number) {
  if (p >= 75) return { bar: 'bg-[#3540CA]', text: 'text-[#3540CA]', bg: 'bg-[#C4F9FF]/20' };
  if (p >= 50) return { bar: 'bg-[#3540CA]', text: 'text-[#3540CA]', bg: 'bg-[#C4F9FF]/20' };
  if (p >= 25) return { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { bar: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50' };
}

function scoreLabel(score: number) {
  if (score >= 4.5) return 'Very high';
  if (score >= 3.5) return 'High';
  if (score >= 2.5) return 'Moderate';
  if (score >= 1.5) return 'Low';
  return 'Very low';
}

export default function PrsPanel() {
  const [data, setData] = useState<PrsResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/prs_result.json').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading polygenic risk scores…</div>;

  const entries = Object.entries(data.traits);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#C4F9FF]/20 border border-[#C4F9FF]/40 rounded-lg p-3 text-xs text-[#3540CA]">
        <strong>Method:</strong> GWAS-based PRS · {data.snps.toLocaleString()} LD-pruned SNPs ·{' '}
        {data.n_ref_breeds} AKC breed trait profiles · Parker 2017 reference panel
      </div>

      {/* Physical traits */}
      {data.physical_traits && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Physical Trait Predictions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Height */}
            {data.physical_traits.height_cm && (
              <div className="bg-[#C4F9FF]/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-[#3540CA]">
                  {data.physical_traits.height_cm.pred_cm} <span className="text-sm font-normal">cm</span>
                </p>
                <p className="text-xs text-[#3540CA] mt-0.5">Height (withers)</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {data.physical_traits.height_cm.percentile.toFixed(0)}th pct · NELK {data.physical_traits.height_cm.nelk_akc_score} cm
                </p>
              </div>
            )}
            {/* Weight */}
            {data.physical_traits.weight_kg && (
              <div className="bg-[#C4F9FF]/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-[#3540CA]">
                  {data.physical_traits.weight_kg.pred_kg} <span className="text-sm font-normal">kg</span>
                </p>
                <p className="text-xs text-[#3540CA] mt-0.5">
                  Weight <span className="text-gray-400">({data.physical_traits.weight_kg.pred_lbs} lbs)</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {data.physical_traits.weight_kg.percentile.toFixed(0)}th pct · NELK {data.physical_traits.weight_kg.nelk_akc_score} kg
                </p>
              </div>
            )}
            {/* Coat type */}
            {data.physical_traits.coat_type && (
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-amber-700 leading-tight mt-0.5">
                  {data.physical_traits.coat_type.predicted}
                </p>
                <p className="text-xs text-amber-500 mt-0.5">Coat Type</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {data.physical_traits.coat_type.percentile.toFixed(0)}th pct · NELK {data.physical_traits.coat_type.nelk_akc_score}
                </p>
              </div>
            )}
            {/* Coat length */}
            {data.physical_traits.coat_length && (
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-orange-700 leading-tight mt-0.5">
                  {data.physical_traits.coat_length.predicted}
                </p>
                <p className="text-xs text-orange-500 mt-0.5">Coat Length</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {data.physical_traits.coat_length.percentile.toFixed(0)}th pct · NELK {data.physical_traits.coat_length.nelk_akc_score}
                </p>
              </div>
            )}
          </div>
          {/* Size context */}
          <p className="text-[10px] text-gray-400 mt-3">
            Predictions based on GWAS effect sizes from {data.physical_traits.height_cm?.n_ref_samples.toLocaleString()} reference dogs across {data.n_ref_breeds} breeds. Height/weight reflect male midpoint AKC standards per breed.
          </p>
        </div>
      )}

      {/* Trait cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries.map(([trait, res]) => {
          const col = percentileColor(res.percentile);
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
                  {res.percentile.toFixed(0)}th pct
                </span>
              </div>

              {/* Score bar */}
              <div className="mb-1">
                <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                  <span>Genomic prediction</span>
                  <span>{res.predicted_score.toFixed(1)}/5 · {scoreLabel(res.predicted_score)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${col.bar}`}
                    style={{ width: `${(res.predicted_score / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* AKC reference comparison */}
              {res.nelk_akc_score !== null && (
                <div className="mt-1">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                    <span>AKC Norwegian Elkhound reference</span>
                    <span>{res.nelk_akc_score}/5</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-300"
                      style={{ width: `${(res.nelk_akc_score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Expanded detail */}
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                  <p>{res.description}</p>
                  <p>PRS z-score: <span className="font-medium text-gray-700">{res.prs_z > 0 ? '+' : ''}{res.prs_z.toFixed(2)}</span></p>
                  <p>Reference population: {res.n_ref_samples.toLocaleString()} dogs from {data.n_ref_breeds} breeds</p>
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
          Summary — all traits ranked by percentile
        </h3>
        <div className="space-y-1.5">
          {[...entries]
            .sort(([, a], [, b]) => b.percentile - a.percentile)
            .map(([trait, res]) => {
              const col = percentileColor(res.percentile);
              return (
                <div key={trait} className="flex items-center gap-3 text-xs">
                  <span className="w-5 text-base leading-none">{TRAIT_ICONS[trait] ?? '📊'}</span>
                  <span className="w-48 text-gray-600 truncate shrink-0">{trait}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${col.bar}`} style={{ width: `${res.percentile}%` }} />
                  </div>
                  <span className={`w-12 text-right font-medium ${col.text}`}>{res.percentile.toFixed(0)}th</span>
                </div>
              );
            })}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1">
        <p><strong>Interpretation notes:</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li>PRS scores predict <em>genomic tendency</em> relative to other dog breeds — they reflect breed-level genetic predisposition, not individual certainty.</li>
          <li>AKC reference scores (grey bars) are for Norwegian Elkhound, the closest breed in the Parker panel to the Jamthund.</li>
          <li>Traits with z-score near 0 indicate the dog&apos;s genomic profile is average for the reference population; high/low percentiles indicate distinctive genomic signal.</li>
          <li>PRS is computed using {data.snps.toLocaleString()} LD-pruned SNPs genotyped directly from BAM.</li>
        </ul>
      </div>
    </div>
  );
}
