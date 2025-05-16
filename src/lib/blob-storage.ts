import { put, del, list } from "@vercel/blob"

/**
 * Uploads a file to the Vercel Blob store
 * @param file The file to upload
 * @param prefix Optional prefix for the blob path
 * @returns The URL of the uploaded blob
 */
export async function uploadToBlob(file: File, prefix = "uploads"): Promise<string> {
  const filename = `${prefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

  const { url } = await put(filename, file, {
    access: "public",
  })

  return url
}

/**
 * Deletes a blob from the Vercel Blob store
 * @param url The URL of the blob to delete
 * @returns True if the blob was deleted successfully
 */
export async function deleteFromBlob(url: string): Promise<boolean> {
  try {
    await del(url)
    return true
  } catch (error) {
    console.error("Error deleting blob:", error)
    return false
  }
}

/**
 * Lists all blobs with a specific prefix
 * @param prefix The prefix to list blobs for
 * @returns An array of blob URLs
 */
export async function listBlobs(prefix: string): Promise<string[]> {
  const { blobs } = await list({ prefix })
  return blobs.map((blob) => blob.url)
}
