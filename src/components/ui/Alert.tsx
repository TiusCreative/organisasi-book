import React from "react"
import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react"

export interface AlertProps {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "error"
  title?: string
  children: React.ReactNode
  onClose?: () => void
  className?: string
}

export const Alert: React.FC<AlertProps> = ({ variant = "default", title, children, onClose, className = "" }) => {
  const styles = {
    default: "bg-slate-50 border-slate-200 text-slate-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    danger: "bg-red-50 border-red-200 text-red-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  }

  const icons = {
    default: <Info className="h-5 w-5 text-slate-500" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-500" />,
    danger: <XCircle className="h-5 w-5 text-red-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${styles[variant]} ${className}`}>
      <div className="shrink-0 mt-0.5">{icons[variant]}</div>
      <div className="flex-1">{title && <h4 className="font-semibold mb-1">{title}</h4>}<div className="text-sm opacity-90">{children}</div></div>
      {onClose && <button onClick={onClose} className="shrink-0 rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100 transition-colors"><X className="h-4 w-4" /></button>}
    </div>
  )
}