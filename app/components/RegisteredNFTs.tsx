'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppConfig } from '@/config/app.config';
import { getPublicClient, getWalletClient, ensureWalletOnConfiguredChain } from '@/lib/contract';
import { EncryptedImageNFT_ABI } from '@/config/abis/EncryptedImageNFT';
import { useAccount } from 'wagmi';

const creatorCache = new Map<string, Map<string, string>>();
const CACHE_DURATION = 5 * 60 * 1000;

async function queryAllImageCreators(
  publicClient: ReturnType<typeof getPublicClient>,
  contractAddress: string,
  maxBlockRange = 500,
  forceRefresh = false
) {
  const cacheKey = `${contractAddress}`;
  const cached = creatorCache.get(cacheKey);
  if (!forceRefresh && cached) {
    console.log(`[RegisteredNFTs] Using cached creator info, containing ${cached.size} images`);
    return cached;
  }
  
  const creatorMap = new Map<string, string>();
  
  try {
    const latestBlock = await publicClient.getBlockNumber();
    let searchedBlocks = 0;
    const maxSearchBlocks = 5000;
    
    console.log(`[RegisteredNFTs] Starting to query ImageRegistered events, latest block: ${latestBlock}`);
    
    for (let currentBlock = Number(latestBlock); currentBlock > 0 && searchedBlocks < maxSearchBlocks; ) {
      const startBlock = Math.max(0, currentBlock - maxBlockRange + 1);
      const endBlock = currentBlock;
      const actualRange = endBlock - startBlock + 1;
      
      if (actualRange > maxBlockRange) {
        console.warn(`[RegisteredNFTs] Block range ${startBlock}-${endBlock} (${actualRange}) exceeds limit ${maxBlockRange}, skipping`);
        currentBlock = startBlock - 1;
        continue;
      }
      
      searchedBlocks += actualRange;
      
      try {
        const logs = await publicClient.getLogs({
          address: contractAddress as `0x${string}`,
          event: {
            type: 'event',
            name: 'ImageRegistered',
            inputs: [
              { name: 'imageId', type: 'uint256', indexed: true },
              { name: 'ipfsCid', type: 'string', indexed: false },
              { name: 'ciphertextRoot', type: 'bytes32', indexed: false },
              { name: 'creator', type: 'address', indexed: true }
            ]
          },
          fromBlock: BigInt(startBlock),
          toBlock: BigInt(endBlock)
        });
        
        logs.forEach((log) => {
          const imageId = String(log.args.imageId || 0n);
          const creator = (log.args.creator as string) || 'Unknown';
          if (imageId && imageId !== '0' && !creatorMap.has(imageId)) {
            creatorMap.set(imageId, creator);
          }
        });
        
        if (logs.length > 0) {
          console.log(`[RegisteredNFTs] Block segment ${startBlock}-${endBlock} found ${logs.length} ImageRegistered events`);
        }
      } catch (segmentError) {
        console.log(`[RegisteredNFTs] Block segment ${startBlock}-${endBlock} query failed:`, segmentError);
      }
      
      currentBlock = startBlock - 1;
      
      if (startBlock === 0) break;
    }
    
    console.log(`[RegisteredNFTs] Batch query completed, found creator info for ${creatorMap.size} images`);
    
    creatorCache.set(cacheKey, creatorMap);
    setTimeout(() => {
      creatorCache.delete(cacheKey);
      console.log(`[RegisteredNFTs] Clearing cache: ${cacheKey}`);
    }, CACHE_DURATION);
    
  } catch (error) {
    console.log(`[RegisteredNFTs] Batch event query failed:`, error);
  }
  
  return creatorMap;
}

type RegisteredItem = {
  imageId: bigint;
  ipfsCid: string;
  width: number;
  height: number;
  ciphertextRoot: string;
  createdAt: number;
  creator: string;
  plainAttributes: { trait_type: string; value: string }[];
  encryptedAttributes: { trait_type: string; encryptedData: string }[];
};

interface RegisteredNFTsProps {
  onMintSuccess?: () => void;
}

export function RegisteredNFTs({ onMintSuccess }: RegisteredNFTsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RegisteredItem[]>([]);
  const [mintingId, setMintingId] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<bigint | null>(null);

  const { address: userAddress } = useAccount();
  const contractAddress = useMemo(() => AppConfig.zama.targetContractAddress as `0x${string}` | undefined, []);

  const loadRegisteredItems = useCallback(async () => {
    setError(null);
    setTxHash(null);
    setItems([]);
    if (!contractAddress) {
      setError('Contract address not configured, please set zama.targetContractAddress in config/app.config.ts');
      return;
    }
    setLoading(true);
    try {
      const publicClient = getPublicClient();
      
      const creatorMap = await queryAllImageCreators(publicClient, contractAddress, 500, true);
      
      const total = await publicClient.readContract({
        address: contractAddress,
        abi: EncryptedImageNFT_ABI,
        functionName: 'totalRegisteredImages'
      }) as bigint;

      const results: RegisteredItem[] = [];
      const max = Number(total || 0n);
      
      const maxToProcess = Math.min(max, 50);
      
      for (let i = 1; i <= maxToProcess; i++) {
        try {
          const imageId = BigInt(i);
          
          const imageInfo = await publicClient.readContract({
            address: contractAddress,
            abi: EncryptedImageNFT_ABI,
            functionName: 'registeredImages',
            args: [imageId]
          }) as readonly [string, number, number, `0x${string}`, bigint];

          const plainAttrCount = await publicClient.readContract({
            address: contractAddress,
            abi: EncryptedImageNFT_ABI,
            functionName: 'getRegisteredPlaintextAttributesCount',
            args: [imageId]
          }) as bigint;

          const plainAttrs: { trait_type: string; value: string }[] = [];
          for (let j = 0; j < Number(plainAttrCount); j++) {
            try {
              const attr = await publicClient.readContract({
                address: contractAddress,
                abi: EncryptedImageNFT_ABI,
                functionName: 'getRegisteredPlaintextAttribute',
                args: [imageId, BigInt(j)]
              }) as { trait_type: string; value: string };
              plainAttrs.push(attr);
            } catch (e) {
              console.warn(`Failed to get plain attribute ${j}:`, e);
            }
          }

          const encryptedAttrs: { trait_type: string; encryptedData: string }[] = [];

          if (!imageInfo[0]) continue;

          const creator = creatorMap.get(imageId.toString()) || 'Unknown';

          results.push({
            imageId,
            ipfsCid: imageInfo[0],
            width: imageInfo[1],
            height: imageInfo[2],
            ciphertextRoot: imageInfo[3],
            createdAt: Number(imageInfo[4]),
            creator,
            plainAttributes: plainAttrs,
            encryptedAttributes: encryptedAttrs
          });
        } catch (e) {
          console.warn(`Skipping image ${i}:`, e);
        }
      }

      results.sort((a, b) => b.createdAt - a.createdAt);
      setItems(results);
    } catch (e) {
      console.error('Failed to load registered images:', e);
      setError(`Loading failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    loadRegisteredItems();
  }, [loadRegisteredItems]);

  const onMint = async (imageId: bigint) => {
    if (!userAddress) {
      setError('Please connect wallet first');
      return;
    }
    
    setMintingId(imageId);
    setError(null);
    setTxHash(null);
    
    try {
      await ensureWalletOnConfiguredChain();
      const wallet = getWalletClient();
      const [account] = await wallet.getAddresses();
      if (!account) throw new Error('Wallet not connected');
      if (!contractAddress) throw new Error('Missing contract address');
      
      const hash = await wallet.writeContract({
        address: contractAddress,
        abi: EncryptedImageNFT_ABI,
        functionName: 'mintFromRegisteredImage',
        account,
        args: [imageId, account],
        gas: 3000000n
      });
      
      setTxHash(hash);
      onMintSuccess?.();
    } catch (e) {
      console.error('Minting failed:', e);
      setError(`Minting failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setMintingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ width: 32, height: 32, borderBottom: '2px solid #4f46e5', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#6b7280' }}>Loading registered images...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>
        <button
          onClick={loadRegisteredItems}
          style={{
            padding: '10px 16px',
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background-color 0.2s ease'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: 48, 
        color: '#6b7280',
        border: '2px dashed #e5e7eb',
        borderRadius: 16,
        background: '#f9fafb',
        boxShadow: '0 4px 8px rgba(0,0,0,0.05)'
      }}>
        No registered images yet
      </div>
    );
  }

  return (
    <div>
      {txHash && (
        <div style={{ 
          marginBottom: 16, 
          color: '#065f46', 
          background: '#d1fae5', 
          border: '2px solid #a7f3d0', 
          padding: '12px 16px', 
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          Transaction sent:
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" style={{ color: '#047857', marginLeft: 6 }}>View Transaction</a>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
        {items.map((item) => (
          <div key={item.imageId.toString()} style={{ 
            border: '2px solid #e5e7eb', 
            borderRadius: 16, 
            overflow: 'hidden',
            background: 'white',
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          >
            <div style={{ position: 'relative', paddingBottom: '60%', background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <img
                src={`${AppConfig.ipfs.gatewayBase}/${item.ipfsCid}`}
                alt={`Image ${item.imageId}`}
                style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: '#1f2937' }}>ID: {item.imageId.toString()}</span>
                <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '4px 8px', borderRadius: 6 }}>
                  {item.width} &times; {item.height}
                </span>
              </div>

              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                Creator: {item.creator.slice(0, 6)}...{item.creator.slice(-4)}
              </div>

              {(item.plainAttributes.length > 0 || item.encryptedAttributes.length > 0) && (
                <div style={{ marginBottom: 16 }}>
                  <button
                    onClick={() => setExpandedId(expandedId === item.imageId ? null : item.imageId)}
                    style={{
                      fontSize: 14,
                      color: '#4f46e5',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontWeight: 500,
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {expandedId === item.imageId ? 'Collapse' : 'View'} Attributes ({item.plainAttributes.length + item.encryptedAttributes.length})
                  </button>
                  
                  {expandedId === item.imageId && (
                    <div style={{ marginTop: 12, fontSize: 12, background: '#f9fafb', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      {item.plainAttributes.map((attr, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span style={{ color: '#6b7280' }}>{attr.trait_type}:</span>
                          <span>{attr.value}</span>
                        </div>
                      ))}
                      {item.encryptedAttributes.map((attr, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span style={{ color: '#6b7280' }}>{attr.trait_type}:</span>
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Encrypted</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => onMint(item.imageId)}
                disabled={mintingId === item.imageId || !userAddress}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: mintingId === item.imageId ? '#9ca3af' : '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: mintingId === item.imageId || !userAddress ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
              >
                {mintingId === item.imageId ? 'Minting...' : 'Mint NFT'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
