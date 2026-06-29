import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'dogs.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      breed TEXT,
      dob TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dog_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      variant_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chrom TEXT,
      pos INTEGER,
      ref TEXT,
      alt TEXT,
      qual REAL,
      filter TEXT,
      genotype TEXT,
      depth INTEGER,
      gene TEXT,
      gene_id TEXT,
      effect TEXT,
      impact TEXT,
      hgvs TEXT,
      annotation_raw TEXT
    );

    CREATE TABLE IF NOT EXISTS gene_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gene_name TEXT,
      gene_id TEXT,
      transcript_id TEXT,
      biotype TEXT,
      impact_high INTEGER DEFAULT 0,
      impact_low INTEGER DEFAULT 0,
      impact_moderate INTEGER DEFAULT 0,
      impact_modifier INTEGER DEFAULT 0,
      effect_frameshift INTEGER DEFAULT 0,
      effect_missense INTEGER DEFAULT 0,
      effect_stop_gained INTEGER DEFAULT 0,
      effect_stop_lost INTEGER DEFAULT 0,
      effect_start_lost INTEGER DEFAULT 0,
      effect_splice_acceptor INTEGER DEFAULT 0,
      effect_splice_donor INTEGER DEFAULT 0,
      effect_splice_region INTEGER DEFAULT 0,
      effect_synonymous INTEGER DEFAULT 0,
      effect_intron INTEGER DEFAULT 0,
      effect_upstream INTEGER DEFAULT 0,
      effect_downstream INTEGER DEFAULT 0,
      effect_utr3 INTEGER DEFAULT 0,
      effect_utr5 INTEGER DEFAULT 0,
      total_variants INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS zygosity_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chrom TEXT, pos INTEGER, ref TEXT, alt TEXT, qual REAL,
      genotype TEXT, zygosity TEXT, depth INTEGER,
      gene TEXT, effect TEXT, impact TEXT, hgvs TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_zyg_user ON zygosity_variants(user_id);
    CREATE INDEX IF NOT EXISTS idx_zyg_impact ON zygosity_variants(user_id, impact, zygosity);

    CREATE INDEX IF NOT EXISTS idx_variants_upload ON variants(upload_id);
    CREATE INDEX IF NOT EXISTS idx_variants_user ON variants(user_id);
    CREATE INDEX IF NOT EXISTS idx_variants_gene ON variants(gene);
    CREATE INDEX IF NOT EXISTS idx_variants_impact ON variants(impact);
    CREATE INDEX IF NOT EXISTS idx_genes_user ON gene_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_genes_impact_high ON gene_records(user_id, impact_high);
  `);
}

export function createUser(email: string, name: string, password: string) {
  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)');
  return stmt.run(email, name, hash);
}

export function getUserByEmail(email: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | { id: number; email: string; name: string; password_hash: string }
    | undefined;
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export interface Variant {
  id: number;
  upload_id: number;
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
}

export function getVariantsForUser(userId: number, limit = 500) {
  const db = getDb();
  return db
    .prepare(
      `SELECT v.*, u.original_name as file_name, u.created_at as uploaded_at
       FROM variants v
       JOIN uploads u ON v.upload_id = u.id
       WHERE v.user_id = ?
       ORDER BY v.impact DESC, v.qual DESC
       LIMIT ?`
    )
    .all(userId, limit) as (Variant & { file_name: string; uploaded_at: string })[];
}

export function getVariantSummaryForUser(userId: number) {
  const db = getDb();
  const total = (
    db.prepare('SELECT COUNT(*) as n FROM variants WHERE user_id = ?').get(userId) as { n: number }
  ).n;

  const byImpact = db
    .prepare(
      `SELECT impact, COUNT(*) as count FROM variants WHERE user_id = ? GROUP BY impact ORDER BY count DESC`
    )
    .all(userId) as { impact: string; count: number }[];

  const topGenes = db
    .prepare(
      `SELECT gene, COUNT(*) as count, GROUP_CONCAT(DISTINCT effect) as effects
       FROM variants WHERE user_id = ? AND gene != '' AND gene NOT LIKE 'CHR_%'
       GROUP BY gene ORDER BY count DESC LIMIT 20`
    )
    .all(userId) as { gene: string; count: number; effects: string }[];

  const highImpact = db
    .prepare(
      `SELECT chrom, pos, ref, alt, gene, effect, hgvs, qual, genotype
       FROM variants WHERE user_id = ? AND impact IN ('HIGH','MODERATE')
       ORDER BY CASE impact WHEN 'HIGH' THEN 0 ELSE 1 END, qual DESC
       LIMIT 50`
    )
    .all(userId) as Partial<Variant>[];

  return { total, byImpact, topGenes, highImpact };
}

export function getUploadsForUser(userId: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT u.*, d.name as dog_name FROM uploads u
       LEFT JOIN dogs d ON u.dog_id = d.id
       WHERE u.user_id = ?
       ORDER BY u.created_at DESC`
    )
    .all(userId);
}

export function insertVariants(
  uploadId: number,
  userId: number,
  variants: Omit<Variant, 'id' | 'upload_id'>[]
) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO variants
      (upload_id, user_id, chrom, pos, ref, alt, qual, filter, genotype, depth,
       gene, gene_id, effect, impact, hgvs, annotation_raw)
    VALUES
      (@upload_id, @user_id, @chrom, @pos, @ref, @alt, @qual, @filter, @genotype, @depth,
       @gene, @gene_id, @effect, @impact, @hgvs, @annotation_raw)
  `);
  const insertMany = db.transaction((rows: object[]) => {
    for (const row of rows) stmt.run(row);
  });
  const rows = variants.map((v) => ({ ...v, upload_id: uploadId, user_id: userId }));
  insertMany(rows);
  db.prepare('UPDATE uploads SET variant_count = ? WHERE id = ?').run(rows.length, uploadId);
}

import type { GeneRecord, ZygosityVariant } from './vcf-parser';

export function insertGeneRecords(uploadId: number, userId: number, genes: GeneRecord[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO gene_records
      (upload_id, user_id, gene_name, gene_id, transcript_id, biotype,
       impact_high, impact_low, impact_moderate, impact_modifier,
       effect_frameshift, effect_missense, effect_stop_gained, effect_stop_lost, effect_start_lost,
       effect_splice_acceptor, effect_splice_donor, effect_splice_region,
       effect_synonymous, effect_intron, effect_upstream, effect_downstream,
       effect_utr3, effect_utr5, total_variants)
    VALUES
      (@upload_id, @user_id, @gene_name, @gene_id, @transcript_id, @biotype,
       @impact_high, @impact_low, @impact_moderate, @impact_modifier,
       @effect_frameshift, @effect_missense, @effect_stop_gained, @effect_stop_lost, @effect_start_lost,
       @effect_splice_acceptor, @effect_splice_donor, @effect_splice_region,
       @effect_synonymous, @effect_intron, @effect_upstream, @effect_downstream,
       @effect_utr3, @effect_utr5, @total_variants)
  `);
  const insertMany = db.transaction((rows: object[]) => { for (const r of rows) stmt.run(r); });
  insertMany(genes.map((g) => ({ ...g, upload_id: uploadId, user_id: userId })));
  db.prepare('UPDATE uploads SET variant_count = ? WHERE id = ?').run(genes.length, uploadId);
}

export function getGeneSummaryForUser(userId: number) {
  const db = getDb();
  const genes = db.prepare(`
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
    FROM gene_records WHERE user_id = ?
    GROUP BY gene_id
    ORDER BY impact_high DESC, impact_moderate DESC
  `).all(userId) as GeneRecord[];
  return genes;
}

export function insertZygosityVariants(uploadId: number, userId: number, variants: ZygosityVariant[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO zygosity_variants
      (upload_id, user_id, chrom, pos, ref, alt, qual, genotype, zygosity, depth, gene, effect, impact, hgvs)
    VALUES
      (@upload_id, @user_id, @chrom, @pos, @ref, @alt, @qual, @genotype, @zygosity, @depth, @gene, @effect, @impact, @hgvs)
  `);
  const insertMany = db.transaction((rows: object[]) => { for (const r of rows) stmt.run(r); });
  insertMany(variants.map((v) => ({ ...v, upload_id: uploadId, user_id: userId })));
  db.prepare('UPDATE uploads SET variant_count = ? WHERE id = ?').run(variants.length, uploadId);
}

export function getZygosityVariantsForUser(userId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM zygosity_variants WHERE user_id = ?
    ORDER BY CASE impact WHEN 'HIGH' THEN 0 ELSE 1 END,
             CASE zygosity WHEN 'homozygous' THEN 0 ELSE 1 END,
             qual DESC
  `).all(userId) as ZygosityVariant[];
}

export function getDogsForUser(userId: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM dogs WHERE user_id = ? ORDER BY name').all(userId);
}

export function createDog(userId: number, name: string, breed?: string, dob?: string, notes?: string) {
  const db = getDb();
  return db
    .prepare('INSERT INTO dogs (user_id, name, breed, dob, notes) VALUES (?, ?, ?, ?, ?)')
    .run(userId, name, breed ?? null, dob ?? null, notes ?? null);
}
