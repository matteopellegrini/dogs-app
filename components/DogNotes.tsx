'use client';

import { useEffect, useRef, useState } from 'react';

interface Dog {
  id: number;
  name: string;
  breed?: string;
  dob?: string;
  notes?: string;
}

const SECTIONS = [
  { key: 'general',      label: 'General Info',       placeholder: 'Describe your dog — temperament, personality, daily routine…', icon: '🐾' },
  { key: 'health',       label: 'Health History',      placeholder: 'Past illnesses, surgeries, diagnoses, conditions…', icon: '🏥' },
  { key: 'medications',  label: 'Current Medications', placeholder: 'Medications, dosages, frequency, prescribing vet…', icon: '💊' },
  { key: 'vaccinations', label: 'Vaccinations',        placeholder: 'Vaccine name, date, next due date, batch number…', icon: '💉' },
  { key: 'vet',          label: 'Vet & Contacts',      placeholder: 'Vet clinic name, phone, address, emergency contacts…', icon: '👨‍⚕️' },
  { key: 'diet',         label: 'Diet & Nutrition',    placeholder: 'Food brand, portion size, feeding schedule, allergies…', icon: '🥣' },
  { key: 'other',        label: 'Other Notes',         placeholder: 'Behavioural notes, grooming schedule, breeder info, pedigree…', icon: '📋' },
];

type NoteMap = Record<string, string>;

function parseNotes(raw: string | undefined): NoteMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed as NoteMap;
  } catch {
    return { general: raw };
  }
  return {};
}

export default function DogNotes({ dog }: { dog: Dog | null }) {
  const [notes, setNotes] = useState<NoteMap>({});
  const [activeSection, setActiveSection] = useState('general');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(parseNotes(dog?.notes));
    setSaveState('idle');
  }, [dog?.id, dog?.notes]);

  function handleChange(value: string) {
    const updated = { ...notes, [activeSection]: value };
    setNotes(updated);
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(updated), 1200);
  }

  async function save(current: NoteMap) {
    if (!dog) return;
    try {
      const res = await fetch(`/api/dogs/${dog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: JSON.stringify(current) }),
      });
      setSaveState(res.ok ? 'saved' : 'error');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
    }
  }

  if (!dog) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm space-y-2">
        <p className="text-2xl">🐾</p>
        <p>No dog selected. Add a dog in the sidebar to keep health notes.</p>
      </div>
    );
  }

  const section = SECTIONS.find(s => s.key === activeSection)!;
  const wordCount = (notes[activeSection] ?? '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Dog header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-[#C4F9FF]/40 rounded-full flex items-center justify-center text-2xl">🐕</div>
        <div>
          <p className="font-semibold text-gray-800">{dog.name}</p>
          <p className="text-xs text-gray-400">
            {dog.breed && <span>{dog.breed}</span>}
            {dog.breed && dog.dob && <span> · </span>}
            {dog.dob && <span>Born {dog.dob}</span>}
          </p>
        </div>
        <div className="ml-auto text-xs">
          {saveState === 'saving' && <span className="text-gray-400">Saving…</span>}
          {saveState === 'saved'  && <span className="text-green-600">✓ Saved</span>}
          {saveState === 'error'  && <span className="text-red-600">Save failed</span>}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Section sidebar */}
        <div className="w-40 shrink-0 space-y-0.5">
          {SECTIONS.map(s => {
            const hasContent = (notes[s.key] ?? '').trim().length > 0;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeSection === s.key ? 'bg-[#C4F9FF]/20 text-[#3540CA]' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{s.icon}</span>
                <span className="flex-1 truncate">{s.label}</span>
                {hasContent && <span className="w-1.5 h-1.5 rounded-full bg-[#3540CA] shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Text area */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{section.icon}</span>
            <span className="text-sm font-medium text-gray-700">{section.label}</span>
          </div>
          <textarea
            className="flex-1 min-h-64 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#3540CA]/30 focus:border-[#3540CA]/40"
            placeholder={section.placeholder}
            value={notes[activeSection] ?? ''}
            onChange={e => handleChange(e.target.value)}
          />
          <p className="text-[10px] text-gray-400 mt-1 text-right">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · auto-saved
          </p>
        </div>
      </div>
    </div>
  );
}
