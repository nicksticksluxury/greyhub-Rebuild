// Frontend image optimization utility
// Resizes images to thumbnail (300px), medium (1200px), and full (2400px) variants

const VARIANTS = {
  thumbnail: { width: 300, quality: 0.85 },
  medium: { width: 1200, quality: 0.85 },
  full: { width: 2400, quality: 0.90 }
};

/**
 * Resize an image file to a specific width while maintaining aspect ratio
 * @param {File} file - Original image file
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} - Resized image as blob
 */
const resizeImage = (file, maxWidth, quality) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Generate all optimized variants for a single image
 * @param {File} file - Original image file
 * @param {number} index - Photo index for naming
 * @returns {Promise<{original: File, thumbnail: File, medium: File, full: File}>}
 */
export const optimizeImage = async (file, index) => {
  const baseName = `photo_${index}_${Date.now()}`;
  
  const [thumbnailBlob, mediumBlob, fullBlob] = await Promise.all([
    resizeImage(file, VARIANTS.thumbnail.width, VARIANTS.thumbnail.quality),
    resizeImage(file, VARIANTS.medium.width, VARIANTS.medium.quality),
    resizeImage(file, VARIANTS.full.width, VARIANTS.full.quality)
  ]);

  return {
    original: file,
    thumbnail: new File([thumbnailBlob], `thumbnail_${baseName}.jpg`, { type: 'image/jpeg' }),
    medium: new File([mediumBlob], `medium_${baseName}.jpg`, { type: 'image/jpeg' }),
    full: new File([fullBlob], `full_${baseName}.jpg`, { type: 'image/jpeg' })
  };
};

/**
 * Optimize multiple images
 * @param {File[]} files - Array of original image files
 * @param {function} onProgress - Progress callback (current, total, stage)
 * @returns {Promise<Array<{original: File, thumbnail: File, medium: File, full: File}>>}
 */
export const optimizeImages = async (files, onProgress) => {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length, 'optimizing');
    const optimized = await optimizeImage(files[i], i);
    results.push(optimized);
  }
  
  return results;
};