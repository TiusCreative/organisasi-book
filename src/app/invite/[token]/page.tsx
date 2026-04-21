import { notFound } from "next/navigation"
import TokenPasswordForm from "../../../components/auth/TokenPasswordForm"
import { completeInvitePasswordSetupAction, validateInviteToken } from "../../actions/auth"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await validateInviteToken(token)

  if (!invite) {
    notFound()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_50%,_#e2e8f0)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-blue-700">Aktivasi Akun</h1>
          <p className="mt-2 text-sm text-slate-500">
            {invite.name} ({invite.email})
          </p>
        </div>
        <TokenPasswordForm token={token} mode="invite" action={completeInvitePasswordSetupAction} />
      </div>
    </div>
  )
}
