import React from "react"
import { FormControl } from "./FormControl"

export type DatePickerProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  error?: string
  containerClassName?: string
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, className = "", containerClassName = "", ...props }, ref) => {
    return (
      <FormControl label={label} error={error} required={props.required} className={containerClassName}>
        <input
          ref={ref}
          type="date"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            error ? "border-red-500" : "border-slate-300 hover:border-slate-400"
          } disabled:bg-slate-50 disabled:text-slate-500 bg-white ${className}`}
          {...props}
        />
      </FormControl>
    )
  }
)

DatePicker.displayName = "DatePicker"