import { AppConfig } from '../config/app.config';
import { EncryptedImageNFT_ABI } from '../config/abis/EncryptedImageNFT';
import { decryptHandle } from './fhe';
import { createPublicClient, createWalletClient, custom, http, getContract, type EIP1193Provider } from 'viem';
import { sepolia } from 'viem/chains';

function resolveChain() {
	if (AppConfig.chainId === sepolia.id) return sepolia;
	return {
		id: AppConfig.chainId,
		name: 'custom',
		nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
		rpcUrls: { default: { http: [AppConfig.rpcUrl] } }
	} as const;
}

export function getPublicClient() {
	const chain = resolveChain();
	const url = AppConfig.rpcUrl || chain.rpcUrls.default.http[0];
	return createPublicClient({ chain, transport: http(url) });
}

export function getWalletClient() {
	if (typeof window === 'undefined' || !(window as unknown as { ethereum?: EIP1193Provider }).ethereum) {
		throw new Error('No wallet');
	}
	const chain = resolveChain();
	const provider = (window as unknown as { ethereum: EIP1193Provider }).ethereum;
	return createWalletClient({ chain, transport: custom(provider) });
}

export async function ensureWalletOnConfiguredChain(): Promise<void> {
	if (typeof window === 'undefined' || !(window as unknown as { ethereum?: EIP1193Provider }).ethereum) {
		throw new Error('No Ethereum wallet detected');
	}
	const provider = (window as unknown as { ethereum: EIP1193Provider }).ethereum as unknown as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
	const targetIdDec = AppConfig.chainId;
	const targetIdHex = '0x' + targetIdDec.toString(16);
	try {
		const currentHex = (await provider.request({ method: 'eth_chainId' })) as string;
		if (currentHex?.toLowerCase() === targetIdHex.toLowerCase()) return;
		await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetIdHex }] });
		return;
	} catch {
		const chain = resolveChain();
		try {
			await provider.request({
				method: 'wallet_addEthereumChain',
				params: [
					{
						chainId: targetIdHex,
						chainName: chain.name || 'Custom EVM',
						rpcUrls: chain.rpcUrls?.default?.http || (AppConfig.rpcUrl ? [AppConfig.rpcUrl] : []),
						nativeCurrency: ((chain as unknown as { nativeCurrency?: { name: string; symbol: string; decimals: number } }).nativeCurrency) || { name: 'ETH', symbol: 'ETH', decimals: 18 }
					}
				]
			});
			return;
		} catch (addErr) {
			const reason = addErr instanceof Error ? (addErr.stack || addErr.message) : String(addErr);
			throw new Error('Failed to switch/add network, please manually switch to correct network and retry: ' + reason);
		}
	}
}

export function getEncryptedImageContractRead() {
	const publicClient = getPublicClient();
	return getContract({ address: AppConfig.zama.targetContractAddress as `0x${string}`, abi: EncryptedImageNFT_ABI, client: publicClient });
}

export function getEncryptedImageContractWrite() {
	const walletClient = getWalletClient();
	return getContract({ address: AppConfig.zama.targetContractAddress as `0x${string}`, abi: EncryptedImageNFT_ABI, client: walletClient });
}

export async function registerEncryptedImage(params: {
	ciphertextRoot: `0x${string}`;
	inputTag: `0x${string}`;
	ipfsCid: string;
	width: number;
	height: number;
	encryptedFeatures: `0x${string}`[];
	inputProof: `0x${string}`;
	plainAttributes: { trait_type: string; value: string }[];
	encryptedAttributeInputs: { trait_type: string; encryptedData: `0x${string}`[]; inputProof: `0x${string}`; totalBytes: number }[];
}) {
	await ensureWalletOnConfiguredChain();
	const walletClient = getWalletClient();
	const [account] = await walletClient.getAddresses();
	if (!account) throw new Error('No connected account');
	
	if (params.width < 0 || params.width > 4294967295) {
		throw new Error('Invalid width: must be between 0 and 4294967295');
	}
	if (params.height < 0 || params.height > 4294967295) {
		throw new Error('Invalid height: must be between 0 and 4294967295');
	}
	
	return walletClient.writeContract({
		address: AppConfig.zama.targetContractAddress as `0x${string}`,
		abi: EncryptedImageNFT_ABI,
		functionName: 'registerEncryptedImage',
		account,
		args: [
			params.ciphertextRoot,
			params.inputTag,
			params.ipfsCid,
			params.width as number,
			params.height as number,
			params.encryptedFeatures,
			params.inputProof,
			params.plainAttributes,
			params.encryptedAttributeInputs.map(input => ({
				...input,
				totalBytes: input.totalBytes as number
			}))
		]
	});
}

export async function getNFTEncryptedHandles(tokenId: bigint, userAddress?: string): Promise<{
	imageFeatures: Record<string, string>;
	encryptedAttributes: Record<string, { chunks: string[]; totalBytes: number }>;
}> {
	const publicClient = getPublicClient();
	const contractAddress = AppConfig.zama.targetContractAddress as `0x${string}`;
	
	try {
		const encryptedCount = await publicClient.readContract({
			address: contractAddress,
			abi: EncryptedImageNFT_ABI,
			functionName: 'getEncryptedAttributesCount',
			args: [tokenId]
		}) as bigint;
		
		const encryptedAttributes: Record<string, { chunks: string[]; totalBytes: number }> = {};
		for (let i = 0; i < Number(encryptedCount); i++) {
			try {
				const traitType = await publicClient.readContract({
					address: contractAddress,
					abi: EncryptedImageNFT_ABI,
					functionName: 'getEncryptedAttributeType',
					args: [tokenId, BigInt(i)]
				}) as string;
				const chunkCount = await publicClient.readContract({
					address: contractAddress,
					abi: EncryptedImageNFT_ABI,
					functionName: 'getEncryptedAttributeChunkCount',
					args: [tokenId, BigInt(i)]
				}) as bigint;
				const totalBytesBn = await publicClient.readContract({
					address: contractAddress,
					abi: EncryptedImageNFT_ABI,
					functionName: 'getEncryptedAttributeMeta',
					args: [tokenId, BigInt(i)]
				}) as number | bigint;
				const totalBytes = Number(totalBytesBn);
				const chunks: string[] = [];
				for (let c = 0; c < Number(chunkCount); c++) {
					const handle = await publicClient.readContract({
						address: contractAddress,
						abi: EncryptedImageNFT_ABI,
						functionName: 'getEncryptedAttributeChunk',
						args: [tokenId, BigInt(i), BigInt(c)],
						account: (userAddress as `0x${string}` | undefined)
					}) as string;
					chunks.push(handle);
				}
				
				if (traitType) {
					encryptedAttributes[traitType] = { chunks, totalBytes };
				}
			} catch (error) {
				console.warn(`[Contract] Failed to get encrypted attribute ${i}:`, error);
			}
		}
		
		const imageFeatures: Record<string, string> = {};
		
		return {
			imageFeatures,
			encryptedAttributes
		};
		
	} catch (error) {
		console.error('[Contract] Failed to get encrypted handles:', error);
		throw new Error(`Failed to get encrypted handles: ${error}`);
	}
}

export async function hasViewPermission(tokenId: bigint, userAddress: string): Promise<boolean> {
	const publicClient = getPublicClient();
	const contractAddress = AppConfig.zama.targetContractAddress as `0x${string}`;
	
	try {
		const hasPermission = await publicClient.readContract({
			address: contractAddress,
			abi: EncryptedImageNFT_ABI,
			functionName: 'hasViewPermission',
			args: [tokenId, userAddress as `0x${string}`]
		}) as boolean;
		return Boolean(hasPermission);
	} catch (error) {
		console.error('[Contract] Failed to check view permission:', error);
		return false;
	}
}

export async function grantViewPermission(tokenId: bigint, userAddress: string) {
	await ensureWalletOnConfiguredChain();
	const walletClient = getWalletClient();
	const [account] = await walletClient.getAddresses();
	if (!account) throw new Error('No connected account');
	
	return walletClient.writeContract({
		address: AppConfig.zama.targetContractAddress as `0x${string}`,
		abi: EncryptedImageNFT_ABI,
		functionName: 'grantViewPermission',
		account,
		args: [tokenId, userAddress as `0x${string}`]
	});
}

export async function compareNftFingerprints(
	tokenIdA: bigint,
	tokenIdB: bigint,
	userAddress: string,
	onStatusUpdate?: (status: string) => void
): Promise<boolean> {
  const contractAddress = AppConfig.zama.targetContractAddress as `0x${string}`;
  if (!contractAddress) {
    throw new Error('Contract address not configured');
  }

  const publicClient = getPublicClient();
  try {
    onStatusUpdate?.('Checking permissions...');
    try {
      const [pa, pb] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'hasViewPermission',
          args: [tokenIdA, userAddress as `0x${string}`]
        }) as Promise<boolean>,
        publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'hasViewPermission',
          args: [tokenIdB, userAddress as `0x${string}`]
        }) as Promise<boolean>
      ]);
      if (!pa && !pb) {
        throw new Error('Current account has no view permission for both NFTs');
      }
      onStatusUpdate?.('Permission check passed, preparing comparison transaction...');
    } catch (permErr) {
      const reason = permErr instanceof Error ? (permErr.stack || permErr.message) : String(permErr);
      throw new Error('Permission check failed: ' + reason);
    }

    await ensureWalletOnConfiguredChain();
    const walletClient = getWalletClient();
    const [connectedAccount] = await walletClient.getAddresses();
    if (!connectedAccount) throw new Error('No connected wallet account detected');
    const caller = (connectedAccount as `0x${string}`);

    onStatusUpdate?.('Sending comparison transaction, please confirm wallet signature...');
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: EncryptedImageNFT_ABI,
      functionName: 'checkImageSimilarity',
      account: caller,
      args: [tokenIdA, tokenIdB]
    });
    
    onStatusUpdate?.('Transaction sent, waiting for blockchain confirmation...');
    console.log('[Compare] Transaction sent:', txHash);
    
    try {
      await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 120000
      });
      onStatusUpdate?.('Transaction confirmed, getting comparison result...');
    } catch (timeoutError) {
              if (timeoutError instanceof Error && timeoutError.message.includes('timeout')) {
          throw new Error('Transaction confirmation timeout, please check transaction status later: ' + txHash);
        }
      throw timeoutError;
    }

    const sim = await publicClient.simulateContract({
      address: contractAddress,
      abi: EncryptedImageNFT_ABI,
      functionName: 'checkImageSimilarity',
      args: [tokenIdA, tokenIdB],
      account: caller
    });
    const handle = sim.result as `0x${string}`;

    if (!handle || !handle.startsWith('0x')) {
      throw new Error('Invalid similarity result handle returned by contract');
    }

    onStatusUpdate?.('Decrypting comparison result, please confirm wallet signature...');
    console.log('[Compare] Decrypting handle:', handle);
    
    try {
      const decrypted = await Promise.race([
        decryptHandle(contractAddress, handle, caller),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Decryption timeout, please retry')), 180000)
        )
      ]);
      onStatusUpdate?.('Decryption completed');
      return decrypted === 1n;
    } catch (decryptError) {
      if (decryptError instanceof Error) {
        if (decryptError.message.includes('User denied') || decryptError.message.includes('user rejected')) {
          throw new Error('User cancelled decryption signature, comparison aborted');
        }
        if (decryptError.message.includes('Decryption timeout')) {
          throw new Error('Decryption process timeout, may be network issue, please retry');
        }
      }
      throw new Error('Decryption failed: ' + (decryptError instanceof Error ? decryptError.message : String(decryptError)));
    }
  } catch (error) {
    const reason = error instanceof Error ? (error.stack || error.message) : String(error);
    throw new Error('Fingerprint comparison failed, please confirm both NFTs contain encrypted data and you have permission: ' + reason);
  }
}
