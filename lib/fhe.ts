import { getAddress } from 'viem';
import { AppConfig } from '../config/app.config';
import { keccak256, hexToBytes, bytesToHex, isHex, toHex } from 'viem';

type FhevmInstance = Record<string, unknown>;
let instance: FhevmInstance | undefined;
function formatFriendlyError(original: unknown, context: string): string {
	const raw = original instanceof Error ? (original.message || String(original)) : String(original);
	const lower = raw.toLowerCase();
	let hint = '';
	if (lower.includes('504') || lower.includes('timeout') || lower.includes('aborterror')) {
		hint = 'Request timeout, please try again later. Check if network/VPN/proxy is stable';
	} else if (lower.includes('502') || lower.includes('bad gateway') || lower.includes('gateway')) {
		hint = 'Relayer service temporarily unavailable (502), please try again later or refresh the page';
	} else if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('fetch failed')) {
		hint = 'Network connection error or blocked by browser, please check network/VPN/proxy settings';
	} else if (lower.includes('script') && lower.includes('load') && lower.includes('sdk')) {
		hint = 'FHE SDK script loading failed, please check CDN accessibility or try again later';
	}
	const friendly = hint ? `${context}: ${hint}` : `${context}: Operation failed`;
	return `${friendly} | Details: ${raw}`;
}

type SdkLike = {
	initSDK: () => Promise<void>;
	createInstance: (cfg: Record<string, unknown>) => Promise<FhevmInstance>;
	SepoliaConfig: Record<string, unknown>;
};

async function resolveSdk(): Promise<SdkLike | undefined> {
	const g = globalThis as unknown as Record<string, unknown>;
	const direct: Partial<SdkLike> = {
		initSDK: g.initSDK as SdkLike['initSDK'],
		createInstance: g.createInstance as SdkLike['createInstance'],
		SepoliaConfig: g.SepoliaConfig as SdkLike['SepoliaConfig']
	};
	const candidates: Array<Partial<SdkLike> | undefined> = [
		g.fhevm as Partial<SdkLike> | undefined,
		g.relayerSDK as Partial<SdkLike> | undefined,
		direct,
		g['@zama-fhe/relayer-sdk'] as Partial<SdkLike> | undefined,
		g.ZamaRelayerSDK as Partial<SdkLike> | undefined,
		g.RelayerSDK as Partial<SdkLike> | undefined,
		g.ZamaSDK as Partial<SdkLike> | undefined,
	];
	for (const c of candidates) {
		if (c && typeof c.initSDK === 'function' && typeof c.createInstance === 'function' && c.SepoliaConfig) {
			return c as SdkLike;
		}
	}
	if (typeof window !== 'undefined') {
		try {
			const cdnUrl = 'https://cdn.zama.ai/relayer-sdk-js/0.1.0-9/relayer-sdk-js.js';
			const esm: unknown = await import(/* webpackIgnore: true */ cdnUrl);
			const m = esm as Record<string, unknown>;
			const maybe: Partial<SdkLike> = {
				initSDK: m.initSDK as SdkLike['initSDK'],
				createInstance: m.createInstance as SdkLike['createInstance'],
				SepoliaConfig: m.SepoliaConfig as SdkLike['SepoliaConfig']
			};
			if (maybe.initSDK && maybe.createInstance && maybe.SepoliaConfig) {
				return maybe as SdkLike;
			}
		} catch (err) {
			console.error('[FHE] CDN dynamic import failed:', err);
		}
	}
	return undefined;
}

export async function getFheInstance(): Promise<FhevmInstance | undefined> {
	if (!instance) {
		if (typeof window !== 'undefined') {
			let attempts = 0;
			while (attempts < 50 && !globalThis.__ZAMA_SDK_LOADED__) {
				await new Promise(resolve => setTimeout(resolve, 100));
				attempts++;
			}
			
			if (globalThis.__ZAMA_SDK_ERROR__) {
				throw new Error(`SDK script loading failed: ${globalThis.__ZAMA_SDK_ERROR__}`);
			}
		}
		
		const sdk = await resolveSdk();
		if (!sdk) {
			throw new Error('Zama Relayer SDK not found, please confirm UMD or CDN is properly loaded');
		}

		try {
			if (typeof sdk.initSDK === 'function') {
				await sdk.initSDK();
			}
			
			let cfg: Record<string, unknown>;
			if (sdk.SepoliaConfig) {
				cfg = { ...sdk.SepoliaConfig };
			} else {
				cfg = {
					relayerUrl: AppConfig.zama.relayerUrl || 'https://api.zama.ai/relayer',
					network: 'sepolia'
				};
			}
			
			cfg.relayerUrl = AppConfig.zama.relayerUrl || cfg.relayerUrl;
			
			instance = await sdk.createInstance(cfg);
			return instance;
		} catch (error) {
			console.error('[FHE] Initialization failed:', error);
			throw new Error(formatFriendlyError(error, 'FHE SDK initialization failed'));
		}
	}
	
	return instance;
}

export async function encryptByte(value: number): Promise<unknown> {
	const inst = await getFheInstance();
	const maybeInst = inst as unknown as { encrypt8?: (x: number) => Promise<unknown> };
	if (maybeInst?.encrypt8) return maybeInst.encrypt8(value);
	throw new Error('encrypt8 not available, please confirm Zama Relayer SDK initialization');
}

export async function initFhevm(): Promise<FhevmInstance | undefined> {
  return getFheInstance();
}
export async function encryptFeatures(features: {
  perceptualHashHigh: number;
  perceptualHashLow: number;
  dominantRed: number;
  dominantGreen: number;
  dominantBlue: number;
  brightness: number;
  contrast: number;
  timestamp: number;
  aspectRatio: number;
}): Promise<unknown[]> {
  const values = [
    features.perceptualHashHigh,
    features.perceptualHashLow,
    features.dominantRed,
    features.dominantGreen,
    features.dominantBlue,
    features.brightness,
    features.contrast,
    features.timestamp,
    features.aspectRatio
  ].map(v => Number(v) | 0);

  const out: unknown[] = [];
  for (const v of values) {
    const clamped = Math.max(0, Math.min(255, v));
    const enc = await encryptByte(clamped);
    out.push(enc);
  }
  return out;
}

export async function encryptAttribute(text: string): Promise<unknown[]> {
  const encoder = new TextEncoder();
  const bytes = Array.from(encoder.encode(String(text)));
  const result: unknown[] = [];
  for (const b of bytes) {
    const enc = await encryptByte(b);
    result.push(enc);
  }
  return result;
}

export async function createEncryptedInput(contractAddress: string, userAddress: string): Promise<unknown> {
	const inst = await getFheInstance();
	const maybeInst = inst as unknown as { createEncryptedInput?: (ca: string, ua: string) => unknown };
	
	if (typeof maybeInst?.createEncryptedInput === 'function') {
		if (!contractAddress || !contractAddress.startsWith('0x') || contractAddress.length !== 42) {
			throw new Error(`Invalid contract address format: ${contractAddress}`);
		}
		if (!userAddress || !userAddress.startsWith('0x') || userAddress.length !== 42) {
			throw new Error(`Invalid user address format: ${userAddress}`);
		}
		
		try {
			const result = maybeInst.createEncryptedInput(contractAddress, userAddress);
			return result;
		} catch (error) {
			console.error('[FHE] Failed to create encrypted input:', error);
			throw new Error(formatFriendlyError(error, 'Failed to create encrypted input'));
		}
	}
	
	throw new Error('createEncryptedInput not available, please confirm Zama Relayer SDK initialization');
}



function normalizeToHex0x(x: unknown, label: string): `0x${string}` {
  if (typeof x === 'string') {
    const s = x.trim();
    if (isHex(s, { strict: true })) return s as `0x${string}`;
    const prefixed = (`0x${s}`) as `0x${string}`;
    if (isHex(prefixed, { strict: true })) return prefixed;
  }

  if (typeof x === 'bigint' || (typeof x === 'number' && Number.isFinite(x))) {
    return toHex(x as number | bigint) as `0x${string}`;
  }
  if (x instanceof Uint8Array) {
    return bytesToHex(x) as `0x${string}`;
  }
  if (Array.isArray(x) && x.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    return bytesToHex(Uint8Array.from(x as number[])) as `0x${string}`;
  }

  if (x && typeof x === 'object') {
    const obj = x as Record<string, unknown>;
    const keys = ['handle', 'ciphertext', 'hex', 'data', 'value', 'tag', 'inputTag'];
    for (const k of keys) {
      if (k in obj) {
        try {
          return normalizeToHex0x(obj[k], label);
        } catch {
        }
      }
    }
  }

  throw new Error(`${label} is not a valid 0x hexadecimal string`);
}

function toHexHandle(x: unknown, label: string): `0x${string}` {
  return normalizeToHex0x(x, label);
}

function computeMerkleRoot(handles: `0x${string}`[]): `0x${string}` {
  if (!handles.length) throw new Error('At least one handle is required to compute Merkle Root');
  let layer = handles.map((h) => keccak256(h));
  while (layer.length > 1) {
    const next: `0x${string}`[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      const combined = new Uint8Array([...hexToBytes(left), ...hexToBytes(right)]);
      next.push(keccak256(combined));
    }
    layer = next;
  }
  return layer[0];
}


async function encryptMixedTypesWithInput(contractAddress: string, userAddress: string, values: Array<{ value: number; type: 'uint8' | 'uint32' }>): Promise<{ handles: `0x${string}`[]; inputProof: `0x${string}`; inputTag: `0x${string}` }>{
  const input: Record<string, unknown> = await createEncryptedInput(contractAddress, userAddress) as Record<string, unknown>;
  
  // Get different types of encryption methods
  const add8 = input.add8 as unknown as ((v: number) => void) | undefined;
  const addU8 = input.addU8 as unknown as ((v: number) => void) | undefined;
  const add32 = input.add32 as unknown as ((v: number) => void) | undefined;
  const addU32 = input.addU32 as unknown as ((v: number) => void) | undefined;
  
  // Add values according to type
  for (const item of values) {
    const value = Number(item.value) | 0;
    
    if (item.type === 'uint8') {
      const clamped = Math.max(0, Math.min(255, value));
      if (typeof add8 === 'function') {
        add8(clamped);
      } else if (typeof addU8 === 'function') {
        addU8(clamped);
      } else {
        throw new Error('SDK missing add8/addU8 methods, cannot add 8-bit features');
      }
    } else if (item.type === 'uint32') {
      const clamped = Math.max(0, Math.min(4294967295, value)); // uint32 max
      if (typeof add32 === 'function') {
        add32(clamped);
      } else if (typeof addU32 === 'function') {
        addU32(clamped);
      } else {
        throw new Error('SDK missing add32/addU32 methods, cannot add 32-bit features');
      }
    } else {
      throw new Error(`Unsupported encryption type: ${item.type}`);
    }
  }
  
  const finalize = (input.encrypt || (input as Record<string, unknown>).finalize || (input as Record<string, unknown>).seal) as unknown as (() => Promise<Record<string, unknown>>) | undefined;
  if (!finalize) {
    throw new Error('SDK does not provide encrypt/finalize/seal methods, cannot generate handles and proofs');
  }
  
  const result = await finalize.call(input);
  const handlesRaw = (result as Record<string, unknown>).handles as unknown[] | undefined;
  const inputProof = (result as Record<string, unknown>).inputProof as unknown;
  const inputTag = (result as Record<string, unknown>).inputTag as unknown;
  
  if (!Array.isArray(handlesRaw) || handlesRaw.length === 0) {
    throw new Error('SDK returned empty handles');
  }
  
  const handles = handlesRaw.map((h, i) => toHexHandle(h, `handle[${i}]`));
  const proofHex = toHexHandle(inputProof, 'inputProof');
  
  // Handle case where inputTag might be empty
  let tagHex: `0x${string}`;
  if (inputTag === undefined || inputTag === null) {
    // Generate random 32-byte inputTag
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    tagHex = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  } else {
    tagHex = toHexHandle(inputTag, 'inputTag');
  }
  
  return { handles, inputProof: proofHex, inputTag: tagHex };
}

export async function encryptFeaturesWithProof(contractAddress: string, userAddress: string, features: {
  perceptualHashHigh: number;
  perceptualHashLow: number;
  dominantRed: number;
  dominantGreen: number;
  dominantBlue: number;
  brightness: number;
  contrast: number;
  timestamp: number;
  aspectRatio: number;
}): Promise<{ encryptedFeatures: `0x${string}`[]; inputProof: `0x${string}`; inputTag: `0x${string}`; ciphertextRoot: `0x${string}` }>{
  // Define encryption type for each feature according to contract expectations
  const typedValues = [
    { value: features.perceptualHashHigh, type: 'uint32' as const }, // euint32
    { value: features.perceptualHashLow, type: 'uint32' as const },  // euint32
    { value: features.dominantRed, type: 'uint8' as const },         // euint8
    { value: features.dominantGreen, type: 'uint8' as const },       // euint8
    { value: features.dominantBlue, type: 'uint8' as const },        // euint8
    { value: features.brightness, type: 'uint8' as const },          // euint8
    { value: features.contrast, type: 'uint8' as const },            // euint8
    { value: features.timestamp, type: 'uint32' as const },          // euint32
    { value: features.aspectRatio, type: 'uint32' as const }         // euint32
  ];
  
  const { handles, inputProof, inputTag } = await encryptMixedTypesWithInput(contractAddress, userAddress, typedValues);
  const ciphertextRoot = computeMerkleRoot(handles);
  return { encryptedFeatures: handles, inputProof, inputTag, ciphertextRoot };
}

export async function encryptAttributeWithProof(contractAddress: string, userAddress: string, text: string): Promise<{ encryptedData: `0x${string}`[]; inputProof: `0x${string}`; totalBytes: number }>{
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  
  // Split into 4-byte chunks, each encrypted with euint32 (corresponding to euint32[] chunks in contract)
  const chunks: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    const slice = bytes.slice(i, i + 4);
    // Convert 4 bytes to a 32-bit integer (little-endian)
    let value = 0;
    for (let j = 0; j < slice.length; j++) {
      value |= (slice[j] & 0xFF) << (j * 8);
    }
    chunks.push(value);
  }
  
  // Encrypt each chunk using uint32 type
  const typedValues = chunks.map(chunk => ({ value: chunk, type: 'uint32' as const }));
  const { handles, inputProof } = await encryptMixedTypesWithInput(contractAddress, userAddress, typedValues);
  
  return { encryptedData: handles, inputProof, totalBytes: bytes.length };
}

// Decrypt single handle
export async function decryptHandle(
	contractAddress: string, 
	handle: string,
	userAddress: string
): Promise<bigint> {
	const inst = await getFheInstance();
	const maybeInst = inst as unknown as { 
		decrypt?: (contractAddress: string, handle: string, userAddress: string) => Promise<bigint>,
		userDecrypt?: (
			pairs: Array<{ handle: string; contractAddress: string }>,
			privateKey: string,
			publicKey: string,
			signature: string,
			contracts: string[],
			userAddress: string,
			startTimestamp: string,
			durationDays: string
		) => Promise<Record<string, string | number | bigint>>,
		generateKeypair?: () => { publicKey: string; privateKey: string },
		createEIP712?: (
			publicKey: string,
			contracts: string[],
			startTimestamp: string,
			durationDays: string
		) => { domain: Record<string, unknown>; types: Record<string, unknown>; message: Record<string, unknown> }
	};
	
	if (typeof maybeInst?.decrypt === 'function') {
		// Validate address format
		if (!contractAddress || !contractAddress.startsWith('0x') || contractAddress.length !== 42) {
			throw new Error(`Invalid contract address format: ${contractAddress}`);
		}
		if (!userAddress || !userAddress.startsWith('0x') || userAddress.length !== 42) {
			throw new Error(`Invalid user address format: ${userAddress}`);
		}
		if (!handle || !handle.startsWith('0x')) {
			throw new Error(`Invalid handle format: ${handle}`);
		}
		
		try {
			const normalizedContract = getAddress(contractAddress);
			const normalizedUser = getAddress(userAddress);
			const result = await maybeInst.decrypt(normalizedContract, handle, normalizedUser);
			return result;
		} catch (error) {
			console.error('[FHE] Decryption failed:', error);
			throw new Error(formatFriendlyError(error, 'Decryption failed'));
		}
	}
	// decrypt method doesn't exist, try userDecrypt path (EIP-712 signature)
	if (
		typeof maybeInst?.userDecrypt === 'function' &&
		typeof maybeInst?.generateKeypair === 'function' &&
		typeof maybeInst?.createEIP712 === 'function'
	) {
		if (!contractAddress || !contractAddress.startsWith('0x') || contractAddress.length !== 42) {
			throw new Error(`Invalid contract address format: ${contractAddress}`);
		}
		if (!userAddress || !userAddress.startsWith('0x') || userAddress.length !== 42) {
			throw new Error(`Invalid user address format: ${userAddress}`);
		}
		if (!handle || !handle.startsWith('0x')) {
			throw new Error(`Invalid handle format: ${handle}`);
		}
		if (typeof window === 'undefined' || !(window as unknown as Record<string, unknown>).ethereum) {
			throw new Error('Cannot get wallet to sign decryption request, please connect wallet in browser first');
		}
		try {
			const normalizedContract = getAddress(contractAddress);
			const normalizedUser = getAddress(userAddress);
			const pairs = [{ handle, contractAddress: normalizedContract }];
			const startTimestamp = Math.floor(Date.now() / 1000).toString();
			const durationDays = '7';
			const contracts = [normalizedContract];
			const { publicKey, privateKey } = maybeInst.generateKeypair();
			const eip712 = maybeInst.createEIP712(publicKey, contracts, startTimestamp, durationDays) as unknown as {
				domain: Record<string, unknown>;
				types: Record<string, unknown> & { EIP712Domain?: unknown; UserDecryptRequestVerification?: unknown };
				message: Record<string, unknown>;
			};
			const typedData = {
				domain: eip712.domain,
				types: eip712.types,
				primaryType: 'UserDecryptRequestVerification',
				message: eip712.message
			};
			const sigHex = await (window as unknown as { ethereum: { request: (args: { method: string; params: unknown[] }) => Promise<string> } }).ethereum.request({
				method: 'eth_signTypedData_v4',
				params: [normalizedUser, JSON.stringify(typedData)]
			});
			const signature = sigHex.startsWith('0x') ? sigHex.slice(2) : sigHex;
			const r = await maybeInst.userDecrypt(pairs, privateKey, publicKey, signature, contracts, normalizedUser, startTimestamp, durationDays);
			// Compatible with different key names: original handle, without 0x, case variations
			const keyCandidates = [
				handle,
				handle.toLowerCase(),
				handle.toUpperCase(),
				handle.slice(2),
				handle.slice(2).toLowerCase(),
				handle.slice(2).toUpperCase()
			];

			// Try to parse any value as bigint, supports multi-level nesting and arrays
			const toBigInt = (v: unknown, depth = 0): bigint | undefined => {
				if (v === null || v === undefined) return undefined;
				if (typeof v === 'bigint') return v;
				if (typeof v === 'number' && Number.isFinite(v)) return BigInt(v);
				if (typeof v === 'boolean') return v ? 1n : 0n;
				if (typeof v === 'string') {
					const s0 = v.trim();
					if (s0.toLowerCase() === 'true') return 1n;
					if (s0.toLowerCase() === 'false') return 0n;
					const s = s0.endsWith('n') ? s0.slice(0, -1) : s0;
					if (/^-?0x[0-9a-fA-F]+$/.test(s)) return BigInt(s);
					if (/^-?\d+$/.test(s)) return BigInt(s);
					return undefined;
				}
				if (Array.isArray(v)) {
					for (const item of v) {
						const parsed = toBigInt(item, depth + 1);
						if (parsed !== undefined) return parsed;
					}
					return undefined;
				}
				if (typeof v === 'object') {
					if (depth > 4) return undefined; // Prevent excessive recursion
					const obj = v as Record<string, unknown>;
					const valueKeys = ['value', 'val', 'clear', 'decrypted', 'plaintext', 'plain', 'decoded', 'number'];
					for (const k of valueKeys) {
						if (k in obj) {
							const parsed = toBigInt(obj[k], depth + 1);
							if (parsed !== undefined) return parsed;
						}
					}
					// Common container fields
					for (const k of ['data', 'payload', 'result', 'r']) {
						if (k in obj) {
							const parsed = toBigInt(obj[k], depth + 1);
							if (parsed !== undefined) return parsed;
						}
					}
					// If object itself is a { handle, value } structure
					if (
						('handle' in obj) &&
						keyCandidates.includes(String(obj.handle)) ||
						keyCandidates.includes(String(obj.handle || '').toLowerCase())
					) {
						for (const k of valueKeys) {
							if (k in obj) {
								const parsed = toBigInt(obj[k], depth + 1);
								if (parsed !== undefined) return parsed;
							}
						}
					}
					// Finally scan all key-value pairs to try parsing
					for (const [, val] of Object.entries(obj)) {
						const parsed = toBigInt(val, depth + 1);
						if (parsed !== undefined) return parsed;
					}
				}
				return undefined;
			};

			let raw: unknown = undefined;
			// 1) First try to match by candidate keys
			for (const k of keyCandidates) {
				if (Object.prototype.hasOwnProperty.call(r, k)) {
					raw = (r as Record<string, unknown>)[k];
					break;
				}
			}
			// 2) Top level is array
			if (raw === undefined && Array.isArray(r)) {
				raw = r;
			}
			// 3) If no match and only single item returned, take first value
			if (raw === undefined && r && typeof r === 'object' && !Array.isArray(r)) {
				const entries = Object.entries(r as Record<string, unknown>);
				if (entries.length === 1) raw = entries[0][1];
			}
			// 4) Fallback: scan for first parseable value in object
			if (raw === undefined) raw = r;

			const parsed = toBigInt(raw);
			if (parsed === undefined) {
				const safeStringify = (obj: unknown): string => {
					try {
						return JSON.stringify(obj, (key, value) => {
							if (typeof value === 'bigint') return value.toString();
							return value;
						}, 2).slice(0, 1000);
					} catch {
						return Object.prototype.toString.call(obj);
					}
				};
				throw new Error(`Cannot parse userDecrypt return value, structure preview: ${safeStringify(r)}`);
			}
			return parsed;
		} catch (err) {
			console.error('[FHE] userDecrypt path decryption failed:', err);
			throw new Error(formatFriendlyError(err, 'Decryption failed'));
		}
	}

	// When both decrypt and userDecrypt are unavailable, only throw error, avoid redundant logs
	throw new Error('decrypt not available, please confirm Zama Relayer SDK initialization or SDK version compatibility');
}

// Simple in-memory cache to reduce repeated decryption
const decryptionCache = new Map<string, { value: bigint; expiry: number }>();

function getDecryptionParams() {
	const d = AppConfig.decryption || {} as unknown as {
		batchSize?: number;
		concurrency?: number;
		cacheTtlMs?: number;
	};
	return {
		batchSize: Math.max(1, Number(d.batchSize ?? 64)),
		concurrency: Math.max(1, Number(d.concurrency ?? 2)),
		cacheTtlMs: Math.max(0, Number(d.cacheTtlMs ?? 300000))
	};
}

function chunkArray<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
	const results: R[] = [];
	let idx = 0;
	const workers: Array<Promise<void>> = [];
	const run = async () => {
		while (idx < items.length) {
			const current = idx++;
			const r = await worker(items[current]);
			results[current] = r;
		}
	};
	for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(run());
	await Promise.all(workers);
	return results;
}

// Batch decrypt multiple handles (with concurrency, batching and caching)
export async function decryptHandles(
	contractAddress: string,
	handles: string[],
	userAddress: string
): Promise<Record<string, bigint>> {
	if (!handles || handles.length === 0) {
		return {};
	}

	const params = getDecryptionParams();
	const inst = await getFheInstance();
	const maybeInst = inst as unknown as { 
		decrypt?: (contractAddress: string, handle: string, userAddress: string) => Promise<bigint>,
		userDecrypt?: (
			pairs: Array<{ handle: string; contractAddress: string }>,
			privateKey: string,
			publicKey: string,
			signature: string,
			contracts: string[],
			userAddress: string,
			startTimestamp: string,
			durationDays: string
		) => Promise<Record<string, string | number | bigint>>,
		generateKeypair?: () => { publicKey: string; privateKey: string },
		createEIP712?: (
			publicKey: string,
			contracts: string[],
			startTimestamp: string,
			durationDays: string
		) => { domain: Record<string, unknown>; types: Record<string, unknown>; message: Record<string, unknown> }
	};

	const now = Date.now();
	const ttl = params.cacheTtlMs;
	const requested = Array.from(new Set(handles.filter(h => typeof h === 'string' && h.startsWith('0x'))));
	const result: Record<string, bigint> = {};
	const pending: string[] = [];
	for (const h of requested) {
		const c = decryptionCache.get(h);
		if (c && c.expiry > now) {
			result[h] = c.value;
		} else {
			pending.push(h);
		}
	}
	if (pending.length === 0) return result;

	const normalizedContract = getAddress(contractAddress);
	const normalizedUser = getAddress(userAddress);

	// Prefer userDecrypt, one signature, can batch concurrently
	if (
		typeof maybeInst?.userDecrypt === 'function' &&
		typeof maybeInst?.generateKeypair === 'function' &&
		typeof maybeInst?.createEIP712 === 'function'
	) {
		if (typeof window === 'undefined' || !(window as unknown as Record<string, unknown>).ethereum) {
			throw new Error('Cannot get wallet to sign decryption request, please connect wallet in browser first');
		}
		try {
			const startTimestamp = Math.floor(Date.now() / 1000).toString();
			const durationDays = '7';
			const contracts = [normalizedContract];
			const { publicKey, privateKey } = maybeInst.generateKeypair();
			const eip712 = maybeInst.createEIP712(publicKey, contracts, startTimestamp, durationDays) as unknown as {
				domain: Record<string, unknown>;
				types: Record<string, unknown> & { EIP712Domain?: unknown; UserDecryptRequestVerification?: unknown };
				message: Record<string, unknown>;
			};
			const typedData = {
				domain: eip712.domain,
				types: eip712.types,
				primaryType: 'UserDecryptRequestVerification',
				message: eip712.message
			};
			const sigHex = await (window as unknown as { ethereum: { request: (args: { method: string; params: unknown[] }) => Promise<string> } }).ethereum.request({
				method: 'eth_signTypedData_v4',
				params: [normalizedUser, JSON.stringify(typedData)]
			});
			const signature = sigHex.startsWith('0x') ? sigHex.slice(2) : sigHex;
			console.log('[FHE] User has completed signature, starting decryption...');

			const batches = chunkArray(pending, params.batchSize);
			console.log('[FHE] Total handles to decrypt:', pending.length, 'Number of batches:', batches.length, 'Batch size:', params.batchSize);
			await runWithConcurrency(batches, params.concurrency, async (batch) => {
				const pairs = batch.map(h => ({ handle: h, contractAddress: normalizedContract }));
				try {
					const r = await maybeInst.userDecrypt!(pairs, privateKey, publicKey, signature, contracts, normalizedUser, startTimestamp, durationDays) as Record<string, string | number | bigint>;
				
				const toBigInt = (v: unknown, depth = 0): bigint | undefined => {
					if (v === null || v === undefined) return undefined;
					if (typeof v === 'bigint') return v;
					if (typeof v === 'number' && Number.isFinite(v)) return BigInt(v);
					if (typeof v === 'boolean') return v ? 1n : 0n;
					if (typeof v === 'string') {
						const s0 = v.trim();
						if (s0.toLowerCase() === 'true') return 1n;
						if (s0.toLowerCase() === 'false') return 0n;
						const s = s0.endsWith('n') ? s0.slice(0, -1) : s0;
						if (/^-?0x[0-9a-fA-F]+$/.test(s)) return BigInt(s);
						if (/^-?\d+$/.test(s)) return BigInt(s);
						return undefined;
					}
					if (Array.isArray(v)) {
						for (const item of v) {
							const parsed = toBigInt(item, depth + 1);
							if (parsed !== undefined) return parsed;
						}
						return undefined;
					}
					if (typeof v === 'object') {
						if (depth > 4) return undefined;
						const obj = v as Record<string, unknown>;
						const valueKeys = ['value', 'val', 'clear', 'decrypted', 'plaintext', 'plain', 'decoded', 'number'];
						for (const k of valueKeys) {
							if (k in obj) {
								const parsed = toBigInt(obj[k], depth + 1);
								if (parsed !== undefined) return parsed;
							}
						}
						for (const k of ['data', 'payload', 'result', 'r']) {
							if (k in obj) {
								const parsed = toBigInt(obj[k], depth + 1);
								if (parsed !== undefined) return parsed;
							}
						}
						return undefined;
					}
					return undefined;
				};

				for (const h of batch) {
					const keyCandidates = [h, h.toLowerCase(), h.toUpperCase(), h.slice(2), h.slice(2).toLowerCase(), h.slice(2).toUpperCase()];
					let raw: unknown = undefined;
					for (const k of keyCandidates) {
						if (Object.prototype.hasOwnProperty.call(r, k)) {
							raw = (r as Record<string, unknown>)[k];
							break;
						}
					}
					if (raw === undefined && Array.isArray(r)) raw = r;
					if (raw === undefined && r && typeof r === 'object' && !Array.isArray(r)) {
						const entries = Object.entries(r as Record<string, unknown>);
						if (entries.length === 1) raw = entries[0][1];
					}
					if (raw === undefined) raw = r;

					const val = toBigInt(raw);
					if (val !== undefined) {
						result[h] = val;
						if (ttl > 0) decryptionCache.set(h, { value: val, expiry: Date.now() + ttl });
					} else {
						console.error('[FHE] Batch userDecrypt single item parsing failed, handle:', h, 'Return preview:', (() => { try { return JSON.stringify(r, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 1000);} catch { return Object.prototype.toString.call(r);} })());
					}
				}
				return undefined as unknown as void;
				} catch (error) {
					console.error('[FHE] Batch decryption failed:', error);
					throw error;
				}
			});
		} catch (err) {
			console.error('[FHE] Batch userDecrypt failed:', err);
		}
	}

	// For still missing handles, fallback to decrypt concurrent calls
	const missing = pending.filter(h => result[h] === undefined);
	if (missing.length && typeof maybeInst?.decrypt === 'function') {
		await runWithConcurrency(missing, params.concurrency, async (h) => {
			try {
				const val = await maybeInst.decrypt!(normalizedContract, h, normalizedUser);
				result[h] = val;
				if (ttl > 0) decryptionCache.set(h, { value: val, expiry: Date.now() + ttl });
			} catch {
				// Ignore individual failures
			}
			return undefined as unknown as void;
		});
	}

	// Final fallback: call decryptHandle one by one (serial, ensure best effort return)
	const stillMissing = pending.filter(h => result[h] === undefined);
	for (const h of stillMissing) {
		try {
			const val = await decryptHandle(contractAddress, h, userAddress);
			result[h] = val;
			if (ttl > 0) decryptionCache.set(h, { value: val, expiry: Date.now() + ttl });
		} catch {
			// Ignore
		}
	}

	return result;
}