"use client"

import { useMemo, useState, useTransition } from "react"
import { Eye, EyeOff } from "lucide-react"
import {
  createAdminManagedUser,
  generateManagedUserInvite,
  generateManagedUserReset,
  deleteManagedUser,
  updateManagedUser,
} from "../../app/actions/auth"
import { ALL_MODULE_PERMISSIONS, MODULE_PERMISSION_LABELS } from "../../lib/permissions"

interface UserItem {
  id: string
  name: string
  email: string
  role: "ADMIN" | "MANAGER" | "STAFF" | "VIEWER"
  permissions: string[]
  status: string
  organizationId: string | null
}

interface OrganizationOption {
  id: string
  name: string
}

interface UserManagementProps {
  initialUsers: UserItem[]
  organizations: OrganizationOption[]
}

const defaultForm = {
  id: "",
  name: "",
  email: "",
  password: "",
  role: "STAFF",
  permissions: [] as string[],
  status: "ACTIVE",
  organizationId: "",
}

export default function UserManagement({ initialUsers, organizations }: UserManagementProps) {
  const [users, setUsers] = useState(initialUsers)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState(defaultForm)
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)

  const title = useMemo(() => (form.id ? "Edit User" : "Tambah User"), [form.id])

  const openCreate = () => {
    setError("")
    setForm(defaultForm)
    setShowModal(true)
  }

  const openEdit = (user: UserItem) => {
    setError("")
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      permissions: user.permissions || [],
      status: user.status,
      organizationId: user.organizationId || "",
    })
    setShowModal(true)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    startTransition(async () => {
      const formData = new FormData()
      formData.set("id", form.id)
      formData.set("name", form.name)
      formData.set("email", form.email)
      formData.set("password", form.password)
      formData.set("role", form.role)
      formData.set("status", form.status)
      formData.set("organizationId", form.organizationId)

      for (const permission of form.permissions) {
        formData.append("permissions", permission)
      }

      const result = form.id
        ? await updateManagedUser(formData)
        : await createAdminManagedUser(formData)

      if (!result.success) {
        setError(result.error || "Gagal menyimpan user.")
        return
      }

      window.location.reload()
    })
  }

  const handleDelete = (userId: string) => {
    if (!window.confirm("Hapus user ini?")) {
      return
    }

    startTransition(async () => {
      const result = await deleteManagedUser(userId)
      if (!result.success) {
        setError(result.error || "Gagal menghapus user.")
        return
      }

      setUsers((current) => current.filter((user) => user.id !== userId))
    })
  }

  const copyAccessLink = async (path: string, label: string) => {
    const url = `${window.location.origin}${path}`
    await navigator.clipboard.writeText(url)
    window.alert(`${label} berhasil disalin:\n${url}`)
  }

  const handleInvite = (userId: string) => {
    startTransition(async () => {
      const result = await generateManagedUserInvite(userId)
      if (!result.success || !result.path) {
        setError(result.error || "Gagal membuat link undangan.")
        return
      }

      await copyAccessLink(result.path, "Link undangan")
    })
  }

  const handleReset = (userId: string) => {
    startTransition(async () => {
      const result = await generateManagedUserReset(userId)
      if (!result.success || !result.path) {
        setError(result.error || "Gagal membuat link reset password.")
        return
      }

      await copyAccessLink(result.path, "Link reset password")
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Daftar User</h2>
          <p className="text-sm text-slate-500 mt-1">Hanya admin yang bisa membuat email dan password user baru.</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
        >
          + Tambah User
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-bold">Nama</th>
              <th className="px-4 py-3 font-bold">Email</th>
              <th className="px-4 py-3 font-bold">Role</th>
              <th className="px-4 py-3 font-bold">Izin Modul</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Organisasi</th>
              <th className="px-4 py-3 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {users.map((user) => {
              const organizationName = organizations.find((org) => org.id === user.organizationId)?.name || "-"
              return (
                <tr key={user.id}>
                  <td className="px-4 py-4 font-medium text-slate-800">{user.name}</td>
                  <td className="px-4 py-4 text-slate-600">{user.email}</td>
                  <td className="px-4 py-4 text-slate-600">{user.role}</td>
                  <td className="px-4 py-4 text-slate-600">
                    {user.permissions.length > 0 ? `${user.permissions.length} modul` : "Default role"}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{organizationName}</td>
                  <td className="px-4 py-4 text-right">
                    <button className="mr-3 text-emerald-600 hover:underline" onClick={() => handleInvite(user.id)}>
                      Invite
                    </button>
                    <button className="mr-3 text-amber-600 hover:underline" onClick={() => handleReset(user.id)}>
                      Reset
                    </button>
                    <button className="mr-3 text-blue-600 hover:underline" onClick={() => openEdit(user)}>
                      Edit
                    </button>
                    <button className="text-red-600 hover:underline" onClick={() => handleDelete(user.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Belum ada user. Tambahkan user pertama dari tombol di atas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Nama</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">
                    {form.id ? "Password Baru" : "Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12"
                      placeholder={form.id ? "Kosongkan jika tidak diubah" : "Masukkan password awal"}
                      required={!form.id}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Role</label>
                  <select
                    value={form.role}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as typeof current.role }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="STAFF">STAFF</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Organisasi</label>
                  <input
                    value={organizations[0]?.name || "-"}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Izin Modul</label>
                <div className="grid gap-2 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
                  {ALL_MODULE_PERMISSIONS.map((permission) => {
                    const checked = form.permissions.includes(permission)
                    return (
                      <label key={permission} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              permissions: event.target.checked
                                ? [...current.permissions, permission]
                                : current.permissions.filter((item) => item !== permission),
                            }))
                          }
                        />
                        <span>{MODULE_PERMISSION_LABELS[permission]}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Kosongkan semua jika Anda ingin user mengikuti permission default dari role.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
