'use client';

import { useEffect, useMemo, useState } from 'react';
import { readContract } from 'viem/actions';
import { AppConfig } from '../../config/app.config';
import { EncryptedImageNFT_ABI } from '../../config/abis/EncryptedImageNFT';
import { getPublicClient, hasViewPermission, ensureWalletOnConfiguredChain, getWalletClient, grantViewPermission, compareNftFingerprints } from '../../lib/contract';
import { buildGatewayUrl } from '../../lib/ipfs';
import { decryptNFTData, formatImageFeatures, type DecryptedNFTData } from '../../lib/decrypt';

type NFTAttribute = {
  trait_type: string;
  value: string;
};

type NFTDetailData = {
  tokenId: bigint;
  ipfsCid: string;
  width: number;
  height: number;
  createdAt: bigint;
  hasEncryptedData: boolean;
  name: string | null;
  plaintextAttributes: NFTAttribute[];
  encryptedAttributesCount: number;
  owner: string;
  originalCreator: string;
  copyright: string | null;
  description: string | null;
};

interface NFTDetailModalProps {
  tokenId: bigint;
  isOpen: boolean;
  onClose: () => void;
}

export function NFTDetailModal({ tokenId, isOpen, onClose }: NFTDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nftData, setNftData] = useState<NFTDetailData | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptStatus, setDecryptStatus] = useState<string>('');
  const [transferring, setTransferring] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantTo, setGrantTo] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [decryptedData, setDecryptedData] = useState<DecryptedNFTData | null>(null);
  const [, setHasPermission] = useState(false);
  const [encryptedAttributeTypes, setEncryptedAttributeTypes] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareOtherId, setCompareOtherId] = useState('');
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<null | boolean>(null);
  const [compareStatus, setCompareStatus] = useState<string>('');

  const contractAddress = AppConfig.zama.targetContractAddress as `0x${string}`;

  useEffect(() => {
    if (!isOpen || !tokenId) {
      return;
    }

    const loadNFTDetail = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const publicClient = getPublicClient();

        type ImageTuple = readonly [string, number | bigint, number | bigint, `0x${string}`, number | bigint];
        const imageData = await publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'images',
          args: [tokenId]
        }) as ImageTuple;

        const owner = await publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'ownerOf',
          args: [tokenId]
        }) as string;

        const originalCreator = await publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'originalCreator',
          args: [tokenId]
        }) as string;

        // Check if there is encrypted data
        const hasEncrypted = await publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'hasEncryptedData',
          args: [tokenId]
        }) as boolean;

        const [ipfsCid, width, height, , createdAt] = imageData;

        const plaintextAttributes: NFTAttribute[] = [];
        let name: string | null = null;
        let copyright: string | null = null;
        let description: string | null = null;
        
        try {
          const count = await readContract(publicClient, {
            address: contractAddress,
            abi: EncryptedImageNFT_ABI,
            functionName: 'getPlaintextAttributesCount',
            args: [tokenId]
          }) as bigint;

          const attrCount = Number(count);
          for (let i = 0; i < attrCount; i++) {
            try {
              const attr = await readContract(publicClient, {
                address: contractAddress,
                abi: EncryptedImageNFT_ABI,
                functionName: 'getPlaintextAttribute',
                args: [tokenId, BigInt(i)]
              }) as NFTAttribute;
              
              plaintextAttributes.push(attr);
              
              if (attr.trait_type === 'name') {
                name = attr.value;
              }
              if (attr.trait_type === 'copyright') {
                copyright = attr.value;
              }
              if (attr.trait_type === 'description') {
                description = attr.value;
              }
            } catch {
            }
          }
        } catch {
        }

        let encryptedAttributesCount = 0;
        const encryptedTypes: string[] = [];
        if (hasEncrypted) {
          try {
            const count = await readContract(publicClient, {
              address: contractAddress,
              abi: EncryptedImageNFT_ABI,
              functionName: 'getEncryptedAttributesCount',
              args: [tokenId]
            }) as bigint;
            encryptedAttributesCount = Number(count);
            
            for (let i = 0; i < encryptedAttributesCount; i++) {
              try {
                const traitType = await readContract(publicClient, {
                  address: contractAddress,
                  abi: EncryptedImageNFT_ABI,
                  functionName: 'getEncryptedAttributeType',
                  args: [tokenId, BigInt(i)]
                }) as string;
                encryptedTypes.push(traitType);
              } catch {
                encryptedTypes.push(`Attribute #${i + 1}`);
              }
            }
          } catch {
          }
        }
        
        setEncryptedAttributeTypes(encryptedTypes);

        setNftData({
          tokenId,
          ipfsCid: String(ipfsCid || ''),
          width: Number(width || 0),
          height: Number(height || 0),
          createdAt: BigInt(createdAt || 0),
          hasEncryptedData: hasEncrypted,
          name,
          plaintextAttributes,
          encryptedAttributesCount,
          owner,
          originalCreator,
          copyright,
          description
        });

      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError('Failed to load NFT details: ' + message);
      } finally {
        setLoading(false);
      }
    };

    loadNFTDetail();
  }, [isOpen, tokenId, contractAddress]);

  const handleDecrypt = async () => {
    if (!nftData?.hasEncryptedData) return;
    
    if (typeof window === 'undefined' || !window.ethereum) {
      console.log('Please connect wallet');
      return;
    }

    setDecrypting(true);
    setDecryptStatus('Initializing decryption...');
    console.log('[Decrypt] Starting decryption process...');
    
    try {
      setDecryptStatus('Getting wallet account...');
      console.log('[Decrypt] Getting wallet account...');
      const accounts = await window.ethereum.request({ 
        method: 'eth_accounts' 
      }) as string[];
      
      if (!accounts || accounts.length === 0) {
        console.log('Please connect wallet first');
        return;
      }

      const userAddress = accounts[0];
      console.log('[Decrypt] User address:', userAddress);

      setDecryptStatus('Checking view permissions...');
      console.log('[Decrypt] Checking view permissions...');
      const permission = await hasViewPermission(tokenId, userAddress);
      setHasPermission(permission);
      if (!permission) {
        console.log('You do not have permission to view encrypted data of this NFT');
        return;
      }
      console.log('[Decrypt] Permission check passed');

      setDecryptStatus('Decrypting data, please wait for wallet signature...');
      console.log('[Decrypt] Starting to execute decryption...');
      const decrypted = await decryptNFTData(tokenId, userAddress);
      console.log('[Decrypt] Decryption completed, result:', {
        imageFeatures: Object.keys(decrypted.imageFeatures).length,
        encryptedAttributes: decrypted.encryptedAttributes.length
      });
      setDecryptedData(decrypted);
      setDecryptStatus('Decryption successful!');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[Decrypt] Decryption failed details:', {
        error: e,
        message,
        stack: e instanceof Error ? e.stack : undefined
      });
      setDecryptStatus('Decryption failed: ' + message);
    } finally {
      console.log('[Decrypt] Decryption process ended');
      setTimeout(() => {
        setDecrypting(false);
        setDecryptStatus('');
      }, decryptStatus.includes('successful') ? 2000 : 5000);
    }
  };

  const handleOpenTransfer = () => {
    setTransferTo('');
    setTransferError(null);
    setShowTransferModal(true);
  };

  const handleOpenGrant = () => {
    setGrantTo('');
    setGrantError(null);
    setShowGrantModal(true);
  };

  const handleOpenCompare = () => {
    setCompareOtherId('');
    setCompareError(null);
    setCompareResult(null);
    setShowCompareModal(true);
  };

  const handleConfirmTransfer = async () => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        console.log('Please connect wallet');
        return;
      }

      await ensureWalletOnConfiguredChain();
      const walletClient = getWalletClient();
      const [from] = await walletClient.getAddresses();
      if (!from) {
        console.log('Current account not detected');
        return;
      }

      const toTrim = (transferTo || '').trim();
      if (!toTrim) {
        setTransferError('Please enter recipient address');
        return;
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(toTrim)) {
        setTransferError('Invalid recipient address');
        return;
      }

      setTransferring(true);
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: EncryptedImageNFT_ABI,
        functionName: 'safeTransferFrom',
        account: from,
        args: [from, toTrim as `0x${string}`, tokenId]
      });

      const publicClient = getPublicClient();
      await publicClient.waitForTransactionReceipt({ hash });

      try {
        const newOwner = await publicClient.readContract({
          address: contractAddress,
          abi: EncryptedImageNFT_ABI,
          functionName: 'ownerOf',
          args: [tokenId]
        }) as string;
        setNftData(prev => prev ? { ...prev, owner: newOwner } : prev);
      } catch {
      }

      setShowTransferModal(false);
      console.log('Transfer successful');
    } catch (e) {
      const message = e instanceof Error ? (e.stack || e.message) : String(e);
      console.log('Transfer failed: ' + message);
    } finally {
      setTransferring(false);
    }
  };

  const handleConfirmGrant = async () => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        console.log('Please connect wallet');
        return;
      }

      await ensureWalletOnConfiguredChain();
      const walletClient = getWalletClient();
      const [from] = await walletClient.getAddresses();
      if (!from) {
        console.log('Current account not detected');
        return;
      }

      const toTrim = (grantTo || '').trim();
      if (!toTrim) {
        setGrantError('Please enter grant address');
        return;
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(toTrim)) {
        setGrantError('Invalid grant address');
        return;
      }

      setGranting(true);
      const hash = await grantViewPermission(tokenId, toTrim as `0x${string}`);
      const publicClient = getPublicClient();
      await publicClient.waitForTransactionReceipt({ hash });
      setShowGrantModal(false);
      console.log('Grant successful');
    } catch (e) {
      const message = e instanceof Error ? (e.stack || e.message) : String(e);
      console.log('Grant failed: ' + message);
    } finally {
      setGranting(false);
    }
  };

  const handleConfirmCompare = async () => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        setCompareError('Please connect wallet');
        return;
      }

      const otherRaw = (compareOtherId || '').trim();
      if (!otherRaw) {
        setCompareError('Please enter Token ID to compare');
        return;
      }
      if (!/^\d+$/.test(otherRaw)) {
        setCompareError('Token ID must be a decimal number');
        return;
      }

      await ensureWalletOnConfiguredChain();
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        setCompareError('Current account not detected, please connect wallet first');
        return;
      }

      const userAddress = accounts[0];
      const otherId = BigInt(otherRaw);
      setComparing(true);
      setCompareError(null);
      setCompareResult(null);
      setCompareStatus('Checking permissions...');
      
      const isSimilar = await compareNftFingerprints(
        tokenId, 
        otherId, 
        userAddress,
        (status: string) => setCompareStatus(status)
      );
      setCompareResult(isSimilar);
      setCompareStatus('Comparison completed');
    } catch (e) {
      const message = e instanceof Error ? (e.stack || e.message) : String(e);
      setCompareError('Comparison failed: ' + message);
    } finally {
      setComparing(false);
      setCompareStatus('');
    }
  };

  const combinedAttributes: NFTAttribute[] = useMemo(() => {
    const list: NFTAttribute[] = [];
    if (nftData?.plaintextAttributes?.length) {
      list.push(
        ...nftData.plaintextAttributes.filter(a => {
          const t = (a.trait_type || '').toLowerCase();
          if (t === 'name') return false;
          if (t === 'copyright') return false;
          if (t === 'description') return false;
          return true;
        })
      );
    }
    const widthVal = nftData?.width ?? 0;
    const heightVal = nftData?.height ?? 0;
    if (widthVal > 0 && heightVal > 0) {
      list.unshift({ trait_type: 'Size', value: `${widthVal} × ${heightVal}` });
    }
    if (nftData?.hasEncryptedData && (nftData.encryptedAttributesCount || 0) > 0) {
      const decryptedMap = new Map<string, string>();
      if (decryptedData?.encryptedAttributes?.length) {
        for (const a of decryptedData.encryptedAttributes) {
          decryptedMap.set(a.trait_type, a.value);
        }
      }
      for (const traitType of encryptedAttributeTypes) {
        const t = (traitType || '').toLowerCase();
        if (t === 'copyright') {
          continue;
        }
        if (t === 'description') {
          continue;
        }
        const value = decryptedMap.get(traitType) ?? '[ENCRYPTED]';
        list.push({ trait_type: traitType, value });
      }
    }
    return list;
  }, [nftData, decryptedData, encryptedAttributeTypes]);

  const copyrightToShow = useMemo(() => {
    if (nftData?.copyright) return nftData.copyright;
    if (decryptedData?.encryptedAttributes?.length) {
      for (const a of decryptedData.encryptedAttributes) {
        const t = (a.trait_type || '').toLowerCase();
        if (t === 'copyright') {
          return a.value;
        }
      }
    }
    if (Array.isArray(encryptedAttributeTypes)) {
      for (const tt of encryptedAttributeTypes) {
        const t = (tt || '').toLowerCase();
        if (t === 'copyright') {
          return '[ENCRYPTED]';
        }
      }
    }
    return null;
  }, [nftData, decryptedData, encryptedAttributeTypes]);

  const descriptionToShow = useMemo(() => {
    if (nftData?.description) return nftData.description;
    if (decryptedData?.encryptedAttributes?.length) {
      for (const a of decryptedData.encryptedAttributes) {
        const t = (a.trait_type || '').toLowerCase();
        if (t === 'description') {
          return a.value;
        }
      }
    }
    if (Array.isArray(encryptedAttributeTypes)) {
      for (const tt of encryptedAttributeTypes) {
        const t = (tt || '').toLowerCase();
        if (t === 'description') {
          return '[ENCRYPTED]';
        }
      }
    }
    return null;
  }, [nftData, decryptedData, encryptedAttributeTypes]);

  if (!isOpen) return null;

  return (
    <>
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        maxWidth: 1200,
        width: '100%',
        maxHeight: '95vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1f2937' }}>
            NFT Details
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ 
          padding: 24,
          maxHeight: 'calc(95vh - 80px)',
          overflowY: 'auto'
        }}>
          {loading ? (
            <div style={{ 
              padding: 48, 
              textAlign: 'center', 
              color: '#6b7280' 
            }}>
              Loading NFT details...
            </div>
          ) : error ? (
            <div style={{ 
              padding: 24, 
              textAlign: 'center', 
              color: '#ef4444',
              background: '#fee2e2',
              borderRadius: 8
            }}>
              {error}
            </div>
          ) : nftData ? (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '300px 1fr', 
                gap: 24,
                marginBottom: 24
              }}>
                {/* Image */}
                <div style={{
                  background: '#f9fafb',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {nftData.ipfsCid ? (
                    <img 
                      src={buildGatewayUrl(nftData.ipfsCid)} 
                      alt={`NFT #${nftData.tokenId}`}
                      style={{ 
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          parent.innerHTML = '<div style="color: #9ca3af; font-size: 16px;">Image load failed</div>';
                        }
                      }}
                    />
                  ) : (
                    <div style={{ color: '#9ca3af', fontSize: 16 }}>
                      {nftData.hasEncryptedData ? 'Encrypted NFT' : 'No image data'}
                    </div>
                  )}
                </div>

                <div>
                  <h3 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: 28, 
                    fontWeight: 600,
                    color: '#1f2937'
                  }}>
                    {nftData.name || `NFT #${String(nftData.tokenId)}`}
                  </h3>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: 12,
                    marginBottom: 20,
                    gridAutoFlow: 'row dense'
                  }}>
                    <div style={{ 
                      background: '#f8fafc', 
                      padding: 12, 
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Token ID</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>#{String(nftData.tokenId)}</div>
                    </div>
                    
                    <div style={{ 
                      background: '#f8fafc', 
                      padding: 12, 
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Minted At</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>
                        {new Date(Number(nftData.createdAt) * 1000).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ 
                      background: '#f8fafc', 
                      padding: 12, 
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Owner</div>
                      <div style={{ 
                        fontSize: 13, 
                        fontFamily: 'monospace', 
                        fontWeight: 600,
                        color: '#1e293b'
                      }}>
                        {nftData.owner.slice(0, 6)}...{nftData.owner.slice(-4)}
                      </div>
                    </div>

                    <div style={{ 
                      background: '#f8fafc', 
                      padding: 12, 
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Original Creator</div>
                      <div style={{ 
                        fontSize: 13, 
                        fontFamily: 'monospace', 
                        fontWeight: 600,
                        color: '#1e293b'
                      }}>
                        {nftData.originalCreator.slice(0, 6)}...{nftData.originalCreator.slice(-4)}
                      </div>
                    </div>

                    {copyrightToShow && (
                      <div style={{ 
                        background: (() => {
                          const enc = encryptedAttributeTypes.some(tt => (tt || '').toLowerCase() === 'copyright');
                          if (!enc) return '#f8fafc';
                          if (copyrightToShow === '[ENCRYPTED]') return '#fef3c7';
                          return '#dcfce7';
                        })(), 
                        padding: 12, 
                        borderRadius: 8,
                        border: (() => {
                          const enc = encryptedAttributeTypes.some(tt => (tt || '').toLowerCase() === 'copyright');
                          if (!enc) return '1px solid #e2e8f0';
                          if (copyrightToShow === '[ENCRYPTED]') return '1px solid #f59e0b';
                          return '1px solid #86efac';
                        })(),
                        gridColumn: 'span 2'
                      }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Copyright</div>
                        <div style={{ 
                          fontSize: 13, 
                          color: (copyrightToShow === '[ENCRYPTED]') ? '#dc2626' : '#1e293b', 
                          fontWeight: (copyrightToShow === '[ENCRYPTED]') ? 500 : 600, 
                          wordBreak: 'break-word',
                          fontFamily: (copyrightToShow === '[ENCRYPTED]') ? 'monospace' : 'inherit'
                        }}>
                          {copyrightToShow}
                        </div>
                      </div>
                    )}

                    {/* Description (removed from attributes, displayed separately; plaintext/decrypted/placeholder) */}
                    {descriptionToShow && (
                      <div style={{ 
                        background: (() => {
                          const enc = encryptedAttributeTypes.some(tt => (tt || '').toLowerCase() === 'description');
                          if (!enc) return '#f8fafc';
                          if (descriptionToShow === '[ENCRYPTED]') return '#fef3c7';
                          return '#dcfce7';
                        })(), 
                        padding: 12, 
                        borderRadius: 8,
                        border: (() => {
                          const enc = encryptedAttributeTypes.some(tt => (tt || '').toLowerCase() === 'description');
                          if (!enc) return '1px solid #e2e8f0';
                          if (descriptionToShow === '[ENCRYPTED]') return '1px solid #f59e0b';
                          return '1px solid #86efac';
                        })(),
                        gridColumn: 'span 2'
                      }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Description</div>
                        <div style={{ fontSize: 13, color: descriptionToShow === '[ENCRYPTED]' ? '#dc2626' : '#1e293b', fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: descriptionToShow === '[ENCRYPTED]' ? 'monospace' : 'inherit' }}>
                          {descriptionToShow}
                        </div>
                      </div>
                    )}
                  </div>
                  
                </div>
              </div>

              {/* Attributes (plaintext + encrypted, replaced in place after decryption) */}
              {(combinedAttributes.length > 0) && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: 18, 
                    fontWeight: 600,
                    color: '#1e293b'
                  }}>
                    Attributes ({combinedAttributes.length})
                  </h4>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                    gap: 10,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    padding: '4px'
                  }}>
                    {combinedAttributes.map((attr, index) => {
                      const wasEncrypted = encryptedAttributeTypes.includes(attr.trait_type);
                      const isEncrypted = wasEncrypted && attr.value === '[ENCRYPTED]';
                      const cardBg = isEncrypted ? '#fef3c7' : (wasEncrypted ? '#dcfce7' : '#ffffff');
                      const cardBorder = isEncrypted ? '#f59e0b' : (wasEncrypted ? '#86efac' : '#e2e8f0');
                      return (
                        <div
                          key={index}
                          style={{
                            background: cardBg,
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div style={{ 
                            fontSize: 11, 
                            color: '#64748b', 
                            fontWeight: 500,
                            marginBottom: 4,
                            textTransform: 'uppercase',
                            letterSpacing: '0.025em'
                          }}>
                            {attr.trait_type}
                          </div>
                          <div style={{ 
                            fontSize: 13, 
                            color: attr.value === '[ENCRYPTED]' ? '#dc2626' : '#0f172a', 
                            fontWeight: attr.value === '[ENCRYPTED]' ? 500 : 600,
                            wordBreak: 'break-word',
                            fontFamily: attr.value === '[ENCRYPTED]' ? 'monospace' : 'inherit'
                          }}>
                            {attr.value}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Encrypted data info (keep button; attributes shown in Attributes section) */}
              {nftData.hasEncryptedData && (
                <div>
                  <h4 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: 18, 
                    fontWeight: 600,
                    color: '#1e293b'
                  }}>
                    Encrypted Data
                  </h4>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', 
                    padding: 20, 
                    borderRadius: 12,
                    border: '1px solid #86efac',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 16
                    }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        background: '#059669',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        ⦿
                      </div>
                      <div>
                        <div style={{ 
                          color: '#065f46', 
                          fontSize: 16,
                          fontWeight: 600,
                          marginBottom: 4
                        }}>
                          Contains encrypted fingerprint features and attributes
                        </div>
                        <div style={{ 
                          color: '#047857', 
                          fontSize: 14
                        }}>
                          Encrypted attributes: {nftData.encryptedAttributesCount}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <button
                        onClick={handleDecrypt}
                        disabled={decrypting}
                        style={{
                          background: decrypting ? '#6b7280' : '#059669',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: 8,
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: decrypting ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!decrypting) {
                            e.currentTarget.style.background = '#047857';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!decrypting) {
                            e.currentTarget.style.background = '#059669';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
{decrypting ? (decryptStatus || 'Decrypting...') : 'Decrypt to View'}
                      </button>

                      <button
                        onClick={handleOpenTransfer}
                        disabled={transferring}
                        style={{
                          background: transferring ? '#6b7280' : '#2563eb',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: 8,
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: transferring ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!transferring) {
                            e.currentTarget.style.background = '#1d4ed8';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!transferring) {
                            e.currentTarget.style.background = '#2563eb';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
                        {transferring ? 'Transferring...' : 'Transfer'}
                      </button>

                      <button
                        onClick={handleOpenGrant}
                        disabled={granting}
                        style={{
                          background: granting ? '#6b7280' : '#7c3aed',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: 8,
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: granting ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!granting) {
                            e.currentTarget.style.background = '#6d28d9';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!granting) {
                            e.currentTarget.style.background = '#7c3aed';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
                        {granting ? 'Granting...' : 'Grant'}
                      </button>

                      <button
                        onClick={handleOpenCompare}
                        disabled={comparing}
                        style={{
                          background: comparing ? '#6b7280' : '#0ea5e9',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: 8,
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: comparing ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!comparing) {
                            e.currentTarget.style.background = '#0284c7';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!comparing) {
                            e.currentTarget.style.background = '#0ea5e9';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
                        {comparing ? 'Comparing...' : 'Compare NFT Fingerprints'}
                      </button>
                    </div>
                  </div>

                  {/* Decryption results: only show image features; attributes are displayed in place in "Attributes" section above */}
                  {decryptedData && (
                    <div style={{ marginTop: 24 }}>
                      {Object.keys(decryptedData.imageFeatures).length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ 
                            fontSize: 14, 
                            fontWeight: 500, 
                            color: '#047857',
                            marginBottom: 8
                          }}>
                            Image fingerprint features:
                          </div>
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                            gap: 8
                          }}>
                            {Object.entries(formatImageFeatures(decryptedData.imageFeatures)).map(([key, value]) => (
                              <div key={key} style={{
                                background: 'rgba(255, 255, 255, 0.7)',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid #86efac',
                                fontSize: 12
                              }}>
                                <div style={{ fontWeight: 600, color: '#065f46' }}>{key}:</div>
                                <div style={{ color: '#047857', marginTop: 2 }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>

    {showTransferModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 20
      }}>
        <div style={{
          background: 'white',
          borderRadius: 12,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            padding: '16px 18px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Transfer NFT</div>
            <button
              onClick={() => setShowTransferModal(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                color: '#6b7280'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>To Address</div>
            <input
              value={transferTo}
              onChange={(e) => {
                setTransferTo(e.target.value);
                if (transferError) setTransferError(null);
              }}
              placeholder="0x..."
              spellCheck={false}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${transferError ? '#ef4444' : '#e2e8f0'}`,
                fontFamily: 'monospace',
                fontSize: 14,
                outline: 'none'
              }}
            />
            {transferError && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{transferError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowTransferModal(false)}
                disabled={transferring}
                style={{
                  background: 'white',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={transferring}
                style={{
                  background: transferring ? '#6b7280' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: transferring ? 'not-allowed' : 'pointer'
                }}
              >
                {transferring ? 'Sending...' : 'Confirm Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {showGrantModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 20
      }}>
        <div style={{
          background: 'white',
          borderRadius: 12,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            padding: '16px 18px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Grant View Permission</div>
            <button
              onClick={() => setShowGrantModal(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                color: '#6b7280'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>Grant Address</div>
            <input
              value={grantTo}
              onChange={(e) => {
                setGrantTo(e.target.value);
                if (grantError) setGrantError(null);
              }}
              placeholder="0x..."
              spellCheck={false}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${grantError ? '#ef4444' : '#e2e8f0'}`,
                fontFamily: 'monospace',
                fontSize: 14,
                outline: 'none'
              }}
            />
            {grantError && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{grantError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowGrantModal(false)}
                disabled={granting}
                style={{
                  background: 'white',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGrant}
                disabled={granting}
                style={{
                  background: granting ? '#6b7280' : '#7c3aed',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: granting ? 'not-allowed' : 'pointer'
                }}
              >
                {granting ? 'Sending...' : 'Confirm Grant'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {showCompareModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 20
      }}>
        <div style={{
          background: 'white',
          borderRadius: 12,
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            padding: '16px 18px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Compare NFT Fingerprints</div>
            <button
              onClick={() => {
                setShowCompareModal(false);
                setCompareOtherId('');
                setCompareError(null);
                setCompareResult(null);
                setCompareStatus('');
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                color: '#6b7280'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>Current Token ID</div>
                <input
                  value={String(tokenId)}
                  readOnly
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: 14,
                    background: '#f8fafc',
                    color: '#475569'
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>Compare Token ID</div>
                <input
                  value={compareOtherId}
                  onChange={(e) => {
                    setCompareOtherId(e.target.value);
                    if (compareError) setCompareError(null);
                  }}
                  placeholder="Enter Token ID"
                  spellCheck={false}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${compareError ? '#ef4444' : '#e2e8f0'}`,
                    fontFamily: 'monospace',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
              </div>
            </div>
            {compareError && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{compareError}</div>
            )}
            {compareResult !== null && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${compareResult ? '#86efac' : '#fecaca'}`,
                  background: compareResult ? '#f0fdf4' : '#fef2f2',
                  color: compareResult ? '#166534' : '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {compareResult ? 'Fingerprints are similar (below threshold)' : 'Fingerprints are not similar (above threshold)'}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCompareModal(false);
                  setCompareOtherId('');
                  setCompareError(null);
                  setCompareResult(null);
                  setCompareStatus('');
                }}
                disabled={comparing}
                style={{
                  background: 'white',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCompare}
                disabled={comparing}
                style={{
                  background: comparing ? '#6b7280' : '#0ea5e9',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: comparing ? 'not-allowed' : 'pointer'
                }}
              >
                {comparing ? (compareStatus || 'Comparing...') : 'Start Compare'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
