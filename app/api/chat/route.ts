import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
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

  let genomicContext = '';

  // Functional variants from GLIMPSE2 imputation + snpEff
  try {
    const fvPath = publicPath('functional_variants.json');
    if (fs.existsSync(fvPath)) {
      const fv = JSON.parse(fs.readFileSync(fvPath, 'utf-8'));
      const s = fv.summary;
      genomicContext += `=== FUNCTIONAL VARIANTS (GLIMPSE2 + snpEff) ===\n`;
      genomicContext += `Source: ${fv.source}\n`;
      genomicContext += `${fv.af_note}\n\n`;
      genomicContext += `HIGH impact: ${s.high_total} total (${s.high_hom_alt} homozygous, ${s.high_het} heterozygous)\n`;
      genomicContext += `  Homozygous rare (AF<5% in Dog10K): ${s.high_hom_rare_5pct} · AF<1%: ${s.high_hom_rare_1pct}\n`;
      if (fv.high_effect_counts) {
        const counts = Object.entries(fv.high_effect_counts as Record<string,number>)
          .map(([k,v]) => `${k.replace(/_/g,' ')} (${v})`).join(', ');
        genomicContext += `  Effect breakdown: ${counts}\n`;
      }
      genomicContext += `MODERATE impact: ${s.moderate_total} total (${s.moderate_hom_alt} homozygous, ${s.moderate_het} heterozygous)\n\n`;

      // Top HIGH-impact homozygous variants sorted by rarity
      const topHigh = (fv.high_variants as {gene:string;chr:string;pos:string;ref:string;alt:string;effect:string;zygosity:string;af_dog10k:number|null}[])
        .filter(v => v.zygosity === 'hom_alt')
        .slice(0, 30);
      if (topHigh.length > 0) {
        genomicContext += `Top HIGH-impact homozygous variants (rarest first by Dog10K AF):\n`;
        for (const v of topHigh) {
          const af = v.af_dog10k !== null ? `AF=${(v.af_dog10k*100).toFixed(2)}%` : 'AF=unknown';
          genomicContext += `  ${v.gene} ${v.chr}:${v.pos} ${v.ref}>${v.alt} ${v.effect.replace(/_/g,' ')} ${af}\n`;
        }
        genomicContext += '\n';
      }

      // Top MODERATE-impact genes with hom alt variants, sorted by rarity
      const topMod = (fv.moderate_by_gene as {gene:string;n_moderate:number;hom_alt:number;het:number;effects:string[];min_af:number|null}[])
        .filter(g => g.hom_alt > 0)
        .slice(0, 20);
      if (topMod.length > 0) {
        genomicContext += `Top MODERATE-impact genes with homozygous variants (rarest first):\n`;
        for (const g of topMod) {
          const af = g.min_af !== null ? `min AF=${(g.min_af*100).toFixed(2)}%` : '';
          genomicContext += `  ${g.gene}: ${g.hom_alt} hom / ${g.het} het · ${g.effects.slice(0,3).join(', ')} ${af}\n`;
        }
        genomicContext += '\n';
      }
    }
  } catch { /* optional */ }

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

  // Append data quality metrics
  try {
    const qcPath = publicPath('qc_result.json');
    if (fs.existsSync(qcPath)) {
      const qc = JSON.parse(fs.readFileSync(qcPath, 'utf-8'));
      genomicContext += `\n\n=== SEQUENCING DATA QUALITY ===\n`;
      genomicContext += `Mean depth: ${qc.genome_mean_depth}x · Median depth: ${qc.genome_median_depth}x · CV: ${qc.uniformity_cv}\n`;
      genomicContext += `% bins >10x: ${qc.pct_bins_gt10x}% · >15x: ${qc.pct_bins_gt15x}% · >20x: ${qc.pct_bins_gt20x}% · >30x: ${qc.pct_bins_gt30x}%\n`;
      genomicContext += `Low-coverage bins: ${qc.n_low_bins} of ${qc.n_total_bins} total\n`;
    }
  } catch { /* optional */ }

  // Append health notes from DogNotes (stored as JSON in dogs.notes)
  try {
    const dog = db.prepare(
      `SELECT name, breed, dob, notes FROM dogs WHERE user_id = ? ORDER BY id ASC LIMIT 1`
    ).get(user.id) as { name: string; breed?: string; dob?: string; notes?: string } | undefined;
    if (dog?.notes) {
      const parsed = JSON.parse(dog.notes) as Record<string, string>;
      const LABELS: Record<string, string> = {
        general: 'General Info', health: 'Health History', medications: 'Current Medications',
        vaccinations: 'Vaccinations', vet: 'Vet & Contacts', diet: 'Diet & Nutrition', other: 'Other Notes',
      };
      const filled = Object.entries(parsed).filter(([, v]) => v?.trim());
      if (filled.length > 0) {
        genomicContext += `\n\n=== HEALTH NOTES (${dog.name}) ===\n`;
        if (dog.breed) genomicContext += `Breed: ${dog.breed}\n`;
        if (dog.dob) genomicContext += `DOB: ${dog.dob}\n`;
        for (const [key, val] of filled) {
          genomicContext += `\n[${LABELS[key] ?? key}]\n${val.trim()}\n`;
        }
      }
    }
  } catch { /* optional */ }

  // Append oral microbiome profiling results
  try {
    const mbPath = publicPath('microbiome_result.json');
    if (fs.existsSync(mbPath)) {
      const mb = JSON.parse(fs.readFileSync(mbPath, 'utf-8'));
      const norm = mb.total_classified_pct / 100;
      const normPct = (v: number) => norm > 0 ? (v / norm).toFixed(2) : v.toFixed(2);
      genomicContext += `\n\n=== ORAL MICROBIOME (MetaPhlAn4 — ${mb.db_version}) ===\n`;
      genomicContext += `Run date: ${mb.run_date} · Classified reads: ${mb.total_classified_pct.toFixed(2)}% of total (96%+ are host DNA)\n`;
      genomicContext += `All abundances below are % of bacterial reads (normalized by classified fraction).\n`;
      if (mb.phyla?.length > 0) {
        genomicContext += `Top phyla: ${mb.phyla.slice(0,5).map((e: {name:string;relative_abundance:number}) => `${e.name} (${normPct(e.relative_abundance)}%)`).join(', ')}\n`;
      }
      if (mb.genera?.length > 0) {
        genomicContext += `Top genera: ${mb.genera.slice(0,8).map((e: {name:string;relative_abundance:number}) => `${e.name} (${normPct(e.relative_abundance)}%)`).join(', ')}\n`;
      }
      if (mb.species?.length > 0) {
        genomicContext += `Top species: ${mb.species.slice(0,10).map((e: {name:string;relative_abundance:number}) => `${e.name} (${normPct(e.relative_abundance)}%)`).join(', ')}\n`;
      }
    }
  } catch { /* optional */ }

  // Append microbiome health metrics (diversity + pathobiont burden)
  try {
    const mbhPath = publicPath('microbiome_health_result.json');
    if (fs.existsSync(mbhPath)) {
      const mh = JSON.parse(fs.readFileSync(mbhPath, 'utf-8'));
      genomicContext += `\n=== MICROBIOME HEALTH METRICS ===\n`;
      genomicContext += `Alpha diversity (on ${mh.n_matched_species} species shared with reference panel): richness=${mh.cosmo_richness_matched} (${mh.richness_percentile}th pct vs. ref median ${mh.ref_richness_p50}), Shannon=${mh.cosmo_shannon_matched.toFixed(2)} (${mh.shannon_percentile}th pct vs. ref median ${mh.ref_shannon_p50.toFixed(2)})\n`;
      genomicContext += `Pathobiont burden: ${mh.pathobiont_burden_pct}% of bacterial reads (${mh.pathobiont_percentile}th pct; ref median ${mh.ref_pathobiont_median}%, 90th pct ${mh.ref_pathobiont_p90}%)\n`;
      genomicContext += `Dysbiosis index (log10 pathobiont/commensal): ${mh.dysbiosis_index}\n`;
      if (mh.pathobiont_hits?.length > 0) {
        genomicContext += `Detected periodontal pathogens: ${mh.pathobiont_hits.map((h: {name:string;pct:number}) => `${h.name} (${h.pct}%)`).join(', ')}\n`;
      }
    }
  } catch { /* optional */ }

  // Append microbiome age prediction
  try {
    const mbAgePath = publicPath('microbiome_age_result.json');
    if (fs.existsSync(mbAgePath)) {
      const ma = JSON.parse(fs.readFileSync(mbAgePath, 'utf-8'));
      genomicContext += `\n=== MICROBIOME AGE PREDICTION ===\n`;
      genomicContext += `Predicted microbiome age: ${ma.predicted_age_years} years (model CV R²=${ma.cv_r2}, MAE±${ma.cv_mae_years} yrs)\n`;
      genomicContext += `Model: ${ma.model} · trained on ${ma.n_training_samples} reference dogs · ${ma.n_cosmo_features_matched}/${ma.n_species_features} species matched\n`;
      if (ma.top_species?.length > 0) {
        const pos = ma.top_species.filter((s: {coefficient:number}) => s.coefficient > 0).slice(0,3).map((s: {name:string}) => s.name).join(', ');
        const neg = ma.top_species.filter((s: {coefficient:number}) => s.coefficient < 0).slice(0,3).map((s: {name:string}) => s.name).join(', ');
        genomicContext += `Age-increasing species: ${pos}\nAge-decreasing species: ${neg}\n`;
      }
    }
  } catch { /* optional */ }

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
You have access to the following genomic data for ${user.name}'s dog:

${genomicContext}

Guidelines:
- Functional variants were identified by GLIMPSE2 imputation against the Dog10K panel (29M SNPs, 1,929 dogs) followed by snpEff annotation — this is far more comprehensive and reliable than de-novo calling at low coverage
- Prioritise homozygous HIGH-impact variants with low population AF (AF<5%) — these are the most likely to affect phenotype
- HIGH impact = stop gained, frameshift, splice site disruption; MODERATE = missense, inframe indel
- Population AF is from Dog10K (1,929 canids): rare variants (AF<1%) in homozygous state are the top priority
- OMIA variants are breed-specific known pathogenic alleles genotyped directly from the BAM
- Always recommend consulting a veterinary specialist or veterinary geneticist for clinical decisions
- Be clear about the limits of genomic interpretation without clinical context`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
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
