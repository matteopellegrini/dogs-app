import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { getUserByEmail } from '@/lib/db';
import { sql } from '@vercel/postgres';
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

  const user = await getUserByEmail(session.user.email);
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

  // Append Dog10K inbreeding distribution comparison
  try {
    const ibD10kPath = publicPath('inbreeding_froh_dog10k_result.json');
    if (fs.existsSync(ibD10kPath)) {
      const ib = JSON.parse(fs.readFileSync(ibD10kPath, 'utf-8'));
      genomicContext += `\n=== INBREEDING vs. DOG10K PANEL (${ib.n_samples} dogs, 21M SNPs) ===\n`;
      genomicContext += `F_ROH = ${(ib.sample_froh * 100).toFixed(1)}% — ${ib.sample_percentile}th percentile vs. panel\n`;
      genomicContext += `Panel: mean=${(ib.ref_froh_mean * 100).toFixed(1)}%, median=${(ib.ref_froh_p50 * 100).toFixed(1)}%, IQR ${(ib.ref_froh_p25 * 100).toFixed(1)}–${(ib.ref_froh_p75 * 100).toFixed(1)}%\n`;
      if (ib.note) genomicContext += `Note: ${ib.note}\n`;
    }
  } catch { /* optional */ }

  // Known variants (merged OMIA + commercial panels)
  try {
    const omiaPath = publicPath('omia_result.json');
    if (fs.existsSync(omiaPath)) {
      const omia = JSON.parse(fs.readFileSync(omiaPath, 'utf-8'));
      const s = omia.summary;
      genomicContext += `\n\n=== KNOWN DISEASE & TRAIT VARIANTS (OMIA + COMMERCIAL PANELS) ===\n`;
      genomicContext += `${s.total_screened} sites screened (merged OMIA + Embark/Wisdom published variants with canFam4 coordinates).\n`;
      genomicContext += `Method: ${omia.method}\n`;
      genomicContext += `Alt allele detected: ${s.affected_snv} sites · High/medium confidence: ${s.affected_high_or_medium_confidence} · Indels (unresolved): ${s.indel_unknown} · Clear (ref/ref): ${s.unaffected}\n\n`;

      const variants = omia.variants as {
        gene: string; chrom: string; pos: number; ref?: string; alt?: string;
        variant_type?: string; hgvs_c?: string; hgvs_p?: string;
        phene_name?: string; trait?: string; deleterious?: string;
        mol_gen?: string; clinical_note?: string;
        variant_breed?: string; panel?: string; source?: string;
        cosmo: { zygosity: string; depth: number; ref_count: number|null; alt_count: number|null; affected: boolean|null; call_confidence?: string; note?: string };
      }[];

      const affected = variants.filter(v => v.cosmo?.affected === true);
      const affHighMed = affected.filter(v => v.cosmo.call_confidence === 'high' || v.cosmo.call_confidence === 'medium');
      const affLow    = affected.filter(v => v.cosmo.call_confidence === 'low');

      if (affHighMed.length > 0) {
        genomicContext += `HIGH/MEDIUM CONFIDENCE ALLELE MATCHES:\n`;
        for (const v of affHighMed) {
          const trait = v.phene_name || v.trait || 'unknown trait';
          const hgvs  = v.hgvs_c ? ` ${v.hgvs_c} ${v.hgvs_p || ''}` : ` ${v.ref || ''}>${v.alt || v.variant_type || ''}`;
          genomicContext += `  ${v.gene} ${v.chrom}:${v.pos}${hgvs} | ${v.cosmo.zygosity} DP=${v.cosmo.depth} (conf=${v.cosmo.call_confidence}) | ${trait}`;
          if (v.variant_breed) genomicContext += ` [${v.variant_breed}]`;
          if (v.deleterious) genomicContext += ` | deleterious: ${v.deleterious}`;
          genomicContext += '\n';
          if (v.mol_gen)      genomicContext += `    Genetics: ${v.mol_gen.slice(0,200)}\n`;
          if (v.clinical_note) genomicContext += `    Note: ${v.clinical_note.slice(0,200)}\n`;
        }
        genomicContext += '\n';
      }

      if (affLow.length > 0) {
        genomicContext += `LOW CONFIDENCE ALLELE MATCHES (depth 1–2 reads, may be sequencing noise — treat with caution):\n`;
        for (const v of affLow) {
          const trait = v.phene_name || v.trait || 'unknown trait';
          genomicContext += `  ${v.gene} ${v.chrom}:${v.pos} ${v.ref || ''}>${v.alt || ''} | ${v.cosmo.zygosity} DP=${v.cosmo.depth} | ${trait}`;
          if (v.variant_breed) genomicContext += ` [${v.variant_breed}]`;
          genomicContext += '\n';
        }
        genomicContext += '\n';
      }

      if (affected.length === 0) {
        genomicContext += `No known pathogenic alleles detected at medium/high confidence.\n`;
      }
    }
  } catch { /* optional */ }

  // Coat color genetics
  try {
    const ccPath = publicPath('coat_color.json');
    if (fs.existsSync(ccPath)) {
      const cc = JSON.parse(fs.readFileSync(ccPath, 'utf-8'));
      const s  = cc.summary;
      genomicContext += `\n\n=== COAT COLOR GENETICS (MENDELIAN LOCUS ANALYSIS) ===\n`;
      genomicContext += `Predicted base color: ${s.predicted_base_color}\n`;
      genomicContext += `Predicted pattern: ${s.predicted_pattern}\n`;
      genomicContext += `Dilution: ${s.predicted_dilution}\n`;
      genomicContext += `White markings: ${s.predicted_white}\n`;
      genomicContext += `Merle: ${s.predicted_merle}\n`;
      genomicContext += `Overall confidence: ${s.overall_confidence}\n`;
      genomicContext += `IRF4 note: ${s.irf4_note}\n`;
      genomicContext += `Caveat: ${s.caveat}\n\n`;
      genomicContext += `Locus-by-locus:\n`;
      for (const [locus, data] of Object.entries(cc.loci as Record<string, {gene:string;predicted_alleles:string[];confidence:string;interpretation:string;phenotype_contribution:string}>)) {
        genomicContext += `  ${locus} (${data.gene}): ${data.predicted_alleles.join('/')} [${data.confidence}] — ${data.phenotype_contribution}\n`;
        genomicContext += `    ${data.interpretation.slice(0, 300)}${data.interpretation.length > 300 ? '...' : ''}\n`;
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

  // Karyotype / 1Mb coverage ratios
  try {
    const covPath = publicPath('coverage_1mb.json');
    if (fs.existsSync(covPath)) {
      const cov = JSON.parse(fs.readFileSync(covPath, 'utf-8')) as Record<string, { ratio: number[] }>;
      const DEL = 0.65, DUP = 1.35;
      const flagged: string[] = [];
      for (const [chrom, data] of Object.entries(cov)) {
        const windows = (data.ratio ?? []).map((r, i) => ({ i, r })).filter(w => w.r < DEL || w.r > DUP);
        if (windows.length > 0) {
          const desc = windows.map(w => `${w.i}–${w.i + 1}Mb ratio=${w.r.toFixed(2)}`).join(', ');
          flagged.push(`${chrom}: ${windows.length} window(s) — ${desc}`);
        }
      }
      genomicContext += `\n\n=== KARYOTYPE / CHROMOSOME COPY NUMBER (1MB BINS) ===\n`;
      genomicContext += `Method: Panel-normalised depth ratios vs 4-dog reference (autosomes) and 3-male reference (chrX). Ratio ~1.0=normal, <0.65=loss, >1.35=gain.\n`;
      genomicContext += `chrX ratio reflects sex chromosome copy number relative to reference panel.\n`;
      if (flagged.length > 0) {
        genomicContext += `Flagged regions (possible copy-number gains):\n`;
        for (const f of flagged) genomicContext += `  ${f}\n`;
        genomicContext += `Note: chr8 74–76Mb, chr9 9Mb, chr19 21Mb show elevated ratios (1.4–1.6x). These are focal regions warranting further evaluation; could represent true duplications, segmental duplications, or mapping artefacts at low coverage.\n`;
      } else {
        genomicContext += `No flagged regions — all chromosomes within normal ratio range.\n`;
      }
    }
  } catch { /* optional */ }

  // Append CNV homozygous deletion data from static analysis
  try {
    const cnvPath = publicPath('cnv_homdel.json');
    if (fs.existsSync(cnvPath)) {
      const cnv = JSON.parse(fs.readFileSync(cnvPath, 'utf-8'));
      const pcGenes = (cnv.disrupted_genes as {gene:string;biotype:string;chrom:string;start:number;size?:string;end?:number}[])
        .filter((g) => g.biotype === 'protein_coding')
        .map((g) => `${g.gene} (${g.chrom}:${(g.start/1e6).toFixed(1)}Mb)`)
        .join(', ');
      genomicContext += `\n\n=== COPY NUMBER VARIANT ANALYSIS — HOMOZYGOUS DELETIONS ===\n`;
      genomicContext += `${cnv.summary.method ?? 'Adaptive-window coverage normalisation, depth <15% of genome mean.'}\n`;
      genomicContext += `Total deletion regions: ${cnv.summary.total_regions}\n`;
      if (cnv.summary.panel_note) genomicContext += `Note: ${cnv.summary.panel_note}\n`;
      const nPc = (cnv.disrupted_genes as {biotype:string}[]).filter(g => g.biotype === 'protein_coding').length;
      if (nPc > 0) genomicContext += `Disrupted protein-coding genes (${nPc}): ${pcGenes}\n`;
      const regions = (cnv.regions as {chrom:string;start:number;end:number;size:string;panel_pct_mean:number;sample_pct_mean:number|null;disrupted_genes:string[]}[]);
      const topRegions = regions.slice(0, 10);
      if (topRegions.length > 0) {
        genomicContext += `Deletion regions (up to 10):\n`;
        for (const r of topRegions) {
          const genes = r.disrupted_genes.length > 0 ? ` [${r.disrupted_genes.join(', ')}]` : '';
          const samplePct = r.sample_pct_mean != null ? ` sample=${r.sample_pct_mean}%` : '';
          genomicContext += `  ${r.chrom}:${(r.start/1e6).toFixed(1)}–${(r.end/1e6).toFixed(1)}Mb (${r.size}) panel=${r.panel_pct_mean}%${samplePct}${genes}\n`;
        }
      }
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
      if (qc.total_reads_raw != null)
        genomicContext += `Total reads: ${(qc.total_reads_raw / 1e6).toFixed(1)}M raw · ${qc.total_reads_after_qc != null ? (qc.total_reads_after_qc / 1e6).toFixed(1) + 'M after QC' : ''}\n`;
      if (qc.reads_mapped != null)
        genomicContext += `Mapped reads: ${(qc.reads_mapped / 1e6).toFixed(1)}M (${qc.total_reads_after_qc ? ((qc.reads_mapped / qc.total_reads_after_qc) * 100).toFixed(1) : '?'}%)\n`;
      if (qc.duplication_rate_pct != null)
        genomicContext += `Duplication rate: ${qc.duplication_rate_pct}%\n`;
      if (qc.fragment_size_mean_bp != null)
        genomicContext += `Mean fragment size: ${qc.fragment_size_mean_bp} bp (from paired-end insert size)\n`;
      if (qc.read_length_bp != null)
        genomicContext += `Read length: ${qc.read_length_bp} bp raw · ${qc.read_length_after_trimming_bp ?? '?'} bp after trimming\n`;
      if (qc.pct_q30_raw != null)
        genomicContext += `Q30 bases: ${qc.pct_q30_raw}%\n`;
      if (qc.total_bases_raw_gb != null)
        genomicContext += `Total bases: ${qc.total_bases_raw_gb} Gb\n`;
      genomicContext += `QC status: ${qc.qc_status}${qc.warning ? ' — ' + qc.warning : ''}\n`;
    }
  } catch { /* optional */ }

  // Append health notes from DogNotes (stored as JSON in dogs.notes)
  try {
    const dogName = samplePath.replace(/^\//, '').split('/')[0];
    const { rows: dogRows } = await sql`
      SELECT name, breed, dob, notes FROM dogs
      WHERE user_id = ${user.id} AND LOWER(name) = LOWER(${dogName})
      LIMIT 1
    `;
    const dog = dogRows[0] as { name: string; breed?: string; dob?: string; notes?: string } | undefined;
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
      genomicContext += `Alpha diversity (on ${mh.n_matched_species} species shared with reference panel): richness=${mh.sample_richness_matched} (${mh.richness_percentile}th pct vs. ref median ${mh.ref_richness_p50}), Shannon=${(mh.sample_shannon_matched as number).toFixed(2)} (${mh.shannon_percentile}th pct vs. ref median ${(mh.ref_shannon_p50 as number).toFixed(2)})\n`;
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
      genomicContext += `Model: ${ma.model} · trained on ${ma.n_training_samples} reference dogs · ${ma.n_features_matched}/${ma.n_species_features} species matched\n`;
      if (ma.top_species?.length > 0) {
        const pos = ma.top_species.filter((s: {coefficient:number}) => s.coefficient > 0).slice(0,3).map((s: {name:string}) => s.name).join(', ');
        const neg = ma.top_species.filter((s: {coefficient:number}) => s.coefficient < 0).slice(0,3).map((s: {name:string}) => s.name).join(', ');
        genomicContext += `Age-increasing species: ${pos}\nAge-decreasing species: ${neg}\n`;
      }
    }
  } catch { /* optional */ }

  // Append uploaded lab report text (PDFs parsed from Upload Data tab)
  try {
    const sampleName = samplePath.replace(/^\//, '');
    const { rows: uploads } = await sql`
      SELECT original_name, parsed_text, created_at FROM uploads
      WHERE user_id = ${user.id} AND parsed_text IS NOT NULL AND sample = ${sampleName}
      ORDER BY created_at DESC LIMIT 5
    `;
    (uploads as { original_name: string; parsed_text: string; created_at: string }[]);
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
