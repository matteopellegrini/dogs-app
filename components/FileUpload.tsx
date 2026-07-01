'use client';

import { useState, useRef } from 'react';

interface FileUploadProps {
  sample: string;
  onUploadComplete: () => void;
}

export default function FileUpload({ sample, onUploadComplete }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ fileType?: string; error?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('sample', sample);

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setResult({ error: data.error });
    } else {
      setResult({ fileType: data.fileType });
      onUploadComplete();
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-[#3540CA]/60 bg-[#C4F9FF]/20' : 'border-gray-300 hover:border-[#3540CA]/40 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploading ? (
          <div className="text-[#3540CA]">
            <div className="animate-spin text-3xl mb-2">⏳</div>
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm font-medium text-gray-700">Drop a PDF here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">.pdf</p>
          </>
        )}
      </div>

      {result?.error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
          {result.error}
        </div>
      )}
      {result?.fileType === 'pdf' && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
          ✓ PDF uploaded successfully
        </div>
      )}
    </div>
  );
}
