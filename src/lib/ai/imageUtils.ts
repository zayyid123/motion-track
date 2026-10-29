/**
 * Converts an image File to a base64 Data URL, automatically scaling down
 * high-resolution images to keep payload sizes fast and within AI vision token limits.
 */
export async function fileToDataUrl(file: File, maxDimension = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader is not supported in this environment.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const result = reader.result as string;

      if (typeof Image === 'undefined' || typeof document === 'undefined') {
        resolve(result);
        return;
      }

      let settled = false;
      const finish = (dataUrl: string) => {
        if (!settled) {
          settled = true;
          resolve(dataUrl);
        }
      };

      // Fallback timer for environments (e.g. headless jsdom) where Image does not fire onload
      const timer = setTimeout(() => finish(result), 200);

      const img = new Image();
      img.onerror = () => {
        clearTimeout(timer);
        finish(result);
      };
      img.onload = () => {
        clearTimeout(timer);
        try {
          let { width, height } = img;
          if (!width || !height || (width <= maxDimension && height <= maxDimension)) {
            finish(result);
            return;
          }

          const scale = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            finish(result);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const isPng = file.type === 'image/png' || file.type === 'image/webp';
          const format = isPng ? 'image/png' : 'image/jpeg';
          finish(canvas.toDataURL(format, 0.85));
        } catch {
          finish(result);
        }
      };

      img.src = result;
    };

    reader.readAsDataURL(file);
  });
}
