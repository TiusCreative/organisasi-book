import React from "react"

export type FormControlProps = {
  label?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormControl({ label, error, required, children, className = "" }: FormControlProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      )}
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}