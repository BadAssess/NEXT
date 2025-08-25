import { AppConfig } from '../config/app.config';
import { decryptHandles } from './fhe';
import { getNFTEncryptedHandles, hasViewPermission } from './contract';

export interface DecryptedImageFeatures {
  perceptualHashHigh?: number;
  perceptualHashLow?: number;
  dominantRed?: number;
  dominantGreen?: number;
  dominantBlue?: number;
  brightness?: number;
  contrast?: number;
  timestamp?: number;
  aspectRatio?: number;
}

export interface DecryptedAttribute {
  trait_type: string;
  value: string;
}

export interface DecryptedNFTData {
  imageFeatures: DecryptedImageFeatures;
  encryptedAttributes: DecryptedAttribute[];
}

export async function decryptNFTData(
  tokenId: bigint,
  userAddress: string
): Promise<DecryptedNFTData> {
  const contractAddress = AppConfig.zama.targetContractAddress;
  
  if (!contractAddress) {
    throw new Error('Contract address not configured');
  }
  
  const hasPermission = await hasViewPermission(tokenId, userAddress);
  if (!hasPermission) {
    throw new Error('You do not have permission to view this NFT encrypted data');
  }
  
  const { imageFeatures, encryptedAttributes } = await getNFTEncryptedHandles(tokenId, userAddress);

  const allHandles: string[] = [];
  const handleMapping: Record<string, string> = {};

  Object.entries(imageFeatures).forEach(([key, handle]) => {
    if (handle && handle !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      allHandles.push(handle);
      handleMapping[handle] = `imageFeature_${key}`;
    }
  });
  
  Object.entries(encryptedAttributes).forEach(([traitType, info]) => {
    const chunks = info?.chunks || [];
    chunks.forEach((handle, idx) => {
      if (handle && handle.startsWith('0x')) {
        allHandles.push(handle);
        handleMapping[handle] = `attribute_${traitType}_${idx}`;
      }
    });
  });
  
  if (allHandles.length === 0) {
    return {
      imageFeatures: {},
      encryptedAttributes: []
    };
  }
  
  console.log('[Decrypt] Preparing to decrypt handles count:', allHandles.length);
  const decryptedResults = await decryptHandles(contractAddress, allHandles, userAddress);
  console.log('[Decrypt] Batch decryption completed, successfully decrypted count:', Object.keys(decryptedResults).length);
  
  const decryptedImageFeatures: DecryptedImageFeatures = {};
  const decryptedAttributesList: DecryptedAttribute[] = [];

  Object.entries(decryptedResults).forEach(([handle, value]) => {
    const mappingKey = handleMapping[handle];
    if (!mappingKey) return;
    if (mappingKey.startsWith('imageFeature_')) {
      const featureName = mappingKey.replace('imageFeature_', '') as keyof DecryptedImageFeatures;
      decryptedImageFeatures[featureName] = Number(value);
    }
  });
  
  const decoder = new TextDecoder();
  for (const [traitType, info] of Object.entries(encryptedAttributes)) {
    const chunks = info?.chunks || [];
    if (chunks.length === 0) continue;
    const bytes: number[] = [];
    let allChunksPresent = true;
    for (let i = 0; i < chunks.length; i++) {
      const h = chunks[i];
      const v = decryptedResults[h];
      if (v === undefined) { allChunksPresent = false; break; }
      const u32 = Number(v) >>> 0;
      // Use little-endian to match the packing in encryptAttributeWithProof
      bytes.push(u32 & 0xff, (u32 >>> 8) & 0xff, (u32 >>> 16) & 0xff, (u32 >>> 24) & 0xff);
    }
    if (!allChunksPresent) continue;
    const totalBytes = Math.max(0, Number(info.totalBytes || 0));
    const finalBytes = bytes.slice(0, totalBytes);
    const valueStr = decoder.decode(new Uint8Array(finalBytes));
    decryptedAttributesList.push({ trait_type: traitType, value: valueStr });
  }
  
  return {
    imageFeatures: decryptedImageFeatures,
    encryptedAttributes: decryptedAttributesList
  };
}

export async function decryptImageFeatures(
  tokenId: bigint,
  userAddress: string
): Promise<DecryptedImageFeatures> {
  const result = await decryptNFTData(tokenId, userAddress);
  return result.imageFeatures;
}

export async function decryptAttributes(
  tokenId: bigint,
  userAddress: string
): Promise<DecryptedAttribute[]> {
  const result = await decryptNFTData(tokenId, userAddress);
  return result.encryptedAttributes;
}

export async function decryptSpecificImageFeature(
  tokenId: bigint,
  userAddress: string,
  featureName: keyof DecryptedImageFeatures
): Promise<number | undefined> {
  const contractAddress = AppConfig.zama.targetContractAddress;
  
  if (!contractAddress) {
    throw new Error('Contract address not configured');
  }
  
  const hasPermission = await hasViewPermission(tokenId, userAddress);
  if (!hasPermission) {
    throw new Error('You do not have permission to view this NFT encrypted data');
  }
  
  const { imageFeatures } = await getNFTEncryptedHandles(tokenId);
  const handle = imageFeatures[featureName];
  
  if (!handle || handle === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return undefined;
  }
  
  const results = await decryptHandles(contractAddress, [handle], userAddress);
  const value = results[handle];
  
  return value ? Number(value) : undefined;
}

export function formatImageFeatures(features: DecryptedImageFeatures): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  if (features.perceptualHashHigh !== undefined && features.perceptualHashLow !== undefined) {
    const highHex = features.perceptualHashHigh.toString(16).padStart(8, '0');
    const lowHex = features.perceptualHashLow.toString(16).padStart(8, '0');
    formatted['Perceptual Hash'] = `${highHex}${lowHex}`;
  }
		
  if (features.dominantRed !== undefined && features.dominantGreen !== undefined && features.dominantBlue !== undefined) {
    formatted['Dominant Color'] = `RGB(${features.dominantRed}, ${features.dominantGreen}, ${features.dominantBlue})`;
  }
  
  if (features.brightness !== undefined) {
    formatted['Brightness'] = `${features.brightness}/255`;
  }
  
  if (features.contrast !== undefined) {
    formatted['Contrast'] = `${features.contrast}/255`;
  }
  
  if (features.timestamp !== undefined) {
    const date = new Date(features.timestamp * 1000);
    formatted['Creation Time'] = date.toLocaleString();
  }
  
  if (features.aspectRatio !== undefined) {
    const ratio = features.aspectRatio / 1000;
    formatted['Aspect Ratio'] = ratio.toFixed(2);
  }
  
  return formatted;
}
