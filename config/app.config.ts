export const AppConfig = {
	appName: "Zama FHE Image",
	chainId: 11155111,
	rpcUrl: "Enter your Sepolia RPC URL (private RPC recommended)",
	walletConnectProjectId: "",
	zamaGatewayUrl: "",
	zama: {
		usePreset: "sepolia",
		chainId: 11155111,
		gatewayChainId: 55815,
		network: "",
		relayerUrl: "/api/relayer",
		targetContractAddress: "0x8DF9F23e4f558932528D48985dd1A0290C807b3b",
		aclContractAddress: "",
		kmsContractAddress: "",
		inputVerifierContractAddress: "",
		verifyingContractAddressDecryption: "",
		verifyingContractAddressInputVerification: ""
	},
	encryption: {
		attributeConcurrency: 4
	},
	decryption: {
		batchSize: 64,
		concurrency: 2,
		requestTimeoutMs: 25000,
		cacheTtlMs: 5 * 60 * 1000
	},
	ipfs: {
		provider: "pinata",
		apiBase: "https://api.pinata.cloud",
		gatewayBase: "Enter your IPFS gateway base URL",
		jwt: "Enter your Pinata JWT",
		endpoint: "",
		projectId: "",
		projectSecret: ""
	},
	nftAttributes: {
		commonTraitTypes: [
			"Art Style",
			"Background",
			"Color Scheme", 
			"Category",
			"Rarity",
			"Artist",
			"Series",
			"Edition",
			"Size",
			"Material",
			"Theme",
			"Collection",
			"Mood",
			"Texture",
			"Pattern",
			"Level",
			"Power",
			"Defense",
			"Speed",
			"Intelligence",
			"Health",
			"Mana",
			"Strength",
			"Type",
			"Element",
			"Class",
			"Origin",
			"Quality",
			"Age",
			"Gender"
		]
	}
};


