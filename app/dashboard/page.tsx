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
  created_at: string;
  sample?: string;
  parsed_text?: string;
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
  { key: 'breed',      label: 'Breed',              icon: '🐕' },
  { key: 'coverage',   label: 'Coverage',           icon: '📉' },
  { key: 'cnv',        label: 'Copy Number',        icon: '🗺' },
  { key: 'data',       label: 'Variant Summary',    icon: '📊' },
  { key: 'omia',       label: 'OMIA Diseases',      icon: '🏥' },
  { key: 'prs',        label: 'Trait Scores',       icon: '📈' },
  { key: 'qc',         label: 'Data Quality',       icon: '🔬' },
  { key: 'inbreeding', label: 'Inbreeding',         icon: '🔗' },
  { key: 'notes',      label: 'Health Notes',       icon: '📝' },
  { key: 'upload',     label: 'Upload Data',        icon: '📤' },
  { key: 'chat',       label: 'AI Assistant',       icon: '💬' },
] as const;

type TabKey = typeof NAV_ITEMS[number]['key'];

const SAMPLES = [
  { id: 'nelk', label: 'NELK (Jamthund)', path: '' },
  { id: 'cosmo', label: 'Cosmo', path: '/cosmo' },
];

function ParsedPdfTable({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim());

  // Detect if lines look tabular: split on 2+ spaces or tabs
  const rows = lines.map(l => l.split(/\t|  +/).map(c => c.trim()).filter(c => c));
  const colCounts = rows.map(r => r.length);
  const maxCols = Math.max(...colCounts);
  const isTabular = maxCols >= 2 && rows.filter(r => r.length >= 2).length > rows.length * 0.4;

  if (isTabular) {
    // Use first row as header if it looks like one (all short words, no numbers)
    const firstRow = rows[0];
    const looksLikeHeader = firstRow.every(c => c.length < 40 && !/^\d+\.?\d*$/.test(c));
    const headers = looksLikeHeader ? firstRow : Array.from({ length: maxCols }, (_, i) => `Col ${i + 1}`);
    const dataRows = looksLikeHeader ? rows.slice(1) : rows;

    return (
      <div className="border border-gray-100 border-t-0 rounded-b-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {headers.map((h, i) => (
                <th key={i} className="text-left px-4 py-2 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className="border-b border-gray-50 hover:bg-gray-50">
                {Array.from({ length: headers.length }, (_, ci) => (
                  <td key={ci} className="px-4 py-1.5 text-gray-700 align-top">{row[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback: key-value pairs or plain text
  const kvPairs = lines.map(l => {
    const m = l.match(/^([^:]+):\s*(.*)$/);
    return m ? { key: m[1].trim(), value: m[2].trim() } : null;
  });
  const allKv = kvPairs.every(p => p !== null);

  if (allKv && lines.length > 0) {
    return (
      <div className="border border-gray-100 border-t-0 rounded-b-xl overflow-x-auto">
        <table className="w-full text-xs">
          <tbody>
            {kvPairs.map((kv, i) => kv && (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-1.5 font-semibold text-gray-500 whitespace-nowrap w-1/3">{kv.key}</td>
                <td className="px-4 py-1.5 text-gray-700">{kv.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Plain text fallback
  return (
    <div className="border border-gray-100 border-t-0 rounded-b-xl px-4 py-3 max-h-64 overflow-y-auto">
      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{text}</pre>
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('upload');
  const [activeSample, setActiveSample] = useState('nelk');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [genes, setGenes] = useState<GeneRecord[]>([]);
  const [zygVariants, setZygVariants] = useState<ZygosityVariant[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [showAddDog, setShowAddDog] = useState(false);
  const [newDog, setNewDog] = useState({ name: '', breed: '', dob: '', notes: '' });

  const samplePath = SAMPLES.find(s => s.id === activeSample)?.path ?? '';
  const activeSampleLabel = SAMPLES.find(s => s.id === activeSample)?.label ?? activeSample;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    setSelectedUpload(null);
  }, [activeSample]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Image src="/prosper-k9-logo.png" alt="Prosper K9" width={180} height={80} />
      </div>
    );
  }

  const hasData = (summary?.total ?? 0) > 0 || genes.length > 0 || zygVariants.length > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f4f4f8' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <Image src="/prosper-k9-logo.png" alt="Prosper K9" width={140} height={60} priority />
        <div className="flex items-center gap-4">
          {/* Sample selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {SAMPLES.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSample(s.id)}
                className="text-xs font-medium px-3 py-1.5 rounded-md transition-all"
                style={activeSample === s.id
                  ? { background: '#3540CA', color: '#fff' }
                  : { color: '#6b7280' }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-sm font-medium text-gray-600">{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-300 font-medium text-gray-600 transition-colors hover:border-[#3540CA] hover:text-[#3540CA]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col overflow-y-auto bg-white border-r border-gray-200">

          {/* Nav */}
          <nav className="flex-1 py-3">
            {NAV_ITEMS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="w-full text-left flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all"
                style={
                  tab === key
                    ? { background: '#EEF0FB', color: '#3540CA' }
                    : { color: '#6b7280' }
                }
                onMouseEnter={e => { if (tab !== key) (e.currentTarget as HTMLButtonElement).style.color = '#3540CA'; }}
                onMouseLeave={e => { if (tab !== key) (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
              >
                <span className="text-base w-5 shrink-0 text-center">{icon}</span>
                <span>{label}</span>
                {tab === key && (
                  <span className="ml-auto w-1 h-4 rounded-full shrink-0"
                    style={{ background: '#3540CA' }} />
                )}
              </button>
            ))}
          </nav>

          {/* Dogs section */}
          <div className="border-t border-gray-200 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Dogs</p>
              <button
                onClick={() => setShowAddDog(!showAddDog)}
                className="text-xs font-medium px-2 py-0.5 rounded text-[#3540CA] hover:bg-[#EEF0FB] transition-colors"
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
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-800 placeholder-gray-400 border border-gray-200 focus:outline-none focus:border-[#3540CA]"
                />
                <input
                  placeholder="Breed"
                  value={newDog.breed}
                  onChange={e => setNewDog({ ...newDog, breed: e.target.value })}
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-800 placeholder-gray-400 border border-gray-200 focus:outline-none focus:border-[#3540CA]"
                />
                <button
                  onClick={addDog}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold transition-colors bg-[#3540CA] text-white hover:bg-[#2a34b0]"
                >
                  Save
                </button>
              </div>
            )}
            {dogs.length === 0
              ? <p className="text-xs text-gray-400">No dogs added yet</p>
              : dogs.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span>🐾</span>
                    <span className="font-medium truncate">{d.name}</span>
                    {d.breed && <span className="text-xs truncate text-gray-400">· {d.breed}</span>}
                  </div>
                ))
            }
          </div>

          {/* Quick stats */}
          {(genes.length > 0 || (summary && summary.total > 0)) && (
            <div className="border-t border-gray-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Data</p>
              {genes.length > 0 && (
                <>
                  <p className="text-2xl font-bold mb-0.5 text-[#3540CA]">{genes.length.toLocaleString()}</p>
                  <p className="text-xs mb-2 text-gray-400">genes with variants</p>
                  {(['HIGH', 'MODERATE', 'LOW'] as const).map(imp => {
                    const count = genes.reduce((s, g) => s + (g[`impact_${imp.toLowerCase() as 'high'|'moderate'|'low'}`] ?? 0), 0);
                    return count > 0 ? (
                      <div key={imp} className="flex items-center justify-between mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${IMPACT_COLORS[imp]}`}>{imp}</span>
                        <span className="text-xs text-gray-500">{count.toLocaleString()}</span>
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
                    <p className="text-sm text-gray-500 mb-6">
                      Upload PDF documents for <strong>{activeSampleLabel}</strong> — lab reports, health records, or any supporting files.
                    </p>
                    <FileUpload sample={activeSample} onUploadComplete={refreshData} />
                    {(() => {
                      const sampleUploads = uploads.filter(u => u.sample === activeSample);
                      return sampleUploads.length > 0 ? (
                        <div className="mt-8">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                            Uploaded files
                          </h3>
                          <div className="space-y-2">
                            {sampleUploads.map(u => (
                              <div key={u.id}>
                                <button
                                  onClick={() => setSelectedUpload(selectedUpload?.id === u.id ? null : u)}
                                  className="w-full flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                >
                                  <span className="text-2xl">📄</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">{u.original_name}</p>
                                    <p className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</p>
                                  </div>
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium uppercase shrink-0"
                                    style={{ background: '#C4F9FF', color: '#3540CA' }}>
                                    PDF
                                  </span>
                                  <span className="text-gray-400 text-xs shrink-0">{selectedUpload?.id === u.id ? '▲' : '▼'}</span>
                                </button>
                                {selectedUpload?.id === u.id && u.parsed_text && (
                                  <ParsedPdfTable text={u.parsed_text} />
                                )}
                                {selectedUpload?.id === u.id && !u.parsed_text && (
                                  <div className="border border-gray-100 border-t-0 rounded-b-xl px-4 py-3 text-xs text-gray-400">
                                    No text content could be extracted from this PDF.
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
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

                {tab === 'coverage'   && <CoverageChart samplePath={samplePath} />}
                {tab === 'cnv'        && <CnvTable samplePath={samplePath} />}
                {tab === 'breed'      && <BreedChart samplePath={samplePath} />}
                {tab === 'inbreeding' && <InbreedingPanel samplePath={samplePath} />}
                {tab === 'omia'       && <OmiaTable samplePath={samplePath} />}
                {tab === 'prs'        && <PrsPanel samplePath={samplePath} />}
                {tab === 'qc'         && <QcPanel samplePath={samplePath} />}
                {tab === 'notes'      && <DogNotes dogs={dogs} sample={activeSample} />}

              </div>

              {tab === 'chat' && <ChatInterface hasData={hasData} sample={activeSample} samplePath={samplePath} />}
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}
