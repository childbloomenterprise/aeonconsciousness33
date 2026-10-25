/** Reduce phone photos on the device before any external upload. */
export function photoDimensions(width: number, height: number, maximum = 1600) {
  const scale = Math.min(1, maximum / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export async function preparePhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 20 MB.");
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            "This photo could not be opened. Try another JPEG, PNG or WebP image.",
          ),
        );
      image.src = objectUrl;
    });
    const size = photoDimensions(image.naturalWidth, image.naturalHeight);
    if (
      size.width === image.naturalWidth &&
      size.height === image.naturalHeight &&
      file.size <= 1024 * 1024
    )
      return file;
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) {
      if (file.size <= 3 * 1024 * 1024) return file;
      throw new Error(
        "This browser could not resize your photo. Choose a smaller image or type a description.",
      );
    }
    context.fillStyle = "white";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size > 3 * 1024 * 1024)
      throw new Error(
        "This photo is still too large. Choose a smaller image or type a description.",
      );
    return new File([blob], "journey-photo.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
