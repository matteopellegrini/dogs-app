import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function initSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS dogs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      breed TEXT,
      dob TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dog_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      variant_count INTEGER DEFAULT 0,
      parsed_text TEXT,
      sample TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS variants (
      id SERIAL PRIMARY KEY,
      upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chrom TEXT, pos INTEGER, ref TEXT, alt TEXT,
      qual REAL, filter TEXT, genotype TEXT, depth INTEGER,
      gene TEXT, gene_id TEXT, effect TEXT, impact TEXT,
      hgvs TEXT, annotation_raw TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS gene_records (
      id SERIAL PRIMARY KEY,
      upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gene_name TEXT, gene_id TEXT, transcript_id TEXT, biotype TEXT,
      impact_high INTEGER DEFAULT 0, impact_low INTEGER DEFAULT 0,
      impact_moderate INTEGER DEFAULT 0, impact_modifier INTEGER DEFAULT 0,
      effect_frameshift INTEGER DEFAULT 0, effect_missense INTEGER DEFAULT 0,
      effect_stop_gained INTEGER DEFAULT 0, effect_stop_lost INTEGER DEFAULT 0,
      effect_start_lost INTEGER DEFAULT 0, effect_splice_acceptor INTEGER DEFAULT 0,
      effect_splice_donor INTEGER DEFAULT 0, effect_splice_region INTEGER DEFAULT 0,
      effect_synonymous INTEGER DEFAULT 0, effect_intron INTEGER DEFAULT 0,
      effect_upstream INTEGER DEFAULT 0, effect_downstream INTEGER DEFAULT 0,
      effect_utr3 INTEGER DEFAULT 0, effect_utr5 INTEGER DEFAULT 0,
      total_variants INTEGER DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS zygosity_variants (
      id SERIAL PRIMARY KEY,
      upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chrom TEXT, pos INTEGER, ref TEXT, alt TEXT, qual REAL,
      genotype TEXT, zygosity TEXT, depth INTEGER,
      gene TEXT, effect TEXT, impact TEXT, hgvs TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_zyg_user ON zygosity_variants(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_zyg_impact ON zygosity_variants(user_id, impact, zygosity)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_variants_upload ON variants(upload_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_variants_user ON variants(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_variants_gene ON variants(gene)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_variants_impact ON variants(impact)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_genes_user ON gene_records(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_genes_impact_high ON gene_records(user_id, impact_high)`;
}

export async function createUser(email: string, name: string, password: string) {
  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await sql`
    INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash})
    RETURNING id
  `;
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] as { id: number; email: string; name: string; password_hash: string } | undefined;
}

export async function getUserById(id: number) {
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] as { id: number; email: string; name: string } | undefined;
}

export async function getUserByEmailSync(email: string) {
  return getUserByEmail(email);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export interface Variant {
  id: number; upload_id: number; chrom: string; pos: number;
  ref: string; alt: string; qual: number; filter: string;
  genotype: string; depth: number; gene: string; gene_id: string;
  effect: string; impact: string; hgvs: string;
}

export async function getVariantsForUser(userId: number, limit = 500) {
  const { rows } = await sql`
    SELECT v.*, u.original_name as file_name, u.created_at as uploaded_at
    FROM variants v
    JOIN uploads u ON v.upload_id = u.id
    WHERE v.user_id = ${userId}
    ORDER BY v.impact DESC, v.qual DESC
    LIMIT ${limit}
  `;
  return rows as (Variant & { file_name: string; uploaded_at: string })[];
}

export async function getVariantSummaryForUser(userId: number) {
  const { rows: totalRows } = await sql`SELECT COUNT(*) as n FROM variants WHERE user_id = ${userId}`;
  const total = Number(totalRows[0].n);

  const { rows: byImpact } = await sql`
    SELECT impact, COUNT(*) as count FROM variants WHERE user_id = ${userId}
    GROUP BY impact ORDER BY count DESC
  `;

  const { rows: topGenes } = await sql`
    SELECT gene, COUNT(*) as count, STRING_AGG(DISTINCT effect, ',') as effects
    FROM variants WHERE user_id = ${userId} AND gene != '' AND gene NOT LIKE 'CHR_%'
    GROUP BY gene ORDER BY count DESC LIMIT 20
  `;

  const { rows: highImpact } = await sql`
    SELECT chrom, pos, ref, alt, gene, effect, hgvs, qual, genotype
    FROM variants WHERE user_id = ${userId} AND impact IN ('HIGH','MODERATE')
    ORDER BY CASE impact WHEN 'HIGH' THEN 0 ELSE 1 END, qual DESC
    LIMIT 50
  `;

  return { total, byImpact, topGenes, highImpact: highImpact as Partial<Variant>[] };
}

export async function getUploadsForUser(userId: number) {
  const { rows } = await sql`
    SELECT u.*, d.name as dog_name FROM uploads u
    LEFT JOIN dogs d ON u.dog_id = d.id
    WHERE u.user_id = ${userId}
    ORDER BY u.created_at DESC
  `;
  return rows;
}

export async function createUpload(
  userId: number, filename: string, originalName: string,
  fileType: string, filePath: string, parsedText: string | null, sample: string | null
) {
  const { rows } = await sql`
    INSERT INTO uploads (user_id, filename, original_name, file_type, file_path, parsed_text, sample)
    VALUES (${userId}, ${filename}, ${originalName}, ${fileType}, ${filePath}, ${parsedText}, ${sample})
    RETURNING id
  `;
  return rows[0].id as number;
}

export async function insertVariants(
  uploadId: number, userId: number,
  variants: Omit<Variant, 'id' | 'upload_id'>[]
) {
  for (const v of variants) {
    await sql`
      INSERT INTO variants
        (upload_id, user_id, chrom, pos, ref, alt, qual, filter, genotype, depth,
         gene, gene_id, effect, impact, hgvs, annotation_raw)
      VALUES
        (${uploadId}, ${userId}, ${v.chrom}, ${v.pos}, ${v.ref}, ${v.alt},
         ${v.qual}, ${v.filter}, ${v.genotype}, ${v.depth},
         ${v.gene}, ${v.gene_id}, ${v.effect}, ${v.impact}, ${v.hgvs},
         ${(v as Variant & { annotation_raw?: string }).annotation_raw ?? null})
    `;
  }
  await sql`UPDATE uploads SET variant_count = ${variants.length} WHERE id = ${uploadId}`;
}

import type { GeneRecord, ZygosityVariant } from './vcf-parser';

export async function insertGeneRecords(uploadId: number, userId: number, genes: GeneRecord[]) {
  for (const g of genes) {
    await sql`
      INSERT INTO gene_records
        (upload_id, user_id, gene_name, gene_id, transcript_id, biotype,
         impact_high, impact_low, impact_moderate, impact_modifier,
         effect_frameshift, effect_missense, effect_stop_gained, effect_stop_lost, effect_start_lost,
         effect_splice_acceptor, effect_splice_donor, effect_splice_region,
         effect_synonymous, effect_intron, effect_upstream, effect_downstream,
         effect_utr3, effect_utr5, total_variants)
      VALUES
        (${uploadId}, ${userId}, ${g.gene_name}, ${g.gene_id}, ${g.transcript_id}, ${g.biotype},
         ${g.impact_high}, ${g.impact_low}, ${g.impact_moderate}, ${g.impact_modifier},
         ${g.effect_frameshift}, ${g.effect_missense}, ${g.effect_stop_gained}, ${g.effect_stop_lost}, ${g.effect_start_lost},
         ${g.effect_splice_acceptor}, ${g.effect_splice_donor}, ${g.effect_splice_region},
         ${g.effect_synonymous}, ${g.effect_intron}, ${g.effect_upstream}, ${g.effect_downstream},
         ${g.effect_utr3}, ${g.effect_utr5}, ${g.total_variants})
    `;
  }
  await sql`UPDATE uploads SET variant_count = ${genes.length} WHERE id = ${uploadId}`;
}

export async function getGeneSummaryForUser(userId: number) {
  const { rows } = await sql`
    SELECT gene_name, gene_id, biotype,
      SUM(impact_high) as impact_high, SUM(impact_moderate) as impact_moderate,
      SUM(impact_low) as impact_low, SUM(impact_modifier) as impact_modifier,
      SUM(effect_frameshift) as effect_frameshift, SUM(effect_missense) as effect_missense,
      SUM(effect_stop_gained) as effect_stop_gained, SUM(effect_stop_lost) as effect_stop_lost,
      SUM(effect_start_lost) as effect_start_lost,
      SUM(effect_splice_acceptor) as effect_splice_acceptor,
      SUM(effect_splice_donor) as effect_splice_donor,
      SUM(effect_splice_region) as effect_splice_region,
      SUM(effect_synonymous) as effect_synonymous,
      SUM(total_variants) as total_variants
    FROM gene_records WHERE user_id = ${userId}
    GROUP BY gene_id, gene_name, biotype
    ORDER BY impact_high DESC, impact_moderate DESC
  `;
  return rows as GeneRecord[];
}

export async function insertZygosityVariants(uploadId: number, userId: number, variants: ZygosityVariant[]) {
  for (const v of variants) {
    await sql`
      INSERT INTO zygosity_variants
        (upload_id, user_id, chrom, pos, ref, alt, qual, genotype, zygosity, depth, gene, effect, impact, hgvs)
      VALUES
        (${uploadId}, ${userId}, ${v.chrom}, ${v.pos}, ${v.ref}, ${v.alt},
         ${v.qual}, ${v.genotype}, ${v.zygosity}, ${v.depth}, ${v.gene}, ${v.effect}, ${v.impact}, ${v.hgvs})
    `;
  }
  await sql`UPDATE uploads SET variant_count = ${variants.length} WHERE id = ${uploadId}`;
}

export async function getZygosityVariantsForUser(userId: number) {
  const { rows } = await sql`
    SELECT * FROM zygosity_variants WHERE user_id = ${userId}
    ORDER BY
      CASE impact WHEN 'HIGH' THEN 0 ELSE 1 END,
      CASE zygosity WHEN 'homozygous' THEN 0 ELSE 1 END,
      qual DESC
  `;
  return rows as ZygosityVariant[];
}

export async function getDogsForUser(userId: number) {
  const { rows } = await sql`SELECT * FROM dogs WHERE user_id = ${userId} ORDER BY name`;
  return rows;
}

export async function createDog(userId: number, name: string, breed?: string, dob?: string, notes?: string) {
  const { rows } = await sql`
    INSERT INTO dogs (user_id, name, breed, dob, notes)
    VALUES (${userId}, ${name}, ${breed ?? null}, ${dob ?? null}, ${notes ?? null})
    RETURNING id
  `;
  return rows[0].id as number;
}

export async function getDogById(dogId: number, userId: number) {
  const { rows } = await sql`SELECT id FROM dogs WHERE id = ${dogId} AND user_id = ${userId}`;
  return rows[0] as { id: number } | undefined;
}

export async function updateDog(
  dogId: number, userId: number,
  fields: { notes?: string; name?: string; breed?: string; dob?: string }
) {
  if (fields.notes !== undefined) await sql`UPDATE dogs SET notes = ${fields.notes} WHERE id = ${dogId} AND user_id = ${userId}`;
  if (fields.name !== undefined)  await sql`UPDATE dogs SET name  = ${fields.name}  WHERE id = ${dogId} AND user_id = ${userId}`;
  if (fields.breed !== undefined) await sql`UPDATE dogs SET breed = ${fields.breed} WHERE id = ${dogId} AND user_id = ${userId}`;
  if (fields.dob !== undefined)   await sql`UPDATE dogs SET dob   = ${fields.dob}   WHERE id = ${dogId} AND user_id = ${userId}`;
}
