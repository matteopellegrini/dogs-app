'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
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
  HIGH:     'bg-red-100 text-red-700',
  MODERATE: 'bg-orange-100 text-orange-700',
  LOW:      'bg-yellow-100 text-yellow-700',
  MODIFIER: 'bg-gray-100 text-gray-500',
};

const NAV_ITEMS = [
  { key: 'upload',     label: 'Upload Data',       icon: '📤' },
  { key: 'data',       label: 'Variant Summary',    icon: '📊' },
  { key: 'coverage',   label: 'Coverage',           icon: '📉' },
  { key: 'cnv',        label: 'Copy Number',        icon: '🗺' },
  { key: 'breed',      label: 'Breed',              icon: '🐕' },
  { key: 'inbreeding', label: 'Inbreeding',         icon: '🔗' },
  { key: 'omia',       label: 'OMIA Diseases',      icon: '🏥' },
  { key: 'prs',        label: 'Trait Scores',       icon: '📈' },
  { key: 'qc',         label: 'Data Quality',       icon: '🔬' },
  { key: 'notes',      label: 'Health Notes',       icon: '📝' },
  { key: 'chat',       label: 'AI Assistant',       icon: '💬' },
] as const;

type TabKey = typeof NAV_ITEMS[number]['key'];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('upload');
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <Image src="/prosper-k9-logo.png" alt="Prosper K9" width={180} height={80} className="opacity-80" />
      </div>
    );
  }

  const hasData = (summary?.total ?? 0) > 0 || genes.length > 0 || zygVariants.length > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f4f4f8' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{ background: '#0E1B05' }} className="px-6 py-3 flex items-center justify-between shrink-0">
        <Image src="/prosper-k9-logo.png" alt="Prosper K9" width={140} height={60} priority />
        <div className="flex items-center gap-5">
          <span className="text-sm font-medium" style={{ color: '#C4F9FF' }}>{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors hover:bg-white/10"
            style={{ color: '#C4F9FF', borderColor: '#C4F9FF55' }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col overflow-y-auto" style={{ background: '#0E1B05' }}>

          {/* Nav */}
          <nav className="flex-1 py-3">
            {NAV_ITEMS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="w-full text-left flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all"
                style={
                  tab === key
                    ? { background: '#3540CA', color: '#ffffff' }
                    : { color: '#C4F9FFaa' }
                }
                onMouseEnter={e => { if (tab !== key) (e.currentTarget as HTMLButtonElement).style.color = '#C4F9FF'; }}
                onMouseLeave={e => { if (tab !== key) (e.currentTarget as HTMLButtonElement).style.color = '#C4F9FFaa'; }}
              >
                <span className="text-base w-5 shrink-0 text-center">{icon}</span>
                <span>{label}</span>
                {tab === key && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-light shrink-0"
                    style={{ background: '#C4F9FF' }} />
                )}
              </button>
            ))}
          </nav>

          {/* Dogs section */}
          <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: '#ffffff15' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C4F9FF88' }}>Dogs</p>
              <button
                onClick={() => setShowAddDog(!showAddDog)}
                className="text-xs font-medium px-2 py-0.5 rounded transition-colors hover:bg-white/10"
                style={{ color: '#C4F9FF' }}
              >
                + Add
              </button>
            </div>
            {showAddDog && (
              <div className="space-y-1.5">
                <input
                  placeholder="Name *"
                  value={newDog.name}
                  onChange={e => setNewDog({ ...newDog, name: e.target.value })}
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-brand-light"
                />
                <input
                  placeholder="Breed"
                  value={newDog.breed}
                  onChange={e => setNewDog({ ...newDog, breed: e.target.value })}
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-brand-light"
                />
                <button
                  onClick={addDog}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: '#3540CA', color: '#ffffff' }}
                >
                  Save
                </button>
              </div>
            )}
            {dogs.length === 0
              ? <p className="text-xs" style={{ color: '#C4F9FF55' }}>No dogs added yet</p>
              : dogs.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-sm" style={{ color: '#C4F9FFcc' }}>
                    <span>🐾</span>
                    <span className="font-medium truncate">{d.name}</span>
                    {d.breed && <span className="text-xs truncate" style={{ color: '#C4F9FF55' }}>· {d.breed}</span>}
                  </div>
                ))
            }
          </div>

          {/* Quick stats */}
          {(genes.length > 0 || (summary && summary.total > 0)) && (
            <div className="border-t px-5 py-4" style={{ borderColor: '#ffffff15' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#C4F9FF88' }}>Data</p>
              {genes.length > 0 && (
                <>
                  <p className="text-2xl font-bold mb-0.5" style={{ color: '#C4F9FF' }}>{genes.length.toLocaleString()}</p>
                  <p className="text-xs mb-2" style={{ color: '#C4F9FF55' }}>genes with variants</p>
                  {(['HIGH', 'MODERATE', 'LOW'] as const).map(imp => {
                    const count = genes.reduce((s, g) => s + (g[`impact_${imp.toLowerCase() as 'high'|'moderate'|'low'}`] ?? 0), 0);
                    return count > 0 ? (
                      <div key={imp} className="flex items-center justify-between mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${IMPACT_COLORS[imp]}`}>{imp}</span>
                        <span className="text-xs" style={{ color: '#C4F9FF88' }}>{count.toLocaleString()}</span>
                      </div>
                    ) : null;
                  })}
                </>
              )}
            </div>
          )}
        </aside>

        {/* ── Main content ──────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">

            {/* Content card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* Tab title bar */}
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold" style={{ color: '#0E1B05', fontFamily: 'Montserrat, sans-serif' }}>
                  {NAV_ITEMS.find(n => n.key === tab)?.icon}{' '}
                  {NAV_ITEMS.find(n => n.key === tab)?.label}
                </h2>
              </div>

              <div className="p-6">

                {/* ── Upload ── */}
                {tab === 'upload' && (
                  <div>
                    <p className="text-sm text-gray-500 mb-6">Upload VCF files annotated with SNPEff, or SNPEff summary gene files.</p>
                    <FileUpload dogs={dogs} onUploadComplete={() => { refreshData(); setTab('data'); }} />
                    {uploads.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Uploaded Files</h3>
                        <div className="space-y-2">
                          {uploads.map(u => (
                            <div key={u.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors">
                              <div>
                                <p className="text-sm font-medium text-gray-700">{u.original_name}</p>
                                <p className="text-xs text-gray-400">
                                  {u.variant_count > 0 && `${u.variant_count.toLocaleString()} variants · `}
                                  {u.dog_name && `${u.dog_name} · `}
                                  {new Date(u.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium uppercase"
                                style={{ background: '#C4F9FF', color: '#3540CA' }}>
                                {u.file_type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Variant data ── */}
                {tab === 'data' && (
                  <div>
                    {!hasData ? (
                      <p className="text-sm text-gray-400 mt-4">No data yet. Upload a SNPEff .genes.txt file to see results.</p>
                    ) : (
                      <>
                        {zygVariants.length > 0 && (
                          <>
                            <p className="text-sm text-gray-500 mb-4">
                              {zygVariants.filter(v => v.impact === 'HIGH').length} HIGH · {zygVariants.filter(v => v.impact === 'MODERATE').length} MODERATE impact variants with zygosity.
                            </p>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">HIGH Impact — Homozygous</h3>
                            <div className="overflow-x-auto mb-6">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 text-gray-400">
                                    <th className="text-left py-2 pr-3 font-medium">Gene</th>
                                    <th className="text-left py-2 pr-3 font-medium">Effect</th>
                                    <th className="text-left py-2 pr-3 font-medium">Zygosity</th>
                                    <th className="text-left py-2 pr-3 font-medium">HGVS</th>
                                    <th className="text-left py-2 pr-3 font-medium">Position</th>
                                    <th className="text-right py-2 font-medium">Depth</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {zygVariants.filter(v => v.impact === 'HIGH').slice(0, 50).map((v, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="py-1.5 pr-3 font-semibold text-gray-800">{v.gene}</td>
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
                            <p className="text-sm text-gray-500 mb-4">{genes.length.toLocaleString()} genes with variants from SNPEff analysis.</p>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">HIGH Impact Genes</h3>
                            <div className="overflow-x-auto mb-6">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 text-gray-400">
                                    {['Gene','Biotype','HIGH','MOD','Frameshift','Stop','Missense'].map(h => (
                                      <th key={h} className={`py-2 pr-3 font-medium ${h === 'Missense' ? 'text-right' : h === 'Gene' || h === 'Biotype' ? 'text-left' : 'text-right'}`}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {genes.filter(g => g.impact_high > 0).slice(0, 30).map((g, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="py-1.5 pr-3 font-semibold text-gray-800">{g.gene_name || g.gene_id}</td>
                                      <td className="py-1.5 pr-3 text-gray-400">{g.biotype}</td>
                                      <td className="py-1.5 pr-3 text-right"><span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">{g.impact_high}</span></td>
                                      <td className="py-1.5 pr-3 text-right text-orange-600">{g.impact_moderate || '—'}</td>
                                      <td className="py-1.5 pr-3 text-right text-gray-500">{g.effect_frameshift || '—'}</td>
                                      <td className="py-1.5 pr-3 text-right text-gray-500">{(g.effect_stop_gained + g.effect_stop_lost) || '—'}</td>
                                      <td className="py-1.5 text-right text-gray-500">{g.effect_missense || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                        {summary && summary.total > 0 && (
                          <div className="mt-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">VCF Impact Breakdown</h3>
                            <div className="space-y-2">
                              {summary.byImpact.map(r => {
                                const pct = Math.round((r.count / summary.total) * 100);
                                return (
                                  <div key={r.impact}>
                                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                                      <span className="font-medium">{r.impact || 'UNKNOWN'}</span>
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

                {tab === 'coverage'   && <CoverageChart />}
                {tab === 'cnv'        && <CnvTable />}
                {tab === 'breed'      && <BreedChart />}
                {tab === 'inbreeding' && <InbreedingPanel />}
                {tab === 'omia'       && <OmiaTable />}
                {tab === 'prs'        && <PrsPanel />}
                {tab === 'qc'         && <QcPanel />}
                {tab === 'notes'      && <DogNotes dogs={dogs} />}

              </div>

              {tab === 'chat' && <ChatInterface hasData={hasData} />}
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}
