## FHE-based NFT Fingerprints/Features/Attributes (End-to-End Privacy)

An integrated solution based on Zama Fully Homomorphic Encryption (FHE): client-side encryption, on-chain registration, ACL authorization, private decryption via Zama Relayer, and fingerprint similarity comparison — with no plaintext leakage.

### Core Capabilities
- Encryption & On-Chain Registration (no minting):
  - Extract and encrypt 9 fingerprint features: pHash high/low bits, dominant RGB, brightness, contrast, timestamp, aspect ratio.
  - Encrypt any custom attributes into sharded ciphertext handles; on-chain stores only handles and root integrity info.
- Optional Minting:
  - One-click minting from a registered image; copy all encrypted data and automatically grant view permission to the minter and the recipient.
- Authorization & Decryption:
  - Original creator/holder can grant view permission to any address (single or batch). Zama Relayer validates and returns decrypted plaintext for authorized users.
- Fingerprint Matching & Authenticity:
  - Compare two NFTs’ pHash under FHE against a threshold to get an encrypted boolean; or verify “submitted image vs NFT” fingerprint consistency.
- Plain Attributes & Metadata:
  - Supports plaintext attributes on-chain; `tokenURI` marks encrypted placeholders without leaking content.
- Operations & Security:
  - Replay protection (`inputTag`), integrity binding (`ciphertextRoot`), contract-origin checks + ACL on the decryption path.

### Use Cases
- Artwork registration and anti-piracy: bind encrypted fingerprints and encrypted watermark (copyright) for forensics.
- Pre-auction/trade authenticity: threshold-based similarity; extendable to rarity scoring.
- Mystery boxes/hidden traits: encrypt attributes on-chain first; holders or authorized viewers decrypt after sale.
- Licensed distribution and paid decryption: creators batch-authorize collectors for specific encrypted attributes.
- Copyright licensing and tracking: bind encrypted licensing parameters to the NFT and verify on demand.

### Not Yet Implemented / Upcoming
- Attribute-to-attribute comparisons.

## Tutorials

### Install Dependencies
```bash
npm install
```

### Apply for a Pinata JWT
1. Create a Pinata account and sign in.
2. Create an API Key and generate a JWT. See Pinata docs: [Pinata API Docs](https://docs.pinata.cloud/)
3. Copy the JWT for later use in `config/app.config.ts`.
4. Prepare an IPFS gateway base (e.g., `https://gateway.pinata.cloud` or your own gateway).

### Get a Private Sepolia RPC
- Providers: Infura, Alchemy, Ankr (or others)
1. Create a project on your provider.
2. Select the Sepolia network.
3. Copy the HTTPS endpoint URL for use in `config/app.config.ts`.

### Fill `config/app.config.ts`
Update the following fields with your values:

```ts
export const AppConfig = {
	appName: "Zama FHE Image",
	chainId: 11155111,
	rpcUrl: "<YOUR_SEPOLIA_RPC_URL>",
	walletConnectProjectId: "",
	zamaGatewayUrl: "",
	zama: {
		usePreset: "sepolia",
		chainId: 11155111,
		gatewayChainId: 55815,
		network: "",
		relayerUrl: "/api/relayer",
		targetContractAddress: "<YOUR_DEPLOYED_ENCRYPTED_IMAGE_NFT_ADDRESS>",
		aclContractAddress: "",
		kmsContractAddress: "",
		inputVerifierContractAddress: "",
		verifyingContractAddressDecryption: "",
		verifyingContractAddressInputVerification: ""
	},
	ipfs: {
		provider: "pinata",
		apiBase: "https://api.pinata.cloud",
		gatewayBase: "<YOUR_IPFS_GATEWAY_BASE>",
		jwt: "<YOUR_PINATA_JWT>",
		endpoint: "",
		projectId: "",
		projectSecret: ""
	}
};
```


