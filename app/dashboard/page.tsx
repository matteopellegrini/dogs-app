'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import CoverageChart from '@/components/CoverageChart';
import CnvTable from '@/components/CnvTable';
import BreedChart from '@/components/BreedChart';
import OmiaTable from '@/components/OmiaTable';
import InbreedingPanel from '@/components/InbreedingPanel';
import PrsPanel from '@/components/PrsPanel';
import QcPanel from '@/components/QcPanel';
import DogNotes from '@/components/DogNotes';

interface Upload {
  id: number;
  original_name: string;
  file_type: string;
  variant_count: number;
  created_at: string;
  dog_name?: string;
}

interface Summary {
  total: number;
  byImpact: { impact: string; count: number }[];
  topGenes: { gene: string; count: number }[];
}

interface ZygosityVariant {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  gene: string;
  effect: string;
  impact: string;
  zygosity: string;
  hgvs: string;
  depth: number;
}

interface GeneRecord {
  gene_name: string;
  gene_id: string;
  biotype: string;
  impact_high: number;
  impact_moderate: number;
  impact_low: number;
  impact_modifier: number;
  effect_frameshift: number;
  effect_missense: number;
  effect_stop_gained: number;
  effect_stop_lost: number;
  effect_start_lost: number;
  effect_splice_acceptor: number;
  effect_splice_donor: number;
  total_variants: number;
}

interface Dog {
  id: number;
  name: string;
  breed?: string;
}

const IMPACT_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MODERATE: 'bg-orange-100 text-orange-700',
  LOW: 'bg-yellow-100 text-yellow-700',
  MODIFIER: 'bg-gray-100 text-gray-600',
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<'upload' | 'data' | 'coverage' | 'cnv' | 'breed' | 'inbreeding' | 'omia' | 'prs' | 'qc' | 'notes' | 'chat'>('upload');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [genes, setGenes] = useState<GeneRecord[]>([]);
  const [zygVariants, setZygVariants] = useState<ZygosityVariant[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [showAddDog, setShowAddDog] = useState(false);
  const [newDog, setNewDog] = useState({ name: '', breed: '', dob: '', notes: '' });

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      refreshData();
      fetchDogs();
    }
  }, [status]);

  async function refreshData() {
    const res = await fetch('/api/files');
    if (res.ok) {
      const data = await res.json();
      setUploads(data.uploads);
      setSummary(data.summary);
      setGenes(data.genes ?? []);
      setZygVariants(data.zygVariants ?? []);
    }
  }

  async function fetchDogs() {
    const res = await fetch('/api/dogs');
    if (res.ok) setDogs(await res.json());
  }

  async function addDog() {
    if (!newDog.name.trim()) return;
    await fetch('/api/dogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDog),
    });
    setNewDog({ name: '', breed: '', dob: '', notes: '' });
    setShowAddDog(false);
    fetchDogs();
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const hasData = (summary?.total ?? 0) > 0 || genes.length > 0 || zygVariants.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐕</span>
          <span className="font-bold text-gray-800 text-lg">DogGenomics</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 flex gap-6 h-[calc(100vh-73px)]">
        {/* Left sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Nav */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {(['upload', 'data', 'coverage', 'cnv', 'breed', 'inbreeding', 'omia', 'prs', 'qc', 'notes', 'chat'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-b border-gray-100 last:border-0 ${
                  tab === t ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'upload' && '📤 Upload Data'}
                {t === 'data' && '📊 Variant Summary'}
                {t === 'coverage' && '🧬 Coverage'}
                {t === 'cnv' && '🗺 Copy Number'}
                {t === 'breed' && '🐕 Breed'}
                {t === 'inbreeding' && '🧬 Inbreeding'}
                {t === 'omia' && '🏥 OMIA Diseases'}
                {t === 'prs' && '📈 Trait Scores'}
                {t === 'qc' && '🔬 Data Quality'}
                {t === 'notes' && '📝 Health Notes'}
                {t === 'chat' && '💬 AI Assistant'}
              </button>
            ))}
          </div>

          {/* Dogs */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Dogs</h3>
              <button
                onClick={() => setShowAddDog(!showAddDog)}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                + Add
              </button>
            </div>
            {showAddDog && (
              <div className="mb-3 space-y-2">
                <input
                  placeholder="Name *"
                  value={newDog.name}
                  onChange={(e) => setNewDog({ ...newDog, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                />
                <input
                  placeholder="Breed"
                  value={newDog.breed}
                  onChange={(e) => setNewDog({ ...newDog, breed: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                />
                <button
                  onClick={addDog}
                  className="w-full bg-indigo-600 text-white text-xs py-1.5 rounded-lg hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            )}
            {dogs.length === 0 ? (
              <p className="text-xs text-gray-400">No dogs added yet</p>
            ) : (
              dogs.map((d) => (
                <div key={d.id} className="text-sm text-gray-700 py-1">
                  🐾 {d.name} {d.breed && <span className="text-gray-400 text-xs">· {d.breed}</span>}
                </div>
              ))
            )}
          </div>

          {/* Quick stats */}
          {(genes.length > 0 || (summary && summary.total > 0)) && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Summary</h3>
              {genes.length > 0 && (
                <>
                  <p className="text-2xl font-bold text-gray-800">{genes.length.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mb-3">genes with variants</p>
                  <div className="space-y-1">
                    {(['HIGH', 'MODERATE', 'LOW'] as const).map((imp) => {
                      const count = genes.reduce((s, g) => s + (g[`impact_${imp.toLowerCase() as 'high'|'moderate'|'low'}`] ?? 0), 0);
                      return count > 0 ? (
                        <div key={imp} className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_COLORS[imp]}`}>{imp}</span>
                          <span className="text-xs text-gray-500">{count.toLocaleString()}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </>
              )}
              {summary && summary.total > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-lg font-bold text-gray-800">{summary.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">raw variants (VCF)</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          {tab === 'upload' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Upload Genomic Data</h2>
              <p className="text-sm text-gray-500 mb-6">
                Upload VCF files annotated with SNPEff, or SNPEff summary gene files.
              </p>
              <FileUpload
                dogs={dogs}
                onUploadComplete={() => { refreshData(); setTab('data'); }}
              />

              {uploads.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Uploaded Files</h3>
                  <div className="space-y-2">
                    {uploads.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3 bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-700">{u.original_name}</p>
                          <p className="text-xs text-gray-400">
                            {u.variant_count > 0 && `${u.variant_count.toLocaleString()} variants · `}
                            {u.dog_name && `${u.dog_name} · `}
                            {new Date(u.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full uppercase">
                          {u.file_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'data' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Variant Summary</h2>
              {!hasData ? (
                <p className="text-sm text-gray-400 mt-4">No data yet. Upload a SNPEff .genes.txt file to see results.</p>
              ) : (
                <>
                  {zygVariants.length > 0 && (
                    <>
                      <p className="text-sm text-gray-500 mb-4">
                        {zygVariants.filter(v => v.impact === 'HIGH').length} HIGH · {zygVariants.filter(v => v.impact === 'MODERATE').length} MODERATE impact variants with zygosity.
                      </p>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">HIGH Impact — Homozygous</h3>
                      <div className="overflow-x-auto mb-6">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500">
                              <th className="text-left py-2 pr-3">Gene</th>
                              <th className="text-left py-2 pr-3">Effect</th>
                              <th className="text-left py-2 pr-3">Zygosity</th>
                              <th className="text-left py-2 pr-3">HGVS</th>
                              <th className="text-left py-2 pr-3">Position</th>
                              <th className="text-right py-2">Depth</th>
                            </tr>
                          </thead>
                          <tbody>
                            {zygVariants
                              .filter(v => v.impact === 'HIGH')
                              .slice(0, 50)
                              .map((v, i) => (
                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="py-1.5 pr-3 font-medium text-gray-800">{v.gene}</td>
                                  <td className="py-1.5 pr-3 text-gray-600">{v.effect.replace(/_/g, ' ')}</td>
                                  <td className="py-1.5 pr-3">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v.zygosity === 'homozygous' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                      {v.zygosity}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-3 font-mono text-gray-500">{v.hgvs}</td>
                                  <td className="py-1.5 pr-3 text-gray-400">{v.chrom}:{v.pos}</td>
                                  <td className="py-1.5 text-right text-gray-400">{v.depth}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {genes.length > 0 && (
                    <>
                      <p className="text-sm text-gray-500 mb-4">
                        {genes.length.toLocaleString()} genes with variants from SNPEff analysis.
                      </p>

                      <h3 className="text-sm font-semibold text-gray-700 mb-2">HIGH Impact Genes</h3>
                      <div className="overflow-x-auto mb-6">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500">
                              <th className="text-left py-2 pr-4">Gene</th>
                              <th className="text-left py-2 pr-3">Biotype</th>
                              <th className="text-right py-2 pr-3">HIGH</th>
                              <th className="text-right py-2 pr-3">MOD</th>
                              <th className="text-right py-2 pr-3">Frameshift</th>
                              <th className="text-right py-2 pr-3">Stop</th>
                              <th className="text-right py-2">Missense</th>
                            </tr>
                          </thead>
                          <tbody>
                            {genes
                              .filter((g) => g.impact_high > 0)
                              .slice(0, 30)
                              .map((g, i) => (
                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="py-1.5 pr-4 font-medium text-gray-800">{g.gene_name || g.gene_id}</td>
                                  <td className="py-1.5 pr-3 text-gray-400">{g.biotype}</td>
                                  <td className="py-1.5 pr-3 text-right">
                                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">{g.impact_high}</span>
                                  </td>
                                  <td className="py-1.5 pr-3 text-right text-orange-600">{g.impact_moderate || '—'}</td>
                                  <td className="py-1.5 pr-3 text-right text-gray-600">{g.effect_frameshift || '—'}</td>
                                  <td className="py-1.5 pr-3 text-right text-gray-600">{(g.effect_stop_gained + g.effect_stop_lost) || '—'}</td>
                                  <td className="py-1.5 text-right text-gray-600">{g.effect_missense || '—'}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                      <h3 className="text-sm font-semibold text-gray-700 mb-2">MODERATE Impact Genes (top 20)</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {genes
                          .filter((g) => g.impact_high === 0 && g.impact_moderate > 0)
                          .slice(0, 20)
                          .map((g, i) => (
                            <div key={i} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2">
                              <span className="text-sm font-medium text-orange-800">{g.gene_name || g.gene_id}</span>
                              <span className="text-xs text-orange-500">{g.impact_moderate} mod · {g.effect_missense} mis</span>
                            </div>
                          ))}
                      </div>
                    </>
                  )}

                  {summary && summary.total > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">VCF Impact Breakdown</h3>
                      <div className="space-y-2">
                        {summary.byImpact.map((r) => {
                          const pct = Math.round((r.count / summary.total) * 100);
                          return (
                            <div key={r.impact}>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span className={`font-medium ${IMPACT_COLORS[r.impact]?.split(' ')[1] || ''}`}>{r.impact || 'UNKNOWN'}</span>
                                <span>{r.count.toLocaleString()} ({pct}%)</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${r.impact === 'HIGH' ? 'bg-red-400' : r.impact === 'MODERATE' ? 'bg-orange-400' : r.impact === 'LOW' ? 'bg-yellow-400' : 'bg-gray-300'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'coverage' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Sequencing Coverage</h2>
              <CoverageChart />
            </div>
          )}

          {tab === 'cnv' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Copy Number Variants — Homozygous Deletions</h2>
              <CnvTable />
            </div>
          )}

          {tab === 'breed' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Breed Composition</h2>
              <p className="text-sm text-gray-500 mb-4">
                Ancestry inference via ADMIXTURE against the Parker et al. 2017 reference panel (161 breeds).
              </p>
              <BreedChart />
            </div>
          )}

          {tab === 'inbreeding' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Inbreeding Coefficient</h2>
              <p className="text-sm text-gray-500 mb-4">
                Estimated from runs of homozygosity (ROH) across the autosomal genome.
              </p>
              <InbreedingPanel />
            </div>
          )}

          {tab === 'omia' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">OMIA Disease Gene Cross-Reference</h2>
              <p className="text-sm text-gray-500 mb-4">
                Genes with variants in this dog cross-referenced with the Online Mendelian Inheritance in Animals (OMIA) database.
              </p>
              <OmiaTable />
            </div>
          )}

          {tab === 'prs' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Polygenic Trait Scores</h2>
              <p className="text-sm text-gray-500 mb-4">
                Genomic predictions for 14 AKC breed traits using GWAS-based polygenic risk scores from the Parker 2017 reference panel.
              </p>
              <PrsPanel />
            </div>
          )}

          {tab === 'qc' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Sequencing Data Quality</h2>
              <p className="text-sm text-gray-500 mb-4">
                Genome coverage statistics and quality control assessment. Low coverage reduces variant-calling reliability.
              </p>
              <QcPanel />
            </div>
          )}

          {tab === 'notes' && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Health &amp; History Notes</h2>
              <p className="text-sm text-gray-500 mb-4">
                Record your dog&apos;s health history, medications, vaccinations, and other relevant information. Notes are saved automatically.
              </p>
              <DogNotes dogs={dogs} />
            </div>
          )}

          {tab === 'chat' && (
            <ChatInterface hasData={hasData} />
          )}
        </div>
      </div>
    </div>
  );
}
