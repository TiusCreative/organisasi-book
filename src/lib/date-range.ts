export interface DateRange {
  startDate: Date
  endDate: Date
}

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function endOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

function parseDateInput(value?: string) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getDefaultDateRange(referenceDate = new Date()): DateRange {
  return {
    startDate: startOfDay(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)),
    endDate: endOfDay(referenceDate),
  }
}

export function resolveDateRange(input?: { startDate?: string; endDate?: string }): DateRange {
  const defaults = getDefaultDateRange()
  const parsedStart = parseDateInput(input?.startDate)
  const parsedEnd = parseDateInput(input?.endDate)

  let startDate = parsedStart ? startOfDay(parsedStart) : defaults.startDate
  let endDate = parsedEnd ? endOfDay(parsedEnd) : defaults.endDate

  if (endDate < startDate) {
    endDate = endOfDay(startDate)
  }

  return { startDate, endDate }
}

export function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function formatDateRange(startDate: Date, endDate: Date) {
  return `${startDate.toLocaleDateString("id-ID")} s.d. ${endDate.toLocaleDateString("id-ID")}`
}
