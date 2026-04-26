"use server"

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import crypto from "crypto"

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
})

export async function uploadImageToR2(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get("file") as File
    const folder = (formData.get("folder") as string) || "catalog"
    
    if (!file) return { success: false, error: "No file uploaded" }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileExtension = file.name.split('.').pop()
    const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}.${fileExtension}`
    const key = `${folder}/${uniqueFileName}`

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })

    await r2Client.send(command)
    return { success: true, url: `${process.env.R2_PUBLIC_URL}/${key}` }
  } catch (error: any) {
    console.error("Error uploading to R2:", error)
    return { success: false, error: error.message || "Failed to upload image" }
  }
}

export async function deleteImageFromR2(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })

    await r2Client.send(command)
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting from R2:", error)
    return { success: false, error: error.message || "Failed to delete image" }
  }
}