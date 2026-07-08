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
import MicrobiomePanel from '@/components/MicrobiomePanel';
import DogNotes from '@/components/DogNotes';
import FunctionalVariants from '@/components/FunctionalVariants';
import CoatColorPanel from '@/components/CoatColorPanel';

interface Upload {
  id: number;
  original_name: string;
  file_type: string;
  created_at: string;
  sample?: string;
  parsed_text?: string;
}


interface Dog {
  id: number;
  name: string;
  breed?: string;
}


const ChromosomeIcon = ({ color = 'currentColor' }: { color?: string }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Left chromatid — top arm */}
    <path d="M4.5 2 C4.5 2 5.5 3 5.5 5.5 C5.5 7.5 4 8.5 4 10 C4 11.5 5.5 12.5 5.5 14.5 C5.5 17 4.5 18 4.5 18"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    {/* Right chromatid */}
    <path d="M8.5 2 C8.5 2 7.5 3 7.5 5.5 C7.5 7.5 9 8.5 9 10 C9 11.5 7.5 12.5 7.5 14.5 C7.5 17 8.5 18 8.5 18"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    {/* Centromere bridge top */}
    <path d="M4.5 8.8 C5 9 7.5 9 8.5 8.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    {/* Centromere bridge bottom */}
    <path d="M4.5 11.2 C5 11 7.5 11 8.5 11.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    {/* Centromere fill region */}
    <ellipse cx="6.5" cy="10" rx="2.2" ry="1.4" fill={color} opacity="0.25"/>
  </svg>
);

const CUSTOM_ICONS: Partial<Record<string, React.ReactNode>> = {
  coverage: <ChromosomeIcon />,
};

const NAV_ITEMS = [
  { key: 'breed',      label: 'Breed',              icon: '🐩' },
  { key: 'coverage',   label: 'Karyotype',          icon: '📊' },
  { key: 'cnv',        label: 'Copy Number',        icon: '🔢' },
  { key: 'data',       label: 'Private Variants',   icon: '🔍' },
  { key: 'omia',       label: 'Known Variants',     icon: '💊' },
  { key: 'coat',       label: 'Coat Color',         icon: '🎨' },
  { key: 'prs',        label: 'Trait Scores',       icon: '🌡️' },
  { key: 'inbreeding', label: 'Inbreeding',         icon: '👪' },
  { key: 'microbiome', label: 'Microbiome',         icon: '🦠' },
  { key: 'qc',         label: 'Data Quality',       icon: '✅' },
  { key: 'notes',      label: 'Health Notes',       icon: '🩺' },
  { key: 'upload',     label: 'Upload Data',        icon: '📤' },
  { key: 'chat',       label: 'AI Assistant',       icon: '🤖' },
] as const;

type TabKey = typeof NAV_ITEMS[number]['key'];

const SAMPLES = [
  { id: 'nelk', label: 'NELK (Jamthund)', path: '' },
  { id: 'cosmo', label: 'Cosmo', path: '/cosmo' },
];

interface LabRow { test: string; value: string; refRange: string; units: string; flags: string; prev: string[]; }
interface LabSection { name: string; dates: string[]; rows: LabRow[]; }

function parseLabReport(text: string): LabSection[] {
  const SECTIONS = ['Hematology', 'Chemistry', 'Urinalysis', 'Endocrinology', 'Serology'];
  const UNITS_RE = /^(M\/µL|K\/µL|g\/dL|g\/L|µg\/dL|mg\/dL|mmol\/L|U\/L|fL|pg|%|IU\/L|mEq\/L|HPF|\/HPF|ng\/mL|pmol\/L)$/;
  const FLAG_RE = /^[HLN]$/;
  const NUM_RE = /^-?\d+[\.,]?\d*$|^>\d|^<\d/;
  // Tokens that indicate boilerplate / header content to skip
  const SKIP_STARTS = new Set(['Generated', '©', 'Page', 'Key:', 'View', 'This', 'Dogs', 'For', 'If', 'a', 'b', 'c']);

  const tokens = text.split(/\s+/).filter(t => t.length > 0);
  const sections: LabSection[] = [];
  let cur: LabSection | null = null;
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];

    // Section header
    if (SECTIONS.includes(tok)) {
      cur = { name: tok, dates: [], rows: [] };
      sections.push(cur);
      i++;
      if (tokens[i] === '(continued)') i++;
      // Skip the date header that follows each section opener: skip until we see a word that could be a test name
      // Date headers look like: "4/9/26 (Order Received) 7/7/25 ..."
      while (i < tokens.length && (
        /^\d+\/\d+\/\d+$/.test(tokens[i]) ||
        /^\d+:\d+$/.test(tokens[i]) ||
        tokens[i] === '(Order' || tokens[i] === 'Received)' ||
        tokens[i] === '(Last' || tokens[i] === 'Updated)' ||
        tokens[i] === 'AM' || tokens[i] === 'PM'
      )) i++;
      continue;
    }

    if (!cur) { i++; continue; }

    // Skip boilerplate tokens
    const BOILERPLATE = new Set([
      'by','April','March','January','February','May','June','July','August',
      'September','October','November','December','VetConnect','®','PLUS','IDEXX',
      'Laboratories,','Inc.','All','rights','reserved.','US','D1072841','S.',
      'interval','meaningfully','different','from','of','AM','PM',
      '1','888','433-9987','13,','2026','2025','2024','6','Page',
    ]);
    if (
      SKIP_STARTS.has(tok) || BOILERPLATE.has(tok) ||
      /^\d+\/\d+\/\d+$/.test(tok) ||   // dates like 4/9/26
      /^\d+:\d+$/.test(tok) ||          // times like 08:45
      /^\d{4}$/.test(tok)               // years like 2025
    ) {
      i++;
      continue;
    }

    // Try to collect test name (one or more Title-Case words, may include colons, hyphens)
    const nameTokens: string[] = [];
    let j = i;
    while (j < tokens.length && !NUM_RE.test(tokens[j]) && !SECTIONS.includes(tokens[j])) {
      const t = tokens[j];
      // Stop if we hit a unit or flag already having a name
      if (nameTokens.length > 0 && (UNITS_RE.test(t) || FLAG_RE.test(t))) break;
      // Skip footnote single-letter suffixes
      if (nameTokens.length > 0 && /^[a-z]$/.test(t)) { j++; continue; }
      // Stop if we hit a date-like token
      if (/^\d+\/\d+\/\d+$/.test(t)) break;
      nameTokens.push(t);
      j++;
    }

    // Must end with a numeric value
    if (nameTokens.length === 0 || !NUM_RE.test(tokens[j])) { i++; continue; }

    const testName = nameTokens.join(' ');
    const value = tokens[j++];
    let refRange = '';
    let units = '';
    const flags: string[] = [];
    const prev: string[] = [];

    // Reference range: num - num
    if (j + 2 < tokens.length && NUM_RE.test(tokens[j]) && tokens[j + 1] === '-' && NUM_RE.test(tokens[j + 2])) {
      refRange = `${tokens[j]} – ${tokens[j + 2]}`;
      j += 3;
    } else if (j + 2 < tokens.length && tokens[j] === '0' && tokens[j + 1] === '-' && NUM_RE.test(tokens[j + 2])) {
      refRange = `0 – ${tokens[j + 2]}`;
      j += 3;
    }

    // Units
    if (j < tokens.length && UNITS_RE.test(tokens[j])) units = tokens[j++];

    // Flags and up to 3 previous values
    while (j < tokens.length && prev.length < 3 && !SECTIONS.includes(tokens[j])) {
      const t = tokens[j];
      if (FLAG_RE.test(t)) { flags.push(t); j++; }
      else if (NUM_RE.test(t)) { prev.push(t); j++; }
      else break;
    }

    cur.rows.push({ test: testName, value, refRange, units, flags: flags.join(' '), prev });
    i = j;
  }

  return sections.filter(s => s.rows.length > 0);
}

function ParsedPdfTable({ text }: { text: string }) {
  const sections = parseLabReport(text);

  if (sections.length > 0) {
    return (
      <div className="border border-gray-100 border-t-0 rounded-b-xl max-h-[70vh] overflow-y-auto">
        {sections.map((sec, si) => (
          <div key={si}>
            <div className="px-3 py-1.5 bg-[#C4F9FF]/20 border-b border-[#C4F9FF]/40 text-[10px] font-semibold text-[#3540CA] uppercase tracking-wide sticky top-0">
              {sec.name}
            </div>
            <div className="divide-y divide-gray-50">
              {sec.rows.map((row, ri) => {
                const isHigh = row.flags.includes('H');
                const isLow = row.flags.includes('L');
                return (
                  <div key={ri} className="flex items-center px-3 py-1.5 hover:bg-gray-50 gap-2">
                    <span className="flex-1 text-xs text-gray-700 font-medium">{row.test}</span>
                    <span className={`text-xs font-mono font-semibold shrink-0 ${isHigh ? 'text-red-600' : isLow ? 'text-blue-600' : 'text-gray-800'}`}>
                      {row.value}
                    </span>
                    {(isHigh || isLow) && (
                      <span className={`text-[9px] font-bold px-1 rounded shrink-0 ${isHigh ? 'text-red-500 bg-red-50' : 'text-blue-500 bg-blue-50'}`}>
                        {isHigh ? 'H' : 'L'}
                      </span>
                    )}
                    {row.units && <span className="text-[10px] text-gray-400 shrink-0">{row.units}</span>}
                    {row.refRange && <span className="text-[10px] text-gray-300 font-mono shrink-0 hidden sm:inline">({row.refRange})</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
                <span className="text-base w-5 shrink-0 text-center flex items-center justify-center">
                  {CUSTOM_ICONS[key] ?? icon}
                </span>
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

        </aside>

        {/* ── Main content ──────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">

            {/* Content card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* Tab title bar */}
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold" style={{ color: '#0E1B05', fontFamily: 'Montserrat, sans-serif' }}>
                  <span className="inline-flex items-center gap-1.5">
                    {CUSTOM_ICONS[tab] ?? NAV_ITEMS.find(n => n.key === tab)?.icon}{' '}
                    {NAV_ITEMS.find(n => n.key === tab)?.label}
                  </span>
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
                    <FunctionalVariants samplePath={samplePath} />
                  </div>
                )}

                {tab === 'coverage'   && <CoverageChart samplePath={samplePath} />}
                {tab === 'cnv'        && <CnvTable samplePath={samplePath} />}
                {tab === 'breed'      && <BreedChart samplePath={samplePath} />}
                {tab === 'inbreeding' && <InbreedingPanel samplePath={samplePath} />}
                {tab === 'omia'       && <OmiaTable samplePath={samplePath} />}
                {tab === 'coat'       && <CoatColorPanel samplePath={samplePath} />}
                {tab === 'prs'        && <PrsPanel samplePath={samplePath} />}
                {tab === 'qc'         && <QcPanel samplePath={samplePath} />}
                {tab === 'microbiome' && <MicrobiomePanel samplePath={samplePath} />}
                {tab === 'notes'      && <DogNotes dogs={dogs} sample={activeSample} />}

              </div>

              {tab === 'chat' && <ChatInterface hasData={true} sample={activeSample} samplePath={samplePath} />}
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}
