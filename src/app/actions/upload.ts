"use server"

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import crypto from "crypto"

export async function uploadImageToR2(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get("file") as File
    if (!file) return { success: false, error: "No file uploaded" }

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
    })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileExtension = file.name.split('.').pop()
    const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}.${fileExtension}`
    const key = `settings/${uniqueFileName}`

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })

    await r2.send(command)
    return { success: true, url: `${process.env.R2_PUBLIC_URL}/${key}` }
  } catch (error: any) {
    console.error("Error uploading to R2:", error)
    return { success: false, error: error.message || "Failed to upload image" }
  }
}