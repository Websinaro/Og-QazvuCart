/**
 * Client-side helper for unsigned Cloudinary uploads.
 *
 * "Unsigned" means the browser uploads directly to Cloudinary using a
 * pre-configured upload preset — no API secret is ever exposed to the
 * client, and no server round-trip is needed. Only two PUBLIC values are
 * required, both safe to ship to the browser:
 *
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   - your Cloudinary cloud name
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET - an unsigned upload preset
 *
 * Create the preset in the Cloudinary dashboard under
 * Settings -> Upload -> Upload presets -> Add upload preset, and set its
 * "Signing Mode" to "Unsigned". Optionally restrict it to an images-only
 * folder and set a max file size / allowed formats there too, since an
 * unsigned preset accepts uploads from anyone who has the preset name.
 */

export class CloudinaryConfigError extends Error {}

function getCloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new CloudinaryConfigError(
      'Image upload is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and ' +
        'NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET (see .env.example).'
    );
  }

  return { cloudName, uploadPreset };
}

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

/**
 * Uploads a single image file directly to Cloudinary using an unsigned
 * upload preset, and returns the resulting HTTPS URL to store.
 */
export async function uploadImageToCloudinary(
  file: File,
  options?: { folder?: string; onProgress?: (percent: number) => void }
): Promise<CloudinaryUploadResult> {
  const { cloudName, uploadPreset } = getCloudinaryConfig();

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG, WEBP, AVIF, or GIF image.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Image is too large. Please choose a file under 8MB.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  if (options?.folder) {
    formData.append('folder', options.folder);
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // Use XHR (not fetch) only so we can report upload progress for a nicer
  // UI on slower connections; falls back cleanly if onProgress is unused.
  const json: {
    secure_url?: string;
    public_id?: string;
    width?: number;
    height?: number;
    error?: { message?: string };
  } = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    if (options?.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress!(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error('Cloudinary returned an unexpected response.'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading the image.'));
    xhr.send(formData);
  });

  if (!json.secure_url || !json.public_id) {
    throw new Error(json.error?.message || 'Image upload failed. Please try again.');
  }

  return {
    url: json.secure_url,
    publicId: json.public_id,
    width: json.width ?? 0,
    height: json.height ?? 0,
  };
}
