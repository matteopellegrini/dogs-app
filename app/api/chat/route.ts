import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { getDb, getVariantSummaryForUser, getGeneSummaryForUser, getZygosityVariantsForUser } from '@/lib/db';
import { buildGenomicContext, buildGeneContext, buildZygosityContext } from '@/lib/vcf-parser';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(session.user.email) as
    | { id: number; name: string }
    | undefined;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { messages, samplePath = '' } = await req.json();
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
  }

  function publicPath(...segments: string[]) {
    const parts = samplePath ? samplePath.split('/').filter(Boolean) : [];
    return path.join(process.cwd(), 'public', ...parts, ...segments);
  }

  const variantSummary = getVariantSummaryForUser(user.id);
  const genes = getGeneSummaryForUser(user.id);
  const zygVariants = getZygosityVariantsForUser(user.id);

  let genomicContext = '';
  if (zygVariants.length > 0) {
    genomicContext += buildZygosityContext(zygVariants) + '\n\n';
  }
  if (genes.length > 0) {
    genomicContext += buildGeneContext(genes) + '\n\n';
  }
  if (variantSummary.total > 0) {
    genomicContext += buildGenomicContext(variantSummary);
  }
  // Append breed composition result
  try {
    const breedPath = publicPath('breed_result.json');
    if (fs.existsSync(breedPath)) {
      const breed = JSON.parse(fs.readFileSync(breedPath, 'utf-8'));
      const comp = (breed.breed_composition as {breed:string;proportion:number}[])
        .map((b) => `${b.breed} ${(b.proportion*100).toFixed(1)}%`)
        .join(', ');
      genomicContext += `\n\n=== BREED COMPOSITION (ADMIXTURE K=10) ===\n`;
      genomicContext += `Method: ${breed.method} · CV error ${breed.cv_error}\n`;
      genomicContext += `Reference: ${breed.reference_panel}\n`;
      genomicContext += `Ancestry: ${comp}\n`;
      genomicContext += `Note: these are ancestry components, not necessarily direct parental breeds.\n`;
    }
  } catch { /* optional */ }

  // Append inbreeding coefficient
  try {
    const ibPath = publicPath('inbreeding_result.json');
    if (fs.existsSync(ibPath)) {
      const ib = JSON.parse(fs.readFileSync(ibPath, 'utf-8'));
      genomicContext += `\n\n=== INBREEDING COEFFICIENT ===\n`;
      genomicContext += `F_ROH = ${ib.f_roh} (${ib.f_roh_pct}%) — ${ib.level.replace('_',' ')} inbreeding\n`;
      genomicContext += `ROH segments: ${ib.n_roh} · Total ROH: ${ib.total_roh_mb} Mb · Avg ROH: ${ib.avg_roh_mb} Mb\n`;
      genomicContext += `Interpretation: ${ib.interpretation}\n`;
    }
  } catch { /* optional */ }

  // Append OMIA exact variant matches
  try {
    const omiaPath = publicPath('omia_result.json');
    if (fs.existsSync(omiaPath)) {
      const omia = JSON.parse(fs.readFileSync(omiaPath, 'utf-8'));
      genomicContext += `\n\n=== OMIA VARIANT EXACT MATCH ANALYSIS ===\n`;
      genomicContext += `${omia.summary.omia_variants_with_coordinates} OMIA dog variants screened (with canFam4 coordinates).\n`;
      genomicContext += `Allele matches found: ${omia.summary.allele_matches_found} (genotyped directly from BAM at ${omia.summary.omia_variants_screened} OMIA sites)\n`;
      if (omia.matches.length === 0) {
        genomicContext += `No known OMIA pathogenic variants detected.\n`;
      } else {
        for (const m of omia.matches as {gene:string;chrom:string;pos:number;ref:string;alt:string;zygosity:string;depth:number;hgvs_c:string;hgvs_p:string;phene_name:string;deleterious:string;clinical_note:string}[]) {
          genomicContext += `  ${m.gene} ${m.chrom}:${m.pos} ${m.ref}>${m.alt} ${m.hgvs_c} ${m.hgvs_p} | ${m.zygosity} (DP=${m.depth}) | trait: ${m.phene_name || 'none'} | deleterious: ${m.deleterious}\n`;
          if (m.clinical_note) genomicContext += `    Note: ${m.clinical_note}\n`;
        }
      }
    }
  } catch { /* optional */ }

  // Append PRS polygenic trait scores
  try {
    const prsPath = publicPath('prs_result.json');
    if (fs.existsSync(prsPath)) {
      const prs = JSON.parse(fs.readFileSync(prsPath, 'utf-8'));
      genomicContext += `\n\n=== POLYGENIC TRAIT SCORES (PRS) ===\n`;
      genomicContext += `Method: ${prs.method}\n`;
      for (const [trait, res] of Object.entries(prs.traits as Record<string, {prs_z: number; percentile: number; predicted_score: number; nelk_akc_score: number | null}>)) {
        genomicContext += `  ${trait}: predicted=${res.predicted_score.toFixed(1)}/5, percentile=${res.percentile}th, z=${res.prs_z > 0 ? '+' : ''}${res.prs_z.toFixed(2)} (AKC NELK ref=${res.nelk_akc_score ?? 'N/A'})\n`;
      }
      if (prs.physical_traits) {
        const pt = prs.physical_traits as Record<string, {pred_cm?: number; pred_kg?: number; pred_lbs?: number; predicted?: string; percentile: number}>;
        if (pt.height_cm) genomicContext += `  Height: ${pt.height_cm.pred_cm} cm (${pt.height_cm.percentile}th pct)\n`;
        if (pt.weight_kg) genomicContext += `  Weight: ${pt.weight_kg.pred_kg} kg / ${pt.weight_kg.pred_lbs} lbs (${pt.weight_kg.percentile}th pct)\n`;
        if (pt.coat_type) genomicContext += `  Coat type: ${pt.coat_type.predicted} (${pt.coat_type.percentile}th pct)\n`;
        if (pt.coat_length) genomicContext += `  Coat length: ${pt.coat_length.predicted} (${pt.coat_length.percentile}th pct)\n`;
      }
    }
  } catch { /* optional */ }

  // Append CNV homozygous deletion data from static analysis
  try {
    const cnvPath = publicPath('cnv_homdel.json');
    if (fs.existsSync(cnvPath)) {
      const cnv = JSON.parse(fs.readFileSync(cnvPath, 'utf-8'));
      const pcGenes = (cnv.disrupted_genes as {gene:string;biotype:string;chrom:string;start:number;size:string}[])
        .filter((g) => g.biotype === 'protein_coding')
        .map((g) => `${g.gene} (${g.chrom}:${(g.start/1e6).toFixed(1)}Mb, ${g.size})`)
        .join(', ');
      genomicContext += `\n\n=== COPY NUMBER VARIANT ANALYSIS — HOMOZYGOUS DELETIONS ===\n`;
      genomicContext += `Called at 10kb resolution (depth <15% of genome mean 28.7x, regions ≥20kb).\n`;
      genomicContext += `Total deletion regions: ${cnv.summary.total_regions}\n`;
      genomicContext += `Disrupted protein-coding genes (${cnv.summary.protein_coding}): ${pcGenes}\n`;
    }
  } catch { /* CNV file optional */ }

  // Append uploaded lab report text (PDFs parsed from Upload Data tab)
  try {
    const uploads = db.prepare(
      `SELECT original_name, parsed_text, created_at FROM uploads
       WHERE user_id = ? AND parsed_text IS NOT NULL AND sample = ?
       ORDER BY created_at DESC LIMIT 5`
    ).all(user.id, samplePath.replace(/^\//, '')) as { original_name: string; parsed_text: string; created_at: string }[];
    if (uploads.length > 0) {
      genomicContext += `\n\n=== UPLOADED LAB REPORTS ===\n`;
      for (const u of uploads) {
        const date = new Date(u.created_at).toLocaleDateString();
        genomicContext += `\n--- ${u.original_name} (uploaded ${date}) ---\n`;
        // Include up to 4000 chars per document to keep context manageable
        genomicContext += u.parsed_text.slice(0, 4000);
        if (u.parsed_text.length > 4000) genomicContext += '\n[...truncated]';
        genomicContext += '\n';
      }
    }
  } catch { /* optional */ }

  if (!genomicContext) {
    genomicContext = 'No genomic data has been uploaded yet for this user.';
  }

  const systemPrompt = `You are a veterinary genomics assistant helping interpret dog genetic data.
You have access to the following genomic data uploaded by ${user.name}:

${genomicContext}

Guidelines:
- Interpret variant impacts in the context of canine health and disease
- HIGH impact variants (stop gained, frameshift, splice site) are most clinically significant
- MODERATE impact variants (missense) may affect protein function
- Refer to specific genes and chromosomal positions from the data when relevant
- Always recommend consulting a veterinary specialist or veterinary geneticist for clinical decisions
- You can explain variant effects, affected genes, and potential health implications
- Be clear about the limits of genomic interpretation without clinical context`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        });

        for await (const chunk of response) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
