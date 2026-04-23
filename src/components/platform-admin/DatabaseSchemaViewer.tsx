"use client"

import { useState, useEffect } from "react"
import { Code, Copy, Check, Download, Database, Table, FileJson } from "lucide-react"
import { getPrismaSchema, generateSupabaseSql } from "../../app/actions/backup-restore"

interface ModelField {
  name: string
  type: string
  attributes: string[]
  isOptional: boolean
}

interface Model {
  name: string
  fields: ModelField[]
}

export default function DatabaseSchemaViewer() {
  const [activeTab, setActiveTab] = useState<"prisma" | "sql" | "diagram">("prisma")
  const [prismaContent, setPrismaContent] = useState<string>("")
  const [sqlContent, setSqlContent] = useState<string>("")
  const [models, setModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  useEffect(() => {
    loadSchema()
  }, [])

  const loadSchema = async () => {
    setIsLoading(true)
    try {
      const [prismaResult, sqlResult] = await Promise.all([
        getPrismaSchema(),
        generateSupabaseSql(),
      ])

      setPrismaContent(prismaResult.content)
      setSqlContent(sqlResult.sql)
      setModels(sqlResult.models || [])
    } catch (error) {
      console.error("Failed to load schema:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const generateMermaidDiagram = () => {
    let diagram = "erDiagram\n"

    for (const model of models) {
      diagram += `  ${model.name} {\n`
      for (const field of model.fields) {
        diagram += `    ${field.type} ${field.name}\n`
      }
      diagram += "  }\n"
    }

    diagram += "\n  %% Relationships\n"
    for (const model of models) {
      for (const field of model.fields) {
        if (field.name.endsWith("Id") && field.name !== "id") {
          const relatedModel = field.name.replace("Id", "").replace(/s$/, "")
          const relatedModelFound = models.find(m =>
            m.name.toLowerCase() === relatedModel.toLowerCase() ||
            m.name === relatedModel.charAt(0).toUpperCase() + relatedModel.slice(1)
          )
          if (relatedModelFound) {
            diagram += `  ${model.name} ||--o{ ${relatedModelFound.name} : "${field.name}"\n`
          }
        }
      }
    }

    return diagram
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full border-b-2 border-slate-900" style={{ width: "2rem", height: "2rem" }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("prisma")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === "prisma"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-800"
          }`}
        >
          <Code size={18} />
          Prisma Schema
        </button>
        <button
          onClick={() => setActiveTab("sql")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === "sql"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-800"
          }`}
        >
          <Database size={18} />
          SQL (Supabase)
        </button>
        <button
          onClick={() => setActiveTab("diagram")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === "diagram"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-800"
          }`}
        >
          <Table size={18} />
          ER Diagram
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {activeTab === "prisma" && `${models.length} models defined`}
          {activeTab === "sql" && "PostgreSQL DDL for Supabase"}
          {activeTab === "diagram" && "Entity Relationship Diagram"}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleCopy(activeTab === "prisma" ? prismaContent : sqlContent)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() =>
              handleDownload(
                activeTab === "prisma" ? prismaContent : sqlContent,
                activeTab === "prisma" ? "schema.prisma" : "supabase-schema.sql"
              )
            }
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-900">
        {activeTab === "prisma" && (
          <pre className="max-h-[500px] overflow-y-auto p-4 text-xs text-slate-300">
            <code>{prismaContent}</code>
          </pre>
        )}

        {activeTab === "sql" && (
          <pre className="max-h-[500px] overflow-y-auto p-4 text-xs text-slate-300">
            <code>{sqlContent}</code>
          </pre>
        )}

        {activeTab === "diagram" && (
          <div className="p-4">
            <div className="mb-4 rounded-lg bg-slate-800 p-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-300">Mermaid ER Diagram</h4>
              <pre className="overflow-x-auto text-xs text-slate-400">
                <code>{generateMermaidDiagram()}</code>
              </pre>
            </div>

            {/* Model Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {models.map((model) => (
                <div
                  key={model.name}
                  onClick={() => setSelectedModel(selectedModel === model.name ? null : model.name)}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    selectedModel === model.name
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-700 bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Table size={16} className="text-blue-400" />
                    <h5 className="font-semibold text-slate-200">{model.name}</h5>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {model.fields.length} fields
                  </p>

                  {selectedModel === model.name && (
                    <div className="mt-3 border-t border-slate-700 pt-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="pb-2">Field</th>
                            <th className="pb-2">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {model.fields.slice(0, 10).map((field) => (
                            <tr key={field.name}>
                              <td className="py-1 text-slate-300">
                                {field.name}
                                {field.attributes.includes("@id") && (
                                  <span className="ml-1 text-blue-400">(PK)</span>
                                )}
                              </td>
                              <td className="py-1 text-slate-400">
                                {field.type}
                                {field.isOptional && "?"}
                              </td>
                            </tr>
                          ))}
                          {model.fields.length > 10 && (
                            <tr>
                              <td colSpan={2} className="py-1 text-center text-slate-500">
                                ... {model.fields.length - 10} more fields
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Model Reference */}
      {activeTab === "prisma" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 font-semibold text-slate-800">Model Reference</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {models.map((model) => (
              <div
                key={model.name}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <FileJson size={14} className="text-blue-500" />
                <span className="font-medium text-slate-700">{model.name}</span>
                <span className="text-xs text-slate-400">({model.fields.length})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
