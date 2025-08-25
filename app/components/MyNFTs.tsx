'use client';

import { useEffect, useMemo, useState } from 'react';
import { readContract } from 'viem/actions';
import { AppConfig } from '../../config/app.config';
import { EncryptedImageNFT_ABI } from '../../config/abis/EncryptedImageNFT';
import { getPublicClient } from '../../lib/contract';
import { buildGatewayUrl } from '../../lib/ipfs';
import { NFTDetailModal } from './NFTDetailModal';

type MyNFT = {
  tokenId: bigint;
  ipfsCid: string;
  width: number;
  height: number;
  createdAt: bigint;
  hasEncryptedData: boolean;
  name: string | null;
};

interface MyNFTsProps {
  userAddress: string;
  refresh?: number;
}

export function MyNFTs({ userAddress, refresh = 0 }: MyNFTsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfts, setNfts] = useState<MyNFT[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const contractAddress = useMemo(() => AppConfig.zama.targetContractAddress as `0x${string}` | undefined, []);

  const handleViewDetail = (tokenId: bigint) => {
    setSelectedTokenId(tokenId);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTokenId(null);
  };

  useEffect(() => {
    if (!userAddress || !contractAddress) {
      return;
    }
    
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const publicClient = getPublicClient();
        
        const balance = await publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'balanceOf',
          args: [userAddress as `0x${string}`]
        }) as bigint;

        if (balance === 0n) {
          setNfts([]);
          return;
        }

        const totalSupply = await publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'totalSupply'
        }) as bigint;

        const userNFTs: MyNFT[] = [];
        const max = Number(totalSupply || 0n);

        for (let tokenId = 1; tokenId <= max; tokenId++) {
          try {
            const owner = await publicClient.readContract({
              address: contractAddress,
              abi: EncryptedImageNFT_ABI,
              functionName: 'ownerOf',
              args: [BigInt(tokenId)]
            }) as string;

            if (owner.toLowerCase() === userAddress.toLowerCase()) {
              type ImageTuple = readonly [string, number | bigint, number | bigint, `0x${string}`, number | bigint];
              const imageData = await publicClient.readContract({
                address: contractAddress,
                abi: EncryptedImageNFT_ABI,
                functionName: 'images',
                args: [BigInt(tokenId)]
              }) as ImageTuple;

              const hasEncrypted = await publicClient.readContract({
                address: contractAddress,
                abi: EncryptedImageNFT_ABI,
                functionName: 'hasEncryptedData',
                args: [BigInt(tokenId)]
              }) as boolean;

              const [ipfsCid, width, height, , createdAt] = imageData;

              let name: string | null = null;
              try {
                const count = await readContract(publicClient, {
                  address: contractAddress,
                  abi: EncryptedImageNFT_ABI,
                  functionName: 'getPlaintextAttributesCount',
                  args: [BigInt(tokenId)]
                }) as bigint;

                const attrCount = Number(count);
                for (let i = 0; i < Math.min(attrCount, 10); i++) {
                  try {
                    const attr = await readContract(publicClient, {
                      address: contractAddress,
                      abi: EncryptedImageNFT_ABI,
                      functionName: 'getPlaintextAttribute',
                      args: [BigInt(tokenId), BigInt(i)]
                    }) as { trait_type: string; value: string };
                    
                    if (attr.trait_type === 'Name' || attr.trait_type === 'name') {
                      name = attr.value;
                      break;
                    }
                  } catch {
                  }
                }
              } catch {
              }

              const nftData = {
                tokenId: BigInt(tokenId),
                ipfsCid: String(ipfsCid || ''),
                width: Number(width || 0),
                height: Number(height || 0), 
                createdAt: BigInt(createdAt || 0),
                hasEncryptedData: hasEncrypted,
                name
              };

              userNFTs.push(nftData);
            }
          } catch {
            // Skip non-existent tokenId
          }
        }

        setNfts(userNFTs);

              } catch (e) {
          const message = e instanceof Error ? (e.stack || e.message) : String(e);
          setError('Failed to read NFT: ' + message);
        } finally {
          setLoading(false);
        }
      })();
    }, [userAddress, contractAddress, refresh]);

  if (typeof window === 'undefined' || !mounted || !userAddress) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ 
          padding: 48, 
          textAlign: 'center', 
          color: '#6b7280',
          border: '1px dashed #e5e7eb',
          borderRadius: 12,
          background: '#f9fafb'
        }}>
          Please connect your wallet to view your NFTs
        </div>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>
        Contract address not configured, please set zama.targetContractAddress in config/app.config.ts
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      
      {error && (
        <div style={{ 
          marginBottom: 16, 
          color: '#b91c1c', 
          background: '#fee2e2', 
          border: '1px solid #fecaca', 
          padding: '12px 16px', 
          borderRadius: 8 
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#374151' }}>
          Loading your NFTs...
        </div>
      ) : nfts.length === 0 ? (
        <div style={{ 
          padding: 48, 
          textAlign: 'center', 
          color: '#6b7280',
          border: '2px dashed #e5e7eb',
          borderRadius: 16,
          background: '#f9fafb',
          boxShadow: '0 4px 8px rgba(0,0,0,0.05)'
        }}>
          You don&apos;t own any NFTs yet
          <br />
          <span style={{ fontSize: 14, marginTop: 8, display: 'block' }}>
            Go register and mint an NFT!
          </span>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: 24 
        }}>
          {nfts.map((nft) => (
            <div
              key={String(nft.tokenId)}
              style={{
                border: '2px solid #e5e7eb',
                borderRadius: 16,
                overflow: 'hidden',
                background: 'white',
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
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
                height: 200, 
                background: '#f3f4f6', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                position: 'relative',
                borderBottom: '2px solid #e5e7eb'
              }}>
                {nft.ipfsCid ? (
                  <img 
                    src={buildGatewayUrl(nft.ipfsCid)} 
                    alt={`NFT #${nft.tokenId}`}
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%', 
                      objectFit: 'contain' 
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        parent.innerHTML = '<div style="color: #9ca3af; font-size: 14px;">Image loading failed</div>';
                      }
                    }}
                  />
                ) : (
                  <div style={{ color: '#9ca3af', fontSize: 14 }}>
                    {nft.hasEncryptedData ? 'Encrypted NFT' : 'No Image Data'}
                  </div>
                )}
                
                {nft.hasEncryptedData && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    Encrypted
                  </div>
                )}
                
                <button
                  onClick={() => handleViewDetail(nft.tokenId)}
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    background: 'rgba(79, 70, 229, 0.9)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(79, 70, 229, 1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(79, 70, 229, 0.9)';
                  }}
                >
                  View Details
                </button>
              </div>
              
              <div style={{ padding: 16 }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: 8 
                }}>
                  <h3 style={{ 
                    fontSize: 16, 
                    fontWeight: 600, 
                    color: '#1f2937',
                    margin: 0
                  }}>
                    {nft.name || `NFT #${nft.tokenId}`}
                  </h3>
                  <span style={{ 
                    fontSize: 12, 
                    color: '#6b7280',
                    background: '#f3f4f6',
                    padding: '4px 8px',
                    borderRadius: 6,
                    fontWeight: 500
                  }}>
                    #{nft.tokenId}
                  </span>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#6b7280'
                }}>
                  <span>Size: {nft.width} &times; {nft.height}</span>
                  <span>Created: {new Date(Number(nft.createdAt) * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTokenId && (
        <NFTDetailModal
          tokenId={selectedTokenId}
          isOpen={showDetailModal}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
