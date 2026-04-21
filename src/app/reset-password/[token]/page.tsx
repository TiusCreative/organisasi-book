import { notFound } from "next/navigation"
import TokenPasswordForm from "../../../components/auth/TokenPasswordForm"
import { completePasswordResetAction, validateResetToken } from "../../actions/auth"

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const reset = await validateResetToken(token)

  if (!reset) {
    notFound()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#fef3c7,_#fff7ed_45%,_#f8fafc)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-amber-700">Reset Password</h1>
          <p className="mt-2 text-sm text-slate-500">
            {reset.name} ({reset.email})
          </p>
        </div>
        <TokenPasswordForm token={token} mode="reset" action={completePasswordResetAction} />
      </div>
    </div>
  )
}
