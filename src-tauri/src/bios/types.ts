// src/types/bios.ts
// Generated for ROM Runner BIOS database v2.0.0 and schema v1.1.0

export type Region = 'USA' | 'EUR' | 'JPN' | 'World' | 'FRA' | 'GER' | 'SPA' | 'ITA' | 'NLD' | 'KOR' | 'CHN' | 'TWN' | 'HKG' | 'BRA' | 'AUS' | 'Unknown' | 'universal';

export interface BiosHash {
  md5: string | null;
  sha1?: string | null;
  crc32?: string | null;
  sha256?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  isPreferred?: boolean;
}

export interface BiosFile {
  id: string;
  name: string;
  filename: string;
  platformId: string;

  description?: string | null;
  required: boolean;
  hleFallback: boolean;
  region: Region;

  version?: string | null;
  releaseDate?: string | null;

  knownHashes: BiosHash[];
  alternateFilenames: string[];

  biosSubdirectory?: string | null;
  alternateSubdirectories: string[];

  requiredForEmulators: string[];
  optionalForEmulators: string[];

  fileSize: number | null;
  notes?: string | null;
}

export interface BiosDatabase {
  version: string;
  generatedAt?: string;
  biosFiles: BiosFile[];
  $schema?: string;
  changeLog?: Record<string, {
    date: string;
    changes: string[];
    source?: string;
  }>;
}

export type BiosVerificationStatus =
  | 'exact_match'
  | 'alternate_hash'
  | 'wrong_hash'
  | 'wrong_size'
  | 'unknown';

export interface BiosMatchResult {
  filename: string;
  filepath: string;
  file_md5: string;
  file_sha1: string;
  file_crc32: string;
  file_size: number;
  matched_bios_id: string | null;
  matched_bios_name: string | null;
  matched_platform: string | null;
  status: BiosVerificationStatus;
  notes: string;
}

export interface BiosVerificationReport {
  scanDate: string;
  biosDirectory: string;
  databaseVersion?: string;
  summary: Record<BiosVerificationStatus, number> & { total: number };
  results: BiosMatchResult[];
}
