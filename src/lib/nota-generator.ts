/**
 * Sistem auto-increment untuk nomor nota
 * Contoh: BKK-2024-0001, BKK-2024-0002
 */

import { prisma } from './prisma'

export interface NoteNumberOptions {
  organizationId: string
  code: string // e.g., 'BKK', 'BKM', 'BMP', 'INV', 'PO'
  year?: number // default: current year
  prefix?: string // custom prefix, default: code
  padLength?: number // padding length, default: 4
}

/**
 * Generate next nota number with auto-increment
 * Returns: "BKK-2024-0001" or "INV-2024-000001" etc
 */
export async function generateNoteNumber(options: NoteNumberOptions): Promise<string> {
  const {
    organizationId,
    code,
    year = new Date().getFullYear(),
    prefix = code,
    padLength = 4,
  } = options

  // Use transaction to ensure atomicity
  const noteSequence = await prisma.noteSequence.upsert({
    where: {
      organizationId_code_year: {
        organizationId,
        code,
        year,
      },
    },
    update: {
      sequence: {
        increment: 1,
      },
      updatedAt: new Date(),
    },
    create: {
      organizationId,
      code,
      year,
      sequence: 1,
      prefix,
    },
  })

  const paddedSequence = String(noteSequence.sequence).padStart(padLength, '0')
  const noteNumber = `${prefix}-${year}-${paddedSequence}`

  // Update lastNote
  await prisma.noteSequence.update({
    where: { id: noteSequence.id },
    data: { lastNote: noteNumber },
  })

  return noteNumber
}

/**
 * Get current sequence info without incrementing
 */
export async function getCurrentNoteSequence(options: Omit<NoteNumberOptions, 'padLength'>) {
  const {
    organizationId,
    code,
    year = new Date().getFullYear(),
    prefix = code,
  } = options

  const sequence = await prisma.noteSequence.findUnique({
    where: {
      organizationId_code_year: {
        organizationId,
        code,
        year,
      },
    },
  })

  if (!sequence) {
    return {
      sequence: 0,
      lastNote: null,
      nextNumber: `${prefix}-${year}-0001`,
    }
  }

  const nextSequence = sequence.sequence + 1
  const nextNumber = `${prefix}-${year}-${String(nextSequence).padStart(4, '0')}`

  return {
    sequence: sequence.sequence,
    lastNote: sequence.lastNote,
    nextNumber,
  }
}

/**
 * Reset sequence for a code/year (usually for new fiscal year)
 */
export async function resetNoteSequence(options: Omit<NoteNumberOptions, 'padLength'>) {
  const {
    organizationId,
    code,
    year = new Date().getFullYear(),
  } = options

  return prisma.noteSequence.updateMany({
    where: {
      organizationId,
      code,
      year,
    },
    data: {
      sequence: 0,
      lastNote: null,
    },
  })
}

/**
 * Get all active sequences for an organization
 */
export async function getOrganizationNoteSequences(organizationId: string) {
  return prisma.noteSequence.findMany({
    where: { organizationId },
    orderBy: [{ code: 'asc' }, { year: 'desc' }],
  })
}

/**
 * Check if nota number exists (for validation)
 */
export async function checkNoteNumberExists(organizationId: string, noteNumber: string): Promise<boolean> {
  // Parse note number: PREFIX-YEAR-SEQUENCE
  const parts = noteNumber.split('-')
  if (parts.length !== 3) return false

  const [code, year, sequence] = parts

  const record = await prisma.noteSequence.findUnique({
    where: {
      organizationId_code_year: {
        organizationId,
        code,
        year: parseInt(year, 10),
      },
    },
  })

  if (!record) return false

  // Check if sequence is within range
  const seq = parseInt(sequence, 10)
  return seq > 0 && seq <= record.sequence
}

/**
 * Predefined note codes for Indonesian accounting
 */
export const INDONESIAN_NOTE_CODES = {
  BKK: { name: 'Bukti Kas Keluar', prefix: 'BKK' },
  BKM: { name: 'Bukti Kas Masuk', prefix: 'BKM' },
  BMP: { name: 'Bukti Penerimaan Barang', prefix: 'BMP' },
  INV: { name: 'Invoice', prefix: 'INV' },
  PO: { name: 'Purchase Order', prefix: 'PO' },
  DO: { name: 'Delivery Order', prefix: 'DO' },
  MEMO: { name: 'Memo', prefix: 'MEMO' },
  OPNAME: { name: 'Opname', prefix: 'OPNAME' },
  JU: { name: 'Jurnal Umum', prefix: 'JU' },
}

/**
 * Format nota number for display
 */
export function formatNoteNumber(noteNumber: string): string {
  // BKK-2024-0001 => BKK / 2024 / 0001
  const parts = noteNumber.split('-')
  if (parts.length === 3) {
    return `${parts[0]} / ${parts[1]} / ${parts[2]}`
  }
  return noteNumber
}

/**
 * Parse nota number into components
 */
export function parseNoteNumber(noteNumber: string): { code: string; year: number; sequence: number } | null {
  const parts = noteNumber.split('-')
  if (parts.length !== 3) return null

  const code = parts[0]
  const year = parseInt(parts[1], 10)
  const sequence = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(sequence)) return null

  return { code, year, sequence }
}
