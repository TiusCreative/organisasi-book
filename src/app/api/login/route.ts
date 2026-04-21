import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  SESSION_COOKIE,
  createSessionToken,
  ensureBootstrapAdmin,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email dan password wajib diisi" },
        { status: 400 }
      )
    }

    await ensureBootstrapAdmin()

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "Email atau password salah" },
        { status: 401 }
      )
    }

    const validPassword = await verifyPassword(password, user.password)
    if (!validPassword) {
      return NextResponse.json(
        { message: "Email atau password salah" },
        { status: 401 }
      )
    }

    const token = await createSessionToken({ userId: user.id, role: user.role })
    await setSessionCookie(token)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    return NextResponse.json(
      {
        message: "Login berhasil",
        cookieName: SESSION_COOKIE,
        user: { id: user.id, email: user.email, role: user.role },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("API Login Error:", error)
    return NextResponse.json(
      { message: "Terjadi kesalahan internal server" },
      { status: 500 }
    )
  }
}
