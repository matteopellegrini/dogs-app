export interface GeneRecord {
  gene_name: string;
  gene_id: string;
  transcript_id: string;
  biotype: string;
  impact_high: number;
  impact_low: number;
  impact_moderate: number;
  impact_modifier: number;
  effect_frameshift: number;
  effect_missense: number;
  effect_stop_gained: number;
  effect_stop_lost: number;
  effect_start_lost: number;
  effect_splice_acceptor: number;
  effect_splice_donor: number;
  effect_splice_region: number;
  effect_synonymous: number;
  effect_intron: number;
  effect_upstream: number;
  effect_downstream: number;
  effect_utr3: number;
  effect_utr5: number;
  total_variants: number;
}

export function parseSnpEffGenes(content: string): GeneRecord[] {
  const lines = content.split('\n');
  let headerLine: string | null = null;
  const records: GeneRecord[] = [];

  for (const line of lines) {
    if (line.startsWith('# The following')) continue;
    if (line.startsWith('#GeneName')) {
      headerLine = line.slice(1); // remove leading #
      continue;
    }
    if (!line.trim() || !headerLine) continue;

    const cols = line.split('\t');
    const headers = headerLine.split('\t');
    const get = (name: string) => {
      const i = headers.indexOf(name);
      return i >= 0 ? parseInt(cols[i] || '0', 10) || 0 : 0;
    };
    const getString = (name: string) => {
      const i = headers.indexOf(name);
      return i >= 0 ? (cols[i] || '').trim() : '';
    };

    const high = get('variants_impact_HIGH');
    const low = get('variants_impact_LOW');
    const moderate = get('variants_impact_MODERATE');
    const modifier = get('variants_impact_MODIFIER');

    records.push({
      gene_name: getString('GeneName'),
      gene_id: getString('GeneId'),
      transcript_id: getString('TranscriptId'),
      biotype: getString('BioType'),
      impact_high: high,
      impact_low: low,
      impact_moderate: moderate,
      impact_modifier: modifier,
      effect_frameshift: get('variants_effect_frameshift_variant'),
      effect_missense: get('variants_effect_missense_variant'),
      effect_stop_gained: get('variants_effect_stop_gained'),
      effect_stop_lost: get('variants_effect_stop_lost'),
      effect_start_lost: get('variants_effect_start_lost'),
      effect_splice_acceptor: get('variants_effect_splice_acceptor_variant'),
      effect_splice_donor: get('variants_effect_splice_donor_variant'),
      effect_splice_region: get('variants_effect_splice_region_variant'),
      effect_synonymous: get('variants_effect_synonymous_variant'),
      effect_intron: get('variants_effect_intron_variant'),
      effect_upstream: get('variants_effect_upstream_gene_variant'),
      effect_downstream: get('variants_effect_downstream_gene_variant'),
      effect_utr3: get('variants_effect_3_prime_UTR_variant'),
      effect_utr5: get('variants_effect_5_prime_UTR_variant'),
      total_variants: high + low + moderate + modifier,
    });
  }

  return records.filter((r) => r.total_variants > 0);
}

export function buildGeneContext(genes: GeneRecord[]): string {
  const total = genes.reduce((s, g) => s + g.total_variants, 0);
  const highGenes = genes.filter((g) => g.impact_high > 0).sort((a, b) => b.impact_high - a.impact_high);
  const modGenes = genes.filter((g) => g.impact_moderate > 0).sort((a, b) => b.impact_moderate - a.impact_moderate);

  const lines = [
    `=== SNPEFF GENE SUMMARY ===`,
    `Total genes with variants: ${genes.length}`,
    `Total variants: ${total}`,
    '',
    '--- HIGH Impact Genes (most clinically significant) ---',
    ...highGenes.map((g) =>
      `  ${g.gene_name || g.gene_id} [${g.biotype}]: HIGH=${g.impact_high}` +
      (g.effect_frameshift ? ` frameshift=${g.effect_frameshift}` : '') +
      (g.effect_stop_gained ? ` stop_gained=${g.effect_stop_gained}` : '') +
      (g.effect_stop_lost ? ` stop_lost=${g.effect_stop_lost}` : '') +
      (g.effect_start_lost ? ` start_lost=${g.effect_start_lost}` : '') +
      (g.effect_splice_acceptor ? ` splice_acceptor=${g.effect_splice_acceptor}` : '') +
      (g.effect_splice_donor ? ` splice_donor=${g.effect_splice_donor}` : '')
    ),
    '',
    '--- MODERATE Impact Genes ---',
    ...modGenes.map((g) =>
      `  ${g.gene_name || g.gene_id} [${g.biotype}]: MODERATE=${g.impact_moderate} missense=${g.effect_missense}`
    ),
    '',
    '--- Top Genes by Total Variants ---',
    ...genes.slice(0, 15).map((g) =>
      `  ${g.gene_name || g.gene_id}: total=${g.total_variants} HIGH=${g.impact_high} MOD=${g.impact_moderate}`
    ),
  ];
  return lines.join('\n');
}

export interface ZygosityVariant {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  qual: number;
  genotype: string;
  zygosity: string;
  depth: number;
  gene: string;
  effect: string;
  impact: string;
  hgvs: string;
}

export function parseZygosityTsv(content: string): ZygosityVariant[] {
  const lines = content.split('\n');
  const records: ZygosityVariant[] = [];
  let headerSkipped = false;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (!headerSkipped) { headerSkipped = true; continue; } // skip header
    const cols = line.split('\t');
    if (cols.length < 12) continue;
    records.push({
      chrom: cols[0],
      pos: parseInt(cols[1], 10),
      ref: cols[2],
      alt: cols[3],
      qual: parseFloat(cols[4]) || 0,
      genotype: cols[5],
      zygosity: cols[6],
      depth: parseInt(cols[7], 10) || 0,
      gene: cols[8],
      effect: cols[9],
      impact: cols[10],
      hgvs: cols[11] || '',
    });
  }
  return records;
}

export function buildZygosityContext(variants: ZygosityVariant[]): string {
  const total = variants.length;
  const high = variants.filter((v) => v.impact === 'HIGH');
  const moderate = variants.filter((v) => v.impact === 'MODERATE');
  const homHigh = high.filter((v) => v.zygosity === 'homozygous');
  const hetHigh = high.filter((v) => v.zygosity === 'heterozygous');

  const lines = [
    `=== HIGH/MODERATE IMPACT VARIANTS WITH ZYGOSITY ===`,
    `Total: ${total} (HIGH: ${high.length}, MODERATE: ${moderate.length})`,
    `HIGH impact — homozygous: ${homHigh.length}, heterozygous: ${hetHigh.length}`,
    '',
    '--- Homozygous HIGH Impact (most significant — both alleles affected) ---',
    ...homHigh.map((v) =>
      `  ${v.chrom}:${v.pos} ${v.ref}>${v.alt} | ${v.gene} | ${v.effect} | ${v.hgvs} | depth=${v.depth}`
    ),
    '',
    '--- Heterozygous HIGH Impact ---',
    ...hetHigh.map((v) =>
      `  ${v.chrom}:${v.pos} ${v.ref}>${v.alt} | ${v.gene} | ${v.effect} | ${v.hgvs}`
    ),
    '',
    '--- MODERATE Impact (homozygous first) ---',
    ...moderate
      .sort((a, b) => (a.zygosity === 'homozygous' ? -1 : 1))
      .map((v) =>
        `  ${v.chrom}:${v.pos} | ${v.gene} | ${v.effect} | ${v.zygosity} | ${v.hgvs}`
      ),
  ];
  return lines.join('\n');
}

export interface ParsedVariant {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  qual: number;
  filter: string;
  genotype: string;
  depth: number;
  gene: string;
  gene_id: string;
  effect: string;
  impact: string;
  hgvs: string;
  annotation_raw: string;
}

/**
 * Parse a SNPEff-annotated VCF string into structured variant records.
 * Handles multi-allelic sites by taking the first ALT and first ANN entry.
 */
export function parseVcf(content: string): ParsedVariant[] {
  const lines = content.split('\n');
  const variants: ParsedVariant[] = [];

  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;

    const cols = line.split('\t');
    if (cols.length < 8) continue;

    const [chrom, posStr, , ref, altField, qualStr, filter, info, formatStr, sampleStr] = cols;
    const pos = parseInt(posStr, 10);
    const qual = parseFloat(qualStr) || 0;
    const alt = altField.split(',')[0]; // first ALT only

    // Parse FORMAT/sample for genotype and depth
    let genotype = '';
    let depth = 0;
    if (formatStr && sampleStr) {
      const fmtKeys = formatStr.split(':');
      const sampleVals = sampleStr.split(':');
      const gtIdx = fmtKeys.indexOf('GT');
      const dpIdx = fmtKeys.indexOf('DP');
      if (gtIdx >= 0) genotype = sampleVals[gtIdx] || '';
      if (dpIdx >= 0) depth = parseInt(sampleVals[dpIdx], 10) || 0;
    }

    // Parse ANN field (SNPEff annotation)
    // ANN format: allele|effect|impact|gene|gene_id|feature_type|feature_id|biotype|rank|hgvs_c|hgvs_p|...
    let gene = '';
    let gene_id = '';
    let effect = '';
    let impact = '';
    let hgvs = '';
    let annotation_raw = '';

    const annMatch = info.match(/ANN=([^;]+)/);
    if (annMatch) {
      const firstAnn = annMatch[1].split(',')[0];
      annotation_raw = firstAnn;
      const parts = firstAnn.split('|');
      effect = parts[1] || '';
      impact = parts[2] || '';
      gene = parts[3] || '';
      gene_id = parts[4] || '';
      const hgvsC = parts[9] || '';
      const hgvsP = parts[10] || '';
      hgvs = hgvsP || hgvsC;
    }

    variants.push({
      chrom,
      pos,
      ref,
      alt,
      qual,
      filter,
      genotype,
      depth,
      gene,
      gene_id,
      effect,
      impact,
      hgvs,
      annotation_raw,
    });
  }

  return variants;
}

export function buildGenomicContext(summary: {
  total: number;
  byImpact: { impact: string; count: number }[];
  topGenes: { gene: string; count: number; effects: string }[];
  highImpact: Partial<{
    chrom: string; pos: number; ref: string; alt: string;
    gene: string; effect: string; hgvs: string; qual: number; genotype: string;
  }>[];
}): string {
  const lines: string[] = [
    `=== DOG GENOMIC DATA SUMMARY ===`,
    `Total variants: ${summary.total}`,
    '',
    '--- Variant Impact Breakdown ---',
    ...summary.byImpact.map((r) => `  ${r.impact || 'UNKNOWN'}: ${r.count}`),
    '',
    '--- Top Genes with Variants ---',
    ...summary.topGenes
      .filter((g) => g.gene && !g.gene.startsWith('CHR_'))
      .slice(0, 15)
      .map((g) => `  ${g.gene} (${g.count} variants; effects: ${g.effects})`),
    '',
    '--- High & Moderate Impact Variants ---',
    ...summary.highImpact.slice(0, 30).map((v) =>
      `  ${v.chrom}:${v.pos} ${v.ref}>${v.alt} | Gene: ${v.gene || 'N/A'} | Effect: ${v.effect} | GT: ${v.genotype} | ${v.hgvs || ''}`
    ),
  ];
  return lines.join('\n');
}
