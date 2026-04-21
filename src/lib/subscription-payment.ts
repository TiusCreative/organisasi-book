import { prisma } from "./prisma"
import { addOneYear, getRenewalBaseDate } from "./subscription"

export type SubscriptionPaymentSummary = {
  id: string
  orderId: string
  provider: string
  status: string
  amount: number
  paymentType: string | null
  redirectUrl: string | null
  snapToken: string | null
  createdAt: string
  paidAt: string | null
}

export async function applySubscriptionPaymentStatusUpdate(input: {
  orderId: string
  mappedStatus: string
  paymentType?: string | null
  transactionId?: string | null
  payload: unknown
}) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { orderId: input.orderId },
    include: { organization: true },
  })

  if (!payment) {
    return null
  }

  const updatedPayment = await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: input.mappedStatus,
      paymentType: input.paymentType || payment.paymentType,
      transactionId: input.transactionId || payment.transactionId,
      paidAt: input.mappedStatus === "SETTLEMENT" ? payment.paidAt || new Date() : payment.paidAt,
      lastPayload: JSON.stringify(input.payload),
    },
  })

  if (input.mappedStatus === "SETTLEMENT") {
    const renewalBase = getRenewalBaseDate(payment.organization.subscriptionEndsAt)
    const renewedUntil = addOneYear(renewalBase)

    await prisma.organization.update({
      where: { id: payment.organizationId },
      data: {
        subscriptionPlan: "ANNUAL",
        subscriptionStatus: "ACTIVE",
        subscriptionStartsAt: payment.organization.subscriptionStartsAt || new Date(),
        subscriptionEndsAt: renewedUntil,
        status: "ACTIVE",
      },
    })
  }

  if (input.mappedStatus === "EXPIRE") {
    await prisma.organization.update({
      where: { id: payment.organizationId },
      data: {
        subscriptionStatus: "EXPIRED",
      },
    })
  }

  return updatedPayment
}

export async function getOrganizationSubscriptionPayments(organizationId: string) {
  const payments = await prisma.subscriptionPayment.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return payments.map<SubscriptionPaymentSummary>((payment) => ({
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    status: payment.status,
    amount: payment.amount,
    paymentType: payment.paymentType,
    redirectUrl: payment.redirectUrl,
    snapToken: payment.snapToken,
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
  }))
}
