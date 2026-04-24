"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { requireCurrentOrganization, requireOrganizationAdmin } from "../../lib/auth"
import {
  createMidtransSnapTransaction,
  getMidtransTransactionStatus,
  isMidtransConfigured,
  mapMidtransTransactionStatus,
} from "../../lib/midtrans"
import {
  applySubscriptionPaymentStatusUpdate,
  getOrganizationSubscriptionPayments,
} from "../../lib/subscription-payment"
import { getSubscriptionPackageByCode, requirePackageAmountIdr } from "@/lib/subscription-packages"

function buildOrderId(organizationId: string) {
  return `SUB-${organizationId.slice(0, 8)}-${Date.now()}`
}

export async function createMidtransSubscriptionPayment(packageCode: string) {
  const { organization, user } = await requireCurrentOrganization({ allowExpired: true })

  if (user.role !== "ADMIN") {
    return { success: false, error: "Hanya admin organisasi yang dapat membuat tagihan langganan." }
  }

  if (!isMidtransConfigured()) {
    return { success: false, error: "Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY terlebih dahulu." }
  }

  const pkg = await getSubscriptionPackageByCode(packageCode)
  if (!pkg || !pkg.isActive) {
    return { success: false, error: "Paket berlangganan tidak valid." }
  }

  const existingPending = await prisma.subscriptionPayment.findFirst({
    where: {
      organizationId: organization.id,
      provider: "MIDTRANS",
      status: "PENDING",
      redirectUrl: { not: null },
      plan: pkg.code,
    },
    orderBy: { createdAt: "desc" },
  })

  if (existingPending?.redirectUrl) {
    return {
      success: true,
      redirectUrl: existingPending.redirectUrl,
      snapToken: existingPending.snapToken,
      reused: true,
    }
  }

  const orderId = buildOrderId(organization.id)
  let amount = 0
  try {
    amount = requirePackageAmountIdr(pkg)
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Harga paket tidak valid." }
  }

  const snap = await createMidtransSnapTransaction({
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    item_details: [
      {
        id: `SUBSCRIPTION-${pkg.code}`,
        price: amount,
        quantity: 1,
        name: `Langganan OrgBook (${pkg.name}) - ${organization.name}`,
      },
    ],
    customer_details: {
      first_name: user.name,
      email: user.email,
      phone: user.phone || organization.phone || undefined,
    },
  })

  await prisma.subscriptionPayment.create({
    data: {
      organizationId: organization.id,
      orderId,
      provider: "MIDTRANS",
      plan: pkg.code,
      years: 1,
      amount,
      currency: "IDR",
      status: "PENDING",
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastPayload: JSON.stringify(snap),
    },
  })

  revalidatePath("/berlangganan")
  return {
    success: true,
    redirectUrl: snap.redirect_url,
    snapToken: snap.token,
  }
}

export async function checkMidtransSubscriptionStatus(orderId: string) {
  const { organization, user } = await requireCurrentOrganization({ allowExpired: true })

  if (user.role !== "ADMIN") {
    return { success: false, error: "Hanya admin organisasi yang dapat memeriksa status Midtrans." }
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { orderId },
    select: { orderId: true, provider: true, organizationId: true },
  })

  if (!payment || payment.organizationId !== organization.id) {
    return { success: false, error: "Pembayaran tidak ditemukan di organisasi Anda." }
  }

  if (payment.provider !== "MIDTRANS") {
    return { success: false, error: "Cek status hanya berlaku untuk pembayaran Midtrans." }
  }

  const statusPayload = await getMidtransTransactionStatus(orderId)
  const transactionStatus = String(statusPayload.transaction_status || "")
  const mappedStatus = mapMidtransTransactionStatus(
    transactionStatus,
    statusPayload.fraud_status ? String(statusPayload.fraud_status) : null
  )

  const updated = await applySubscriptionPaymentStatusUpdate({
    orderId,
    mappedStatus,
    paymentType: statusPayload.payment_type ? String(statusPayload.payment_type) : null,
    transactionId: statusPayload.transaction_id ? String(statusPayload.transaction_id) : null,
    payload: statusPayload,
  })

  revalidatePath("/berlangganan")
  return { success: true, payment: updated }
}

export async function getSubscriptionPaymentsRealtime() {
  const { organization } = await requireCurrentOrganization({ allowExpired: true })

  const latestPending = await prisma.subscriptionPayment.findFirst({
    where: {
      organizationId: organization.id,
      provider: "MIDTRANS",
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: { orderId: true },
  })

  if (latestPending && isMidtransConfigured()) {
    try {
      const statusPayload = await getMidtransTransactionStatus(latestPending.orderId)
      const mappedStatus = mapMidtransTransactionStatus(
        String(statusPayload.transaction_status || ""),
        statusPayload.fraud_status ? String(statusPayload.fraud_status) : null
      )

      await applySubscriptionPaymentStatusUpdate({
        orderId: latestPending.orderId,
        mappedStatus,
        paymentType: statusPayload.payment_type ? String(statusPayload.payment_type) : null,
        transactionId: statusPayload.transaction_id ? String(statusPayload.transaction_id) : null,
        payload: statusPayload,
      })
    } catch {
      // Keep page usable even if Midtrans status check temporarily fails.
    }
  }

  return {
    success: true,
    payments: await getOrganizationSubscriptionPayments(organization.id),
  }
}

export async function extendSubscriptionManually(formData: FormData) {
  const { organization } = await requireCurrentOrganization({ allowExpired: true })
  await requireOrganizationAdmin({ allowExpired: true })

  const years = Math.max(1, Number(formData.get("years") || "1"))

  const baseDate =
    organization.subscriptionEndsAt && new Date(organization.subscriptionEndsAt).getTime() > Date.now()
      ? new Date(organization.subscriptionEndsAt)
      : new Date()

  const nextEndDate = new Date(baseDate)
  nextEndDate.setFullYear(nextEndDate.getFullYear() + years)

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: "ACTIVE",
      subscriptionPlan: "ANNUAL",
      subscriptionStartsAt: organization.subscriptionStartsAt || new Date(),
      subscriptionEndsAt: nextEndDate,
      status: "ACTIVE",
    },
  })

  await prisma.subscriptionPayment.create({
    data: {
      organizationId: organization.id,
      orderId: `MANUAL-${organization.id.slice(0, 8)}-${Date.now()}`,
      provider: "MANUAL",
      plan: "ANNUAL",
      years,
      amount: 0,
      currency: "IDR",
      status: "SETTLEMENT",
      paidAt: new Date(),
      lastPayload: JSON.stringify({ source: "manual-admin-extension" }),
    },
  })

  revalidatePath("/berlangganan")
  revalidatePath("/")
  return { success: true }
}
