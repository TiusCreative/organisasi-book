import Link from "next/link"

interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
  params: URLSearchParams
}

export default function Pagination({ currentPage, totalPages, baseUrl, params }: PaginationProps) {
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  const buildHref = (page: number) => {
    const newParams = new URLSearchParams(params)
    if (page > 1) {
      newParams.set("page", String(page))
    } else {
      newParams.delete("page")
    }
    return `${baseUrl}?${newParams.toString()}`
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-4">
      {currentPage > 1 && (
        <Link href={buildHref(currentPage - 1)} className="px-3 py-1 border rounded hover:bg-slate-50 text-sm">
          Sebelumnya
        </Link>
      )}

      {pageNumbers.map((page) => (
        <Link
          key={page}
          href={buildHref(page)}
          aria-label={`Ke halaman ${page}`}
          className={`px-3 py-1 border rounded text-sm ${
            currentPage === page ? "bg-blue-600 text-white" : "hover:bg-slate-50"
          }`}
        >
          {page}
        </Link>
      ))}

      {currentPage < totalPages && (
        <Link href={buildHref(currentPage + 1)} className="px-3 py-1 border rounded hover:bg-slate-50 text-sm">
          Berikutnya
        </Link>
      )}
      
      {currentPage < totalPages && (
        <Link href={buildHref(totalPages)} className="px-3 py-1 border rounded hover:bg-slate-50 text-sm">
          Ke Halaman Terakhir
        </Link>
      )}
    </div>
  )
}
