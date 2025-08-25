'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppConfig } from '../../config/app.config';
import { EncryptedImageNFT_ABI } from '../../config/abis/EncryptedImageNFT';
import { getPublicClient, getWalletClient, ensureWalletOnConfiguredChain } from '../../lib/contract';
import { buildGatewayUrl } from '../../lib/ipfs';

type RegisteredItem = {
  imageId: bigint;
  ipfsCid: string;
  width: number;
  height: number;
  createdAt: bigint;
  ciphertextRoot: string;
  creator: string;
  name: string | null;
};

export function MintNFT({ onMintSuccess }: { onMintSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RegisteredItem[]>([]);
  const [mintingId, setMintingId] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<bigint | null>(null);

  const contractAddress = useMemo(() => AppConfig.zama.targetContractAddress as `0x${string}` | undefined, []);

  useEffect(() => {
    (async () => {
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
        
        const total = await publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'totalRegisteredImages'
        }) as bigint;

        const results: RegisteredItem[] = [];
        const max = Number(total || 0n);
        console.log(`[MintNFT] Starting to process ${max} registered images...`);
        
        const maxToProcess = Math.min(max, 20);
        console.log(`[MintNFT] Actually processing ${maxToProcess} images (total ${max})`);
        
        for (let i = 1; i <= maxToProcess; i++) {
          try {
            const imageId = BigInt(i);
            
            if (i % 5 === 0 || i === maxToProcess) {
              console.log(`[MintNFT] Processing progress: ${i}/${maxToProcess}`);
            }
            
            const isReg = await publicClient.readContract({
              address: contractAddress,
              abi: EncryptedImageNFT_ABI,
              functionName: 'isImageRegisteredById',
              args: [imageId]
            }) as boolean;
            
            if (!isReg) continue;
            
            const metaRaw = await publicClient.readContract({
              address: contractAddress,
              abi: EncryptedImageNFT_ABI,
              functionName: 'getImageMeta',
              args: [imageId]
            });
            
            let meta: { ipfsCid: string; width: number; height: number; ciphertextRoot: string; createdAt: bigint };
            if (Array.isArray(metaRaw)) {
              meta = {
                ipfsCid: String(metaRaw[0]),
                width: Number(metaRaw[1]),
                height: Number(metaRaw[2]),
                ciphertextRoot: String(metaRaw[3]),
                createdAt: BigInt(metaRaw[4])
              };
            } else {
               const metaObj = metaRaw as Record<string, unknown>;
              meta = {
                ipfsCid: String(metaObj?.ipfsCid || ''),
                width: Number(metaObj?.width || 0),
                height: Number(metaObj?.height || 0),
                ciphertextRoot: String(metaObj?.ciphertextRoot || ''),
                                 createdAt: BigInt(Number(metaObj?.createdAt || 0) || 0)
              };
            }
            
            let creator = 'Unknown';
            try {
              const creatorAddress = await publicClient.readContract({
                address: contractAddress,
                abi: EncryptedImageNFT_ABI,
                functionName: 'originalCreator',
                args: [imageId]
              }) as string;
              
              console.log(`[MintNFT] ImageId ${i} creator query result:`, creatorAddress);
              
              if (creatorAddress && creatorAddress !== '0x0000000000000000000000000000000000000000') {
                creator = `${creatorAddress.slice(0, 6)}...${creatorAddress.slice(-4)}`;
              }
            } catch (error) {
              console.error(`[MintNFT] ImageId ${i} creator query failed:`, error);
            }
            
            let name: string | null = null;
            try {
              const attrCount = await publicClient.readContract({
                address: contractAddress,
                abi: EncryptedImageNFT_ABI,
                functionName: 'getRegisteredPlaintextAttributesCount',
                args: [imageId]
              }) as bigint;
              
              console.log(`[MintNFT] ImageId ${i} plain attribute count:`, Number(attrCount));
              for (let j = 0; j < Number(attrCount); j++) {
                try {
                  const attr = await publicClient.readContract({
                    address: contractAddress,
                    abi: EncryptedImageNFT_ABI,
                    functionName: 'getRegisteredPlaintextAttribute',
                    args: [imageId, BigInt(j)]
                  }) as { trait_type: string; value: string };
                  
                  console.log(`[MintNFT] ImageId ${i} attribute ${j}:`, attr);
                  
                  if (attr && (attr.trait_type === 'name' || attr.trait_type === 'Name')) {
                    name = String(attr.value);
                    break;
                  }
                } catch (error) {
                  console.error(`[MintNFT] ImageId ${i} attribute ${j} query failed:`, error);
                }
              }
            } catch {
            }
            
            results.push({
              imageId,
              ipfsCid: meta.ipfsCid,
              width: meta.width,
              height: meta.height,
              createdAt: meta.createdAt,
              ciphertextRoot: meta.ciphertextRoot,
              creator,
              name
            });
            
          } catch (itemError) {
            console.log(`[MintNFT] Error processing image ${i}:`, itemError);
          }
        }
        
        console.log(`[MintNFT] Successfully loaded ${results.length} registered images`);
        setItems(results);
        
      } catch (err) {
        console.error('[MintNFT] Loading failed:', err);
        setError(`Loading failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [contractAddress]);

  const onMint = async (imageId: bigint) => {
    if (!contractAddress) {
      setError('Contract address not configured');
      return;
    }

    try {
      setMintingId(imageId);
      setError(null);
      setTxHash(null);

      const walletClient = await getWalletClient();
      const publicClient = getPublicClient();
      
      await ensureWalletOnConfiguredChain();

      const [address] = await walletClient.getAddresses();
      if (!address) {
        setError('Please connect wallet first');
        return;
      }

      console.log(`[MintNFT] Starting to mint NFT, ImageId: ${imageId}, Recipient: ${address}`);

      const { request } = await publicClient.simulateContract({
        address: contractAddress,
        abi: EncryptedImageNFT_ABI,
        functionName: 'mintFromRegisteredImage',
        args: [imageId, address],
        account: address
      });

      const hash = await walletClient.writeContract(request);
      setTxHash(hash);

      console.log(`[MintNFT] Minting transaction submitted: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[MintNFT] Minting transaction confirmed:`, receipt);

      setSuccess(`NFT minted successfully! Transaction hash: ${hash}`);
      onMintSuccess?.();

    } catch (err) {
      console.error('[MintNFT] Minting failed:', err);
      setError(`Minting failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setMintingId(null);
    }
  };

  const setSuccess = (message: string) => {
    console.log('[MintNFT] Success:', message);
  };

  if (error) {
    return (
      <div style={{ 
        padding: 16, 
        background: '#fee2e2', 
        border: '2px solid #fecaca', 
        borderRadius: 12, 
        color: '#b91c1c',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Loading Failed</div>
        <div style={{ fontSize: 14 }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      {txHash && (
        <div style={{ 
          marginBottom: 16, 
          padding: 16, 
          background: '#d1fae5', 
          border: '2px solid #a7f3d0', 
          borderRadius: 12, 
          color: '#065f46',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Minting Transaction Submitted</div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            Transaction Hash: {txHash}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#374151' }}>Loading registered images...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
          {items.length === 0 ? (
            <div style={{ 
              gridColumn: '1/-1', 
              padding: 48, 
              textAlign: 'center', 
              color: '#6b7280', 
              border: '2px dashed #e5e7eb', 
              borderRadius: 16,
              background: '#f9fafb',
              boxShadow: '0 4px 8px rgba(0,0,0,0.05)'
            }}>
              No registered images yet.
            </div>
          ) : items.map((it) => {
            const isExpanded = expandedId === it.imageId;
            return (
              <div key={String(it.imageId)} style={{ 
                border: '2px solid #e5e7eb', 
                borderRadius: 16, 
                overflow: 'hidden', 
                background: 'white', 
                display: 'flex', 
                flexDirection: 'column',
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
                <div style={{ 
                  height: 160, 
                  background: '#f9fafb', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  {it.ipfsCid ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={buildGatewayUrl(it.ipfsCid)} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <div style={{ color: '#9ca3af' }}>No Preview</div>
                  )}
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 14, color: '#1f2937', fontWeight: 600 }}>{it.name || 'Untitled'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>ImageId: {String(it.imageId)}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Size: {it.width} &times; {it.height}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Creator: {it.creator}</div>
                   
                  {isExpanded && (
                    <div style={{ 
                      marginTop: 12, 
                      padding: 12, 
                      background: '#f8fafc', 
                      borderRadius: 8, 
                      fontSize: 11,
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Basic Info:</strong>
                        <div style={{ marginTop: 4, fontSize: 10 }}>
                          <div>• Ciphertext Root: {it.ciphertextRoot}</div>
                          <div>• Creator: {it.creator}</div>
                          <div>• Image Size: {it.width} &times; {it.height}</div>
                          <div>• Created Time: {new Date(Number(it.createdAt) * 1000).toLocaleString()}</div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <strong>IPFS Info:</strong>
                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2, fontSize: 10 }}>
                          CID: {it.ipfsCid}
                        </div>
                      </div>

                      <div style={{ marginBottom: 8, padding: 8, background: '#fef3c7', borderRadius: 6 }}>
                        <strong style={{ color: '#92400e' }}>Note:</strong>
                        <div style={{ color: '#92400e', fontSize: 10, marginTop: 2 }}>
                          This is registered image data containing encrypted fingerprint features and attributes. After minting NFT, you can view complete encrypted data details.
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : it.imageId)}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        color: '#6366f1',
                        border: '2px solid #6366f1',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isExpanded ? 'Collapse Details' : 'View Details'}
                    </button>
                    <button
                      onClick={() => onMint(it.imageId)}
                      disabled={mintingId === it.imageId}
                      style={{
                        padding: '8px 16px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        cursor: mintingId === it.imageId ? 'not-allowed' : 'pointer',
                        opacity: mintingId === it.imageId ? 0.7 : 1,
                        fontSize: 13,
                        fontWeight: 500,
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      {mintingId === it.imageId ? 'Minting…' : 'Mint'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
