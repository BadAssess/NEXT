'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { pinFileToIpfs } from '@/lib/ipfs';
import { extractImageFeatures } from '@/lib/image-features';
import { initFhevm, encryptFeaturesWithProof, encryptAttributeWithProof } from '@/lib/fhe';
import { registerEncryptedImage } from '@/lib/contract';
import { AppConfig } from '@/config/app.config';

import { MyNFTs } from '@/app/components/MyNFTs';
import { MintNFT } from '@/app/components/MintNFT';
import { TraitTypeInput } from '@/app/components/TraitTypeInput';
import { getInitState, subscribeInitState } from '@/lib/init-state';

interface RequiredFields {
	name: string;
	description: string;
	copyright: string;
	descriptionEncrypted: boolean;
	copyrightEncrypted: boolean;
}

interface NFTAttribute {
	id: string;
	trait_type: string;
	value: string;
	isEncrypted: boolean;
}

interface EncryptionSummary {
	ciphertextRoot: `0x${string}`;
	inputTag: `0x${string}`;
	ipfsCid: string;
	name: string;
	featureHandles: `0x${string}`[];
	featureProof: `0x${string}`;
	encryptedFields: { label: string; value: string }[];
	encryptedAttributes: { trait_type: string; value: string }[];
	attributeInputs: { trait_type: string; encryptedData: `0x${string}`[]; inputProof: `0x${string}`; totalBytes: number }[];
}

interface EncryptionData {
    imgWidth: number;
    imgHeight: number;
	encryptedFeatures: `0x${string}`[];
	inputProof: `0x${string}`;
    inputTag: `0x${string}`;
    ciphertextRoot: `0x${string}`;
    encryptedAttributeInputs: { trait_type: string; encryptedData: `0x${string}`[]; inputProof: `0x${string}`; totalBytes: number }[];
	plainAttributes: { trait_type: string; value: string }[];
    encryptedFields: { label: string; value: string }[];
    encryptedAttributes: { trait_type: string; value: string }[];
}

export default function Home() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string>('');
	const [uploadedCid, setUploadedCid] = useState<string>('');
	const [uploadedGatewayUrl, setUploadedGatewayUrl] = useState<string>('');
	const [requiredFields, setRequiredFields] = useState<RequiredFields>({
		name: '',
		description: '',
		copyright: '',
		descriptionEncrypted: false,
		copyrightEncrypted: false
	});
	const [nftAttributes, setNftAttributes] = useState<NFTAttribute[]>([]);

	const [isEncrypting, setIsEncrypting] = useState(false);
	const [nftRefresh, setNftRefresh] = useState(0);
	const [currentStep, setCurrentStep] = useState(1);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [encryptProgress, setEncryptProgress] = useState(0);
	const [error, setError] = useState<string>('');
	const [success, setSuccess] = useState<string>('');
	const [isUploadedToIpfs, setIsUploadedToIpfs] = useState(false);
	const [encryptionSummary, setEncryptionSummary] = useState<EncryptionSummary | null>(null);
	const [encryptionData, setEncryptionData] = useState<EncryptionData | null>(null);
	const [initState, setInitState] = useState(getInitState());
	const [selectedNftTab, setSelectedNftTab] = useState<'owned' | 'mint'>('owned');

	const fileInputRef = useRef<HTMLInputElement>(null);
	const { address: userAddress } = useAccount();
	const chainId = useChainId();
	const { switchChain } = useSwitchChain();

	const isCorrectNetwork = chainId === AppConfig.chainId;

	useEffect(() => {
		const unsubscribe = subscribeInitState(setInitState);
		return unsubscribe;
	}, []);

	useEffect(() => {
		if ((initState.fhe as string) === 'error') {
			setError('FHE service initialization failed, application unavailable. Please check network connection or contact administrator.');
		}
	}, [initState.fhe]);

	useEffect(() => {
		if (error) {
			const timer = setTimeout(() => setError(''), 5000);
			return () => clearTimeout(timer);
		}
	}, [error]);

	useEffect(() => {
		if (success) {
			const timer = setTimeout(() => setSuccess(''), 5000);
			return () => clearTimeout(timer);
		}
	}, [success]);

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			setError('Please select a valid image file');
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			setError('Image size cannot exceed 10MB');
			return;
		}

		setSelectedFile(file);
		setPreviewUrl(URL.createObjectURL(file));
		setCurrentStep(2);
		setError('');
	};

	const updateRequiredField = (field: keyof RequiredFields, value: string | boolean) => {
		setRequiredFields(prev => ({ ...prev, [field]: value }));
	};

	const addAttribute = () => {
		const newAttribute: NFTAttribute = {
			id: Date.now().toString(),
			trait_type: '',
			value: '',
			isEncrypted: false
		};
		setNftAttributes(prev => [...prev, newAttribute]);
	};

	const updateAttribute = (id: string, field: keyof NFTAttribute, value: string | boolean) => {
		setNftAttributes(prev => 
			prev.map(attr => 
			attr.id === id ? { ...attr, [field]: value } : attr
			)
		);
	};

	const removeAttribute = (id: string) => {
		setNftAttributes(prev => prev.filter(attr => attr.id !== id));
	};

	const uploadToIpfs = async () => {
		if (!selectedFile) return;

		try {
			setUploadProgress(0);
			const interval = setInterval(() => {
				setUploadProgress(prev => {
					if (prev >= 90) {
						clearInterval(interval);
						return 90;
					}
					return prev + 10;
				});
			}, 200);

			const { cid, gatewayUrl } = await pinFileToIpfs(selectedFile);
			setUploadedCid(cid);
			setUploadedGatewayUrl(gatewayUrl);
			setUploadProgress(100);
			setCurrentStep(3);
			setIsUploadedToIpfs(true);
			
			clearInterval(interval);
		} catch (err) {
			console.error('IPFS upload failed:', err);
			setError('IPFS upload failed, please retry');
		}
	};

	const encryptOnly = async () => {
		if (!selectedFile || !uploadedCid || !requiredFields.name || !userAddress) {
			setError('Please complete file selection, fill in name and upload to IPFS first');
				return;
			}

		try {
			setIsEncrypting(true);
			setEncryptProgress(0);
			setError('');

			await initFhevm();
			setEncryptProgress(20);

			const imgFeatures = await extractImageFeatures(selectedFile);
			setEncryptProgress(40);

			const { encryptedFeatures, inputProof, inputTag, ciphertextRoot } = await encryptFeaturesWithProof(
				AppConfig.zama.targetContractAddress,
				userAddress as `0x${string}`,
				imgFeatures
			);
			setEncryptProgress(60);

			const encryptedAttributeInputs: { trait_type: string; encryptedData: `0x${string}`[]; inputProof: `0x${string}`; totalBytes: number }[] = [];
			let descriptionPreview: string | null = null;
			let copyrightPreview: string | null = null;
			for (const attr of nftAttributes) {
				if (attr.isEncrypted && attr.trait_type && attr.value) {
					const { encryptedData, inputProof: attrProof, totalBytes } = await encryptAttributeWithProof(
						AppConfig.zama.targetContractAddress,
						userAddress as `0x${string}`,
						attr.value
					);
					encryptedAttributeInputs.push({ trait_type: attr.trait_type, encryptedData, inputProof: attrProof, totalBytes });
				}
			}
			setEncryptProgress(80);

			const plainAttributes: { trait_type: string; value: string }[] = [];
			
			if (requiredFields.name) {
				plainAttributes.push({ trait_type: 'name', value: requiredFields.name });
			}
			
			if (requiredFields.description && !requiredFields.descriptionEncrypted) {
				plainAttributes.push({ trait_type: 'description', value: requiredFields.description });
			}
			
			if (requiredFields.copyright && !requiredFields.copyrightEncrypted) {
				plainAttributes.push({ trait_type: 'copyright', value: requiredFields.copyright });
			}
			
			const customPlainAttributes = nftAttributes
				.filter(attr => !attr.isEncrypted && attr.trait_type && attr.value)
				.map(attr => ({ trait_type: attr.trait_type, value: attr.value }));
			plainAttributes.push(...customPlainAttributes);

			setEncryptProgress(100);
			const encryptedFields: { label: string; value: string }[] = [];
			if (requiredFields.descriptionEncrypted && requiredFields.description) {
				const { encryptedData, inputProof: descProof, totalBytes: descBytes } = await encryptAttributeWithProof(
					AppConfig.zama.targetContractAddress,
					userAddress as `0x${string}`,
					requiredFields.description
				);
				descriptionPreview = `Encrypted: ${encryptedData[0].slice(0, 20)}...`;
				encryptedFields.push({ label: 'Description(Encrypted)', value: descriptionPreview });
				encryptedAttributeInputs.push({ trait_type: 'description', encryptedData, inputProof: descProof, totalBytes: descBytes });
			}
			if (requiredFields.copyrightEncrypted && requiredFields.copyright) {
				const { encryptedData, inputProof: crProof, totalBytes: crBytes } = await encryptAttributeWithProof(
					AppConfig.zama.targetContractAddress,
					userAddress as `0x${string}`,
					requiredFields.copyright
				);
				copyrightPreview = `Encrypted: ${encryptedData[0].slice(0, 20)}...`;
				encryptedFields.push({ label: 'Copyright(Encrypted)', value: copyrightPreview });
				encryptedAttributeInputs.push({ trait_type: 'copyright', encryptedData, inputProof: crProof, totalBytes: crBytes });
			}
			const encryptedAttributesBrief = nftAttributes
				.filter(attr => attr.isEncrypted && attr.trait_type && attr.value)
				.map(attr => {
					const input = encryptedAttributeInputs.find(input => input.trait_type === attr.trait_type);
					return { 
						trait_type: attr.trait_type, 
						value: input ? `Encrypted: ${input.encryptedData[0].slice(0, 20)}...` : '[ENCRYPTED]' 
					};
				});
			const extraEncryptedBrief: { trait_type: string; value: string }[] = [];
			if (descriptionPreview) {
				extraEncryptedBrief.push({ trait_type: 'description', value: descriptionPreview });
			}
			if (copyrightPreview) {
				extraEncryptedBrief.push({ trait_type: 'copyright', value: copyrightPreview });
			}
			const combinedEncryptedBrief = encryptedAttributesBrief.concat(extraEncryptedBrief);

			setEncryptionData({
				imgWidth: imgFeatures.width,
				imgHeight: imgFeatures.height,
				encryptedFeatures: encryptedFeatures as `0x${string}`[],
				inputProof,
				inputTag,
				ciphertextRoot,
				encryptedAttributeInputs,
				plainAttributes,
				encryptedFields,
				encryptedAttributes: combinedEncryptedBrief
			});

			setEncryptionSummary({
				ciphertextRoot,
				inputTag,
				ipfsCid: uploadedCid,
				name: requiredFields.name,
				featureHandles: encryptedFeatures as `0x${string}`[],
				featureProof: inputProof,
				encryptedFields,
				encryptedAttributes: combinedEncryptedBrief,
				attributeInputs: encryptedAttributeInputs
			});
			setSuccess('Encryption successful, ready for on-chain registration');
		} catch (err) {
			console.error('Encryption failed:', err);
			setError(`Encryption failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			setIsEncrypting(false);
			setEncryptProgress(0);
		}
	};

	const registerOnly = async () => {
		if (!encryptionData || !uploadedCid) {
			setError('Please complete encryption first');
				return;
			}

		if (!isCorrectNetwork) {
			try {
				if (switchChain) {
					switchChain({ chainId: AppConfig.chainId });
				}
			} catch (e) {
				console.error('Network switch failed:', e);
			}
			return;
		}

		try {
			await registerEncryptedImage({
				ciphertextRoot: encryptionData.ciphertextRoot,
				inputTag: encryptionData.inputTag,
				ipfsCid: uploadedCid,
				width: encryptionData.imgWidth,
				height: encryptionData.imgHeight,
				encryptedFeatures: encryptionData.encryptedFeatures,
				inputProof: encryptionData.inputProof,
				plainAttributes: encryptionData.plainAttributes,
				encryptedAttributeInputs: encryptionData.encryptedAttributeInputs
			});
			setSuccess('On-chain registration successful');

		} catch (err) {
			console.error('On-chain registration failed:', err);
			setError(`On-chain registration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	};

	const resetAll = () => {
		setSelectedFile(null);
		setPreviewUrl('');
		setUploadedCid('');
		setUploadedGatewayUrl('');
		setRequiredFields({
			name: '',
			description: '',
			copyright: '',
			descriptionEncrypted: false,
			copyrightEncrypted: false
		});
		setNftAttributes([]);
		setEncryptionSummary(null);
		setEncryptionData(null);
		setCurrentStep(1);
		setUploadProgress(0);
		setEncryptProgress(0);
		setIsUploadedToIpfs(false);
		setError('');
		setSuccess('');
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	return (
		<div style={{ minHeight: '100vh', background: 'rgb(110, 140, 201)' }}>
			<main style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
				{(initState.fhe as string) === 'error' && (
					<div style={{ marginBottom: 16, padding: 16, background: '#fee2e2', border: '2px solid #fecaca', borderRadius: 12, color: '#b91c1c', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
						<div style={{ fontWeight: 600, marginBottom: 8 }}>Application Unavailable</div>
						<div style={{ fontSize: 14, marginBottom: 8 }}>FHE service initialization failed, all functions disabled.</div>
						<div style={{ fontSize: 12, color: '#dc2626' }}>Error details: {initState.errors.fhe || 'Unknown error'}</div>
					</div>
				)}

				{typeof window !== 'undefined' && !isCorrectNetwork && (
					<div style={{ marginBottom: 16, padding: 12, background: '#fff7ed', border: '2px solid #ffedd5', borderRadius: 12, color: '#9a3412', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
						Please switch to the correct network (Chain ID: {AppConfig.chainId})
						</div>
					)}

				{error && (
					<div style={{ marginBottom: 16, padding: 12, background: '#fee2e2', border: '2px solid #fecaca', borderRadius: 12, color: '#b91c1c', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
						{error}
				</div>
			)}

				{success && (
					<div style={{ marginBottom: 16, padding: 12, background: '#d1fae5', border: '2px solid #a7f3d0', borderRadius: 12, color: '#065f46', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
						{success}
					</div>
				)}

				{(initState.fhe as string) === 'error' ? (
					<div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
						<div style={{ fontSize: 16, marginBottom: 8 }}>Application Temporarily Unavailable</div>
						<div style={{ fontSize: 14 }}>Please refresh the page and retry or contact administrator</div>
					</div>
				) : (
					<>
						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20 }}>
					<div style={{ background: '#ffffff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 20, boxShadow: '0 8px 16px rgba(0,0,0,0.1)', transition: 'box-shadow 0.2s ease' }}>
						<h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>Image Upload</h2>

						{!selectedFile ? (
							<div style={{ border: '2px dashed #d1d5db', borderRadius: 12, padding: 32, textAlign: 'center', background: '#f9fafb', transition: 'border-color 0.2s ease' }}>
								<div style={{ color: '#6b7280', fontSize: 14 }}>Click to upload image</div>
								<div style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>Supports JPG, PNG, GIF (Max 10MB)</div>
					<button 
									onClick={() => fileInputRef.current?.click()}
									disabled={(initState.fhe as string) === 'error'}
									style={{ marginTop: 12, padding: '10px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: (initState.fhe as string) === 'error' ? 'not-allowed' : 'pointer', opacity: (initState.fhe as string) === 'error' ? 0.6 : 1, fontWeight: 500, transition: 'background-color 0.2s ease' }}
								>
									Select File
					</button>
							</div>
						) : (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
								<div style={{ position: 'relative', height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', overflow: 'hidden', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={previewUrl}
										alt="Preview"
										style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', borderRadius: 12 }}
									/>
					<button 
										onClick={() => {
											setSelectedFile(null);
											setPreviewUrl('');
											setCurrentStep(1);
											if (fileInputRef.current) {
												fileInputRef.current.value = '';
											}
										}}
										style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'background-color 0.2s ease' }}
									>
										×
					</button>
				</div>

								{uploadProgress > 0 && uploadProgress < 100 && (
									<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
											<span>Uploading...</span>
											<span>{uploadProgress}%</span>
										</div>
										<div style={{ width: '100%', background: '#e5e7eb', height: 8, borderRadius: 999 }}>
											<div style={{ width: `${uploadProgress}%`, background: '#6366f1', height: 8, borderRadius: 999 }} />
										</div>
									</div>
								)}

							</div>
						)}
						
						<div style={{ marginTop: 16 }}>
							<label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Encryption Result</label>
							<div style={{ position: 'relative', height: 256, border: '2px solid #e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', overflow: 'hidden', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
								<textarea
									readOnly
									spellCheck={false}
									value={encryptionSummary ? JSON.stringify(encryptionSummary, null, 2) : (uploadedCid ? JSON.stringify({ ipfsCid: uploadedCid, ipfsGatewayUrl: uploadedGatewayUrl }, null, 2) : 'Encryption result not generated yet. Will be displayed after completing "Encryption".')}
									style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 12, border: 'none', outline: 'none', fontSize: 12, fontFamily: 'monospace', backgroundColor: 'transparent', resize: 'none', boxSizing: 'border-box' }}
								/>
							</div>
						</div>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={handleFileSelect}
							style={{ display: 'none' }}
						/>
			</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
						<div style={{ background: '#ffffff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 20, boxShadow: '0 8px 16px rgba(0,0,0,0.1)', transition: 'box-shadow 0.2s ease' }}>
							<h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>Basic Information</h2>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
					<div>
									<label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 8 }}>
							Name <span style={{ color: '#ef4444' }}>*</span>
						</label>
						<input
							type="text"
							placeholder="Enter NFT name"
							value={requiredFields.name}
							onChange={(e) => updateRequiredField('name', e.target.value)}
							style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '2px solid #d1d5db', borderRadius: 8, fontSize: 14, transition: 'border-color 0.2s ease' }}
						/>
					</div>

					<div>
									<label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 8 }}>Description</label>
									<div style={{ display: 'flex', gap: 12 }}>
							<textarea
								placeholder="Enter NFT description"
								value={requiredFields.description}
								onChange={(e) => updateRequiredField('description', e.target.value)}
								rows={3}
											style={{ flex: 1, padding: '12px 14px', border: '2px solid #d1d5db', borderRadius: 8, resize: 'vertical', fontSize: 14, transition: 'border-color 0.2s ease' }}
							/>
							<button
								type="button"
								onClick={() => updateRequiredField('descriptionEncrypted', !requiredFields.descriptionEncrypted)}
																				style={{ padding: '12px 16px', borderRadius: 8, fontSize: 14, background: requiredFields.descriptionEncrypted ? '#16a34a' : '#f3f4f6', color: requiredFields.descriptionEncrypted ? '#fff' : '#374151', border: '2px solid #e5e7eb', fontWeight: 500, transition: 'all 0.2s ease' }}
							>
									Encrypt
							</button>
						</div>
					</div>

					<div>
									<label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 8 }}>Copyright Information</label>
									<div style={{ display: 'flex', gap: 12 }}>
							<input
								type="text"
											placeholder="Enter copyright information (optional)"
								value={requiredFields.copyright}
								onChange={(e) => updateRequiredField('copyright', e.target.value)}
											style={{ flex: 1, padding: '12px 14px', border: '2px solid #d1d5db', borderRadius: 8, fontSize: 14, transition: 'border-color 0.2s ease' }}
							/>
							<button
								type="button"
								onClick={() => updateRequiredField('copyrightEncrypted', !requiredFields.copyrightEncrypted)}
																				style={{ padding: '12px 16px', borderRadius: 8, fontSize: 14, background: requiredFields.copyrightEncrypted ? '#16a34a' : '#f3f4f6', color: requiredFields.copyrightEncrypted ? '#fff' : '#374151', border: '2px solid #e5e7eb', fontWeight: 500, transition: 'all 0.2s ease' }}
							>
									Encrypt
							</button>
						</div>
					</div>
				</div>
			</div>

						<div style={{ background: '#ffffff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 20, boxShadow: '0 8px 16px rgba(0,0,0,0.1)', transition: 'box-shadow 0.2s ease' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
								<h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937' }}>Attribute Settings</h2>
					<button 
						onClick={addAttribute}
									style={{ padding: '10px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'background-color 0.2s ease' }}
								>
									Add Attribute
					</button>
				</div>
				
				{nftAttributes.length === 0 ? (
								<div style={{ textAlign: 'center', color: '#6b7280', padding: 32, border: '2px dashed #d1d5db', borderRadius: 12, fontSize: 14, background: '#f9fafb' }}>
									No attributes yet, click &quot;Add Attribute&quot; to start setting
					</div>
				) : (
								<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
						{nftAttributes.map((attr) => (
										<div key={attr.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '2px solid #e5e7eb', borderRadius: 12, background: '#f9fafb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
											<div style={{ width: 180, flexShrink: 0 }}>
									<TraitTypeInput
										value={attr.trait_type}
										onChange={(value) => updateAttribute(attr.id, 'trait_type', value)}
										placeholder="Select or enter attribute name"
									/>
								</div>
								<input
									type="text"
												placeholder="Attribute value"
									value={attr.value}
									onChange={(e) => updateAttribute(attr.id, 'value', e.target.value)}
												style={{ flex: 1, padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: 8, fontSize: 14, transition: 'border-color 0.2s ease' }}
								/>
								<button
									type="button"
									onClick={() => updateAttribute(attr.id, 'isEncrypted', !attr.isEncrypted)}
																						style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, background: attr.isEncrypted ? '#16a34a' : '#f3f4f6', color: attr.isEncrypted ? '#fff' : '#374151', border: '2px solid #e5e7eb', fontWeight: 500, transition: 'all 0.2s ease' }}
								>
										Encrypt
								</button>
								<button
									onClick={() => removeAttribute(attr.id)}
																						style={{ padding: 10, color: '#dc2626', background: 'transparent', border: '2px solid #fecaca', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease' }}
								>
										Delete
								</button>
							</div>
						))}
					</div>
				)}
			</div>

						<div style={{ background: '#ffffff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 20, boxShadow: '0 8px 16px rgba(0,0,0,0.1)', transition: 'box-shadow 0.2s ease' }}>
							<div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
								<button
									onClick={uploadToIpfs}
									disabled={!selectedFile || isUploadedToIpfs || (initState.fhe as string) === 'error'}
									style={{ flex: 1, padding: '12px 16px', background: isUploadedToIpfs ? '#16a34a' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: (!selectedFile || isUploadedToIpfs || (initState.fhe as string) === 'error') ? 'not-allowed' : 'pointer', opacity: (!selectedFile || isUploadedToIpfs || (initState.fhe as string) === 'error') ? 0.6 : 1, fontWeight: 500, transition: 'background-color 0.2s ease' }}
								>
									{isUploadedToIpfs ? 'Upload Successful' : 'Upload to IPFS'}
								</button>

								<button
									onClick={encryptOnly}
									disabled={isEncrypting || !userAddress || typeof window === 'undefined' || !uploadedCid || !requiredFields.name || (initState.fhe as string) === 'error'}
									style={{ flex: 1, padding: '12px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: (isEncrypting || !userAddress || typeof window === 'undefined' || !uploadedCid || !requiredFields.name || (initState.fhe as string) === 'error') ? 'not-allowed' : 'pointer', opacity: (isEncrypting || !userAddress || typeof window === 'undefined' || !uploadedCid || !requiredFields.name || (initState.fhe as string) === 'error') ? 0.6 : 1, fontWeight: 500, transition: 'background-color 0.2s ease' }}
								>
									{isEncrypting ? 'Encrypting...' : 'Encrypt'}
								</button>
							</div>

							<div style={{ display: 'flex', gap: 12 }}>
								<button
									onClick={registerOnly}
									disabled={!encryptionData || !isCorrectNetwork || (initState.fhe as string) === 'error'}
									style={{ flex: 2, padding: '12px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, cursor: (!encryptionData || !isCorrectNetwork || (initState.fhe as string) === 'error') ? 'not-allowed' : 'pointer', opacity: (!encryptionData || !isCorrectNetwork || (initState.fhe as string) === 'error') ? 0.6 : 1, fontWeight: 500, transition: 'background-color 0.2s ease' }}
								>
									On-chain Registration
								</button>

								<button
									onClick={resetAll}
									disabled={(initState.fhe as string) === 'error'}
									style={{ flex: 1, padding: '12px 16px', background: 'transparent', color: '#374151', border: '2px solid #d1d5db', borderRadius: 8, cursor: (initState.fhe as string) === 'error' ? 'not-allowed' : 'pointer', opacity: (initState.fhe as string) === 'error' ? 0.6 : 1, fontWeight: 500, transition: 'all 0.2s ease' }}
								>
									Reset
								</button>
							</div>

							{isEncrypting && (
								<div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
									<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6b7280' }}>
										<span>Encryption Progress</span>
										<span>{encryptProgress}%</span>
									</div>
									<div style={{ width: '100%', background: '#e5e7eb', height: 10, borderRadius: 999 }}>
										<div style={{ width: `${encryptProgress}%`, background: '#10b981', height: 10, borderRadius: 999 }} />
									</div>
								</div>
							)}
						</div>
			</div>
		</div>

					<div style={{ marginTop: 32, border: '2px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
						<div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb' }}>
							<button
								onClick={() => setSelectedNftTab('owned')}
								style={{
									flex: 1,
									padding: '16px 20px',
									background: selectedNftTab === 'owned' ? '#f3f4f6' : 'white',
									border: 'none',
									fontWeight: selectedNftTab === 'owned' ? 600 : 400,
									color: selectedNftTab === 'owned' ? '#1f2937' : '#6b7280',
									cursor: 'pointer',
									borderRight: '2px solid #e5e7eb',
									transition: 'all 0.2s ease'
								}}
							>
								My NFTs
							</button>
							<button
								onClick={() => setSelectedNftTab('mint')}
								style={{
									flex: 1,
									padding: '16px 20px',
									background: selectedNftTab === 'mint' ? '#f3f4f6' : 'white',
									border: 'none',
									fontWeight: selectedNftTab === 'mint' ? 600 : 400,
									color: selectedNftTab === 'mint' ? '#1f2937' : '#6b7280',
									cursor: 'pointer',
									transition: 'all 0.2s ease'
								}}
							>
								Mint NFT
							</button>
						</div>

						<div style={{ padding: 20, minHeight: 200 }}>
							{selectedNftTab === 'owned' ? (
								<div>
									<MyNFTs userAddress={userAddress || ''} refresh={nftRefresh} />
								</div>
							) : (
								<div>
									<MintNFT
										onMintSuccess={() => {
											setNftRefresh(prev => prev + 1);
										}}
									/>
								</div>
							)}
						</div>


					</div>
				</>
				)}
			</main>



		{isEncrypting && (
				<div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
					<div style={{ textAlign: 'center', background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '2px solid #e5e7eb' }}>
						<div style={{ width: 48, height: 48, borderBottom: '3px solid #4f46e5', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
														<p style={{ color: '#374151', fontWeight: 500, fontSize: 16 }}>Encrypting, please wait...</p>
					</div>
			</div>
		)}
		</div>
	);
}


