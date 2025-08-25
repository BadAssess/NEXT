export interface ImageFeatures {
  perceptualHashHigh: number;
  perceptualHashLow: number;
  
  dominantRed: number;
  dominantGreen: number; 
  dominantBlue: number;
  
  brightness: number;
  contrast: number;
  
  timestamp: number;
  aspectRatio: number;
  width: number;
  height: number;
}

export function calculatePerceptualHash(imageData: ImageData): { high: number; low: number } {
  const { data, width, height } = imageData;
  
  const resized = resizeToGrayscale(data, width, height, 8, 8);
  const dct = calculateDCT(resized);
  
  const median = calculateMedian(dct.slice(0, 64));
  let hashLow = 0;
  let hashHigh = 0;
  
  for (let i = 0; i < 32; i++) {
    if (dct[i] > median) {
      hashLow |= (1 << i);
    }
  }
  
  for (let i = 32; i < 64; i++) {
    if (dct[i] > median) {
      hashHigh |= (1 << (i - 32));
    }
  }
  
  return { high: hashHigh, low: hashLow };
}

export function extractDominantColor(imageData: ImageData): { r: number; g: number; b: number } {
  const { data } = imageData;
  let totalR = 0, totalG = 0, totalB = 0;
  let pixelCount = 0;
  
  for (let i = 0; i < data.length; i += 40) {
    totalR += data[i];
    totalG += data[i + 1]; 
    totalB += data[i + 2];
    pixelCount++;
  }
  
  return {
    r: Math.round(totalR / pixelCount),
    g: Math.round(totalG / pixelCount),
    b: Math.round(totalB / pixelCount)
  };
}

export function calculateBrightnessContrast(imageData: ImageData): { brightness: number; contrast: number } {
  const { data } = imageData;
  let totalBrightness = 0;
  let pixelCount = 0;
  const brightnessValues: number[] = [];
  
  for (let i = 0; i < data.length; i += 40) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    totalBrightness += brightness;
    brightnessValues.push(brightness);
    pixelCount++;
  }
  
  const avgBrightness = totalBrightness / pixelCount;
  
  let variance = 0;
  for (const brightness of brightnessValues) {
    variance += Math.pow(brightness - avgBrightness, 2);
  }
  const contrast = Math.sqrt(variance / pixelCount);
  
  return {
    brightness: Math.round(avgBrightness),
    contrast: Math.round(contrast)
  };
}

export async function extractImageFeatures(image: ImageData | HTMLImageElement | File): Promise<ImageFeatures> {
  let imageData: ImageData;

  if (typeof window === 'undefined') {
    throw new Error('Image features can only be extracted in browser environment');
  }
  
  const toImageDataFromElement = (el: HTMLImageElement): ImageData => {
    const width = el.naturalWidth;
    const height = el.naturalHeight;
    if (!width || !height) throw new Error('Image not fully loaded, cannot read dimensions');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot create Canvas context');
    ctx.drawImage(el, 0, 0);
    return ctx.getImageData(0, 0, width, height);
  };

  if (image instanceof ImageData) {
    imageData = image;
  } else if (image instanceof HTMLImageElement) {
    imageData = toImageDataFromElement(image);
  } else if (image instanceof File) {
    const blobUrl = URL.createObjectURL(image);
    try {
      const img = document.createElement('img');
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error('Image loading failed'));
      });
      img.src = blobUrl;
      await loaded;
      imageData = toImageDataFromElement(img);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } else {
    throw new Error('Unsupported image input type');
  }

  const pHash = calculatePerceptualHash(imageData);
  const dominant = extractDominantColor(imageData);
  const { brightness, contrast } = calculateBrightnessContrast(imageData);
  const timestamp = Date.now() % 4294967295;
  
  return {
    perceptualHashHigh: pHash.high,
    perceptualHashLow: pHash.low,
    dominantRed: dominant.r,
    dominantGreen: dominant.g,
    dominantBlue: dominant.b,
    brightness,
    contrast,
    timestamp,
    aspectRatio: Math.round((imageData.width / imageData.height) * 1000),
    width: imageData.width,
    height: imageData.height
  };
}

function resizeToGrayscale(data: Uint8ClampedArray, width: number, height: number, newWidth: number, newHeight: number): number[] {
  const result: number[] = [];
  const xRatio = width / newWidth;
  const yRatio = height / newHeight;
  
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * width + srcX) * 4;
      
      const gray = (data[srcIdx] + data[srcIdx + 1] + data[srcIdx + 2]) / 3;
      result.push(gray);
    }
  }
  
  return result;
}

function calculateDCT(data: number[]): number[] {
  const N = 8;
  const result: number[] = [];
  
  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          const val = data[y * N + x];
          sum += val * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
                     Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
        }
      }
      
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      result.push((1 / 4) * cu * cv * sum);
    }
  }
  
  return result;
}

function calculateMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
