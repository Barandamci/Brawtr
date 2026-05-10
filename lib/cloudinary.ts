const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "dmt6ax5ia";
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "Untitled";

export type MediaType = "image" | "video";

export interface UploadResult {
  url: string;
  publicId: string;
  mediaType: MediaType;
}

export async function uploadMedia(
  uri: string,
  mediaType: MediaType = "image"
): Promise<UploadResult> {
  const formData = new FormData();
  const filename = uri.split("/").pop() || "upload.jpg";
  const mimeType = mediaType === "video" ? "video/mp4" : "image/jpeg";

  formData.append("file", { uri, name: filename, type: mimeType } as unknown as Blob);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("resource_type", mediaType);

  const resourceType = mediaType === "video" ? "video" : "image";
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    mediaType,
  };
}
