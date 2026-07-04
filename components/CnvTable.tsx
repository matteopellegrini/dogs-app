'use client';

import { useEffect, useState } from 'react';
import CnvCoverage from './CnvCoverage';

interface ArtefactRegion {
  chrom: string;
  start: number;
  end: number;
  size: string;
  cosmo_pct_flank: number;
  nelk_pct_flank: number;
  verdict: string;
}

interface CnvData {
  regions: unknown[];
  disrupted_genes: unknown[];
  artefact_regions?: ArtefactRegion[];
  summary: {
    total_regions: number;
    artefact_note?: string;
    min_detectable_kb?: number;
    calling_resolution_kb?: number;
  };
}

export default function CnvTable({ samplePath = '' }: { samplePath?: string } = {}) {
  const [data, setData] = useState<CnvData | null>(null);

  useEffect(() => {
    fetch(`${samplePath}/cnv_homdel.json`).then(r => r.json()).then(setData);
  }, [samplePath]);

  if (!data) return <div className="text-gray-400 text-sm py-8 text-center">Loading CNV data…</div>;

  const noRealDeletions = data.summary.total_regions === 0;
  const artefacts = data.artefact_regions ?? [];

  return (
    <div className="space-y-4">
      {/* Result banner */}
      {noRealDeletions ? (
        <div className="bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg px-3 py-3">
          <p className="font-semibold mb-1">✓ No confident CNV deletions detected</p>
          <p className="text-green-700">{data.summary.artefact_note}</p>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-3 py-2">
          ℹ️ At 2x mean coverage, the minimum detectable deletion is{' '}
          <strong>{data.summary.min_detectable_kb} kb</strong> (called at {data.summary.calling_resolution_kb} kb resolution).
        </div>
      )}

      {/* Artefact regions table */}
      {artefacts.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Rejected regions — mappability artefacts
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-left">
                  <th className="py-2 pr-4 font-medium">Region</th>
                  <th className="py-2 pr-4 font-medium">Size</th>
                  <th className="py-2 pr-4 font-medium text-right">Cosmo % flank</th>
                  <th className="py-2 pr-4 font-medium text-right">NELK % flank</th>
                  <th className="py-2 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {artefacts.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 pr-4 font-mono text-gray-500">
                      {r.chrom}:{(r.start/1e6).toFixed(1)}–{(r.end/1e6).toFixed(1)} Mb
                    </td>
                    <td className="py-1.5 pr-4 text-gray-400">{r.size}</td>
                    <td className="py-1.5 pr-4 text-right text-gray-600">{r.cosmo_pct_flank}%</td>
                    <td className="py-1.5 pr-4 text-right text-gray-600">{r.nelk_pct_flank}%</td>
                    <td className="py-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                        mappability artefact
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Each region shows similarly low coverage in NELK (28.7× mean depth), confirming the signal is a
            reference assembly mappability issue rather than a true copy-number variant.
          </p>
        </div>
      )}

      {/* Coverage profiles */}
      <CnvCoverage samplePath={samplePath} />
    </div>
  );
}
