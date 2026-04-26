import React from "react"
import { FormControl } from "./FormControl"

export type DateRangePickerProps = {
  label?: string
  error?: string
  required?: boolean
  containerClassName?: string
  startDateProps?: React.InputHTMLAttributes<HTMLInputElement>
  endDateProps?: React.InputHTMLAttributes<HTMLInputElement>
}

export const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  ({ label, error, required, containerClassName = "", startDateProps, endDateProps }, ref) => {
    return (
      <FormControl label={label} error={error} required={required} className={containerClassName}>
        <div ref={ref} className="flex items-center gap-2">
          <input
            type="date"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              error ? "border-red-500" : "border-slate-300 hover:border-slate-400"
            } disabled:bg-slate-50 disabled:text-slate-500 bg-white`}
            {...startDateProps}
          />
          <span className="text-slate-500 text-sm font-medium">s/d</span>
          <input
            type="date"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              error ? "border-red-500" : "border-slate-300 hover:border-slate-400"
            } disabled:bg-slate-50 disabled:text-slate-500 bg-white`}
            {...endDateProps}
          />
        </div>
      </FormControl>
    )
  }
)

DateRangePicker.displayName = "DateRangePicker"