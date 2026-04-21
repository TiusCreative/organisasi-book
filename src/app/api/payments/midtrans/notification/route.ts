import { NextRequest, NextResponse } from "next/server"
import { mapMidtransTransactionStatus, verifyMidtransSignature } from "@/lib/midtrans"
import { applySubscriptionPaymentStatusUpdate } from "@/lib/subscription-payment"

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    const orderId = String(payload.order_id || "")
    const statusCode = String(payload.status_code || "")
    const grossAmount = String(payload.gross_amount || "")
    const signatureKey = String(payload.signature_key || "")

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return NextResponse.json({ message: "Payload Midtrans tidak lengkap." }, { status: 400 })
    }

    const validSignature = verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      signatureKey,
    })

    if (!validSignature) {
      return NextResponse.json({ message: "Signature Midtrans tidak valid." }, { status: 401 })
    }

    const updated = await applySubscriptionPaymentStatusUpdate({
      orderId,
      mappedStatus: mapMidtransTransactionStatus(
        String(payload.transaction_status || ""),
        payload.fraud_status ? String(payload.fraud_status) : null
      ),
      paymentType: payload.payment_type ? String(payload.payment_type) : null,
      transactionId: payload.transaction_id ? String(payload.transaction_id) : null,
      payload,
    })

    if (!updated) {
      return NextResponse.json({ message: "Order langganan tidak ditemukan." }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Midtrans notification error", error)
    return NextResponse.json({ message: "Gagal memproses notifikasi Midtrans." }, { status: 500 })
  }
}
