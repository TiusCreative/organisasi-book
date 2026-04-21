/**
 * Mengubah angka menjadi teks dalam Bahasa Indonesia
 * Contoh: 1000000 => "Satu Juta Rupiah"
 */

const UNITS = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan']
const TENS = ['', '', 'Dua Puluh', 'Tiga Puluh', 'Empat Puluh', 'Lima Puluh', 'Enam Puluh', 'Tujuh Puluh', 'Delapan Puluh', 'Sembilan Puluh']
const SCALES = ['', 'Ribu', 'Juta', 'Miliar', 'Triliun', 'Kuadriliun']

function convertTwoDigits(num: number): string {
  if (num === 0) return ''
  if (num < 10) return UNITS[num]
  if (num < 20) {
    const teens = ['Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas', 'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas']
    return teens[num - 10]
  }
  const tens = Math.floor(num / 10)
  const ones = num % 10
  return ones === 0 ? TENS[tens] : TENS[tens] + ' ' + UNITS[ones]
}

function convertThreeDigits(num: number): string {
  if (num === 0) return ''
  const hundreds = Math.floor(num / 100)
  const remainder = num % 100

  let result = ''
  if (hundreds > 0) {
    if (hundreds === 1) {
      result = 'Seratus'
    } else {
      result = UNITS[hundreds] + ' Ratus'
    }
  }

  if (remainder > 0) {
    if (result) result += ' '
    result += convertTwoDigits(remainder)
  }

  return result
}

export function terbilang(num: number | string, includeCurrency: boolean = true): string {
  // Handle string input
  if (typeof num === 'string') {
    num = parseInt(num, 10)
  }

  // Handle zero
  if (num === 0) {
    return includeCurrency ? 'Nol Rupiah' : 'Nol'
  }

  // Handle negative
  let isNegative = false
  if (num < 0) {
    isNegative = true
    num = Math.abs(num)
  }

  // Split number into groups of three digits
  const groups: number[] = []
  while (num > 0) {
    groups.unshift(num % 1000)
    num = Math.floor(num / 1000)
  }

  // Convert each group
  const parts: string[] = []
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    if (group === 0) continue

    const groupText = convertThreeDigits(group)
    const scaleIndex = groups.length - 1 - i
    const scale = SCALES[scaleIndex]

    if (groupText) {
      if (scale) {
        // Handle special case for "Satu Ribu" -> "Seribu"
        if (scale === 'Ribu' && groupText === 'Satu') {
          parts.push('Seribu')
        } else if (scale === 'Juta' && groupText === 'Satu') {
          parts.push('Satu Juta')
        } else if (scale === 'Miliar' && groupText === 'Satu') {
          parts.push('Satu Miliar')
        } else if (scale === 'Triliun' && groupText === 'Satu') {
          parts.push('Satu Triliun')
        } else {
          parts.push(groupText + ' ' + scale)
        }
      } else {
        parts.push(groupText)
      }
    }
  }

  let result = parts.join(' ')

  // Handle negative
  if (isNegative) {
    result = 'Minus ' + result
  }

  // Add currency
  if (includeCurrency) {
    result += ' Rupiah'
  }

  return result
}

/**
 * Format number to Rupiah text with formatting
 * Example: formatRupiahText(1000000) => "Rp 1.000.000,00 (Satu Juta Rupiah)"
 */
export function formatRupiahText(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  const text = terbilang(amount, true)
  return `${formatted} (${text})`
}

/**
 * Short format for documents (just number text, no currency)
 * Example: 1500000 => "Satu Juta Lima Ratus Ribu"
 */
export function terbilangShort(num: number | string): string {
  return terbilang(num, false)
}

/**
 * Get both numeric and text representations for invoices/receipts
 */
export function getNumberInWords(amount: number): {
  numeric: string
  text: string
  textWithCurrency: string
} {
  const numericFormatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

  return {
    numeric: numericFormatted,
    text: terbilangShort(amount),
    textWithCurrency: terbilang(amount, true),
  }
}
