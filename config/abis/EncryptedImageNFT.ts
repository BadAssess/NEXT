// Minimal ABI for EncryptedImageNFT used by the frontend
// Keep only app-used functions/events to reduce bundle size

export const EncryptedImageNFT_ABI = [
	// Events
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "sender",
			"type": "address"
		  },
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "address",
			"name": "owner",
			"type": "address"
		  }
		],
		"name": "ERC721IncorrectOwner",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "operator",
			"type": "address"
		  },
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "ERC721InsufficientApproval",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "approver",
			"type": "address"
		  }
		],
		"name": "ERC721InvalidApprover",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "operator",
			"type": "address"
		  }
		],
		"name": "ERC721InvalidOperator",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "owner",
			"type": "address"
		  }
		],
		"name": "ERC721InvalidOwner",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "receiver",
			"type": "address"
		  }
		],
		"name": "ERC721InvalidReceiver",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "sender",
			"type": "address"
		  }
		],
		"name": "ERC721InvalidSender",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "ERC721NonexistentToken",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "owner",
			"type": "address"
		  }
		],
		"name": "OwnableInvalidOwner",
		"type": "error"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "account",
			"type": "address"
		  }
		],
		"name": "OwnableUnauthorizedAccount",
		"type": "error"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "address",
			"name": "owner",
			"type": "address"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "approved",
			"type": "address"
		  },
		  {
			"indexed": true,
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "Approval",
		"type": "event"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "address",
			"name": "owner",
			"type": "address"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "operator",
			"type": "address"
		  },
		  {
			"indexed": false,
			"internalType": "bool",
			"name": "approved",
			"type": "bool"
		  }
		],
		"name": "ApprovalForAll",
		"type": "event"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "viewer",
			"type": "address"
		  },
		  {
			"indexed": false,
			"internalType": "uint256",
			"name": "count",
			"type": "uint256"
		  }
		],
		"name": "BatchPermissionGranted",
		"type": "event"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "to",
			"type": "address"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "minter",
			"type": "address"
		  }
		],
		"name": "DirectMinted",
		"type": "event"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "uint256",
			"name": "imageId",
			"type": "uint256"
		  },
		  {
			"indexed": false,
			"internalType": "string",
			"name": "ipfsCid",
			"type": "string"
		  },
		  {
			"indexed": false,
			"internalType": "bytes32",
			"name": "ciphertextRoot",
			"type": "bytes32"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "creator",
			"type": "address"
		  }
		],
		"name": "ImageRegistered",
		"type": "event"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"indexed": true,
			"internalType": "uint256",
			"name": "imageId",
			"type": "uint256"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "to",
			"type": "address"
		  },
		  {
			"indexed": false,
			"internalType": "address",
			"name": "minter",
			"type": "address"
		  }
		],
		"name": "NFTMinted",
		"type": "event"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "address",
			"name": "previousOwner",
			"type": "address"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "newOwner",
			"type": "address"
		  }
		],
		"name": "OwnershipTransferred",
		"type": "event"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "viewer",
			"type": "address"
		  }
		],
		"name": "PermissionGranted",
		"type": "event"
	  },
	  {
		"anonymous": false,
		"inputs": [
		  {
			"indexed": true,
			"internalType": "address",
			"name": "from",
			"type": "address"
		  },
		  {
			"indexed": true,
			"internalType": "address",
			"name": "to",
			"type": "address"
		  },
		  {
			"indexed": true,
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "Transfer",
		"type": "event"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "to",
			"type": "address"
		  },
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "approve",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "owner",
			"type": "address"
		  }
		],
		"name": "balanceOf",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "address[]",
			"name": "viewers",
			"type": "address[]"
		  }
		],
		"name": "batchGrantViewPermission",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address[]",
			"name": "recipients",
			"type": "address[]"
		  }
		],
		"name": "batchMint",
		"outputs": [
		  {
			"internalType": "uint256[]",
			"name": "tokenIds",
			"type": "uint256[]"
		  }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "calculateImageRarity",
		"outputs": [
		  {
			"internalType": "euint32",
			"name": "",
			"type": "bytes32"
		  }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId1",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "tokenId2",
			"type": "uint256"
		  }
		],
		"name": "checkImageSimilarity",
		"outputs": [
		  {
			"internalType": "ebool",
			"name": "",
			"type": "bytes32"
		  }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  },
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  }
		],
		"name": "extraViewers",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "startIndex",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "count",
			"type": "uint256"
		  }
		],
		"name": "getAllMintedNFTs",
		"outputs": [
		  {
			"internalType": "uint256[]",
			"name": "tokenIds",
			"type": "uint256[]"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "startIndex",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "count",
			"type": "uint256"
		  }
		],
		"name": "getAllNFTOwners",
		"outputs": [
		  {
			"internalType": "address[]",
			"name": "owners",
			"type": "address[]"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "getApproved",
		"outputs": [
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "index",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "chunkIndex",
			"type": "uint256"
		  }
		],
		"name": "getEncryptedAttributeChunk",
		"outputs": [
		  {
			"internalType": "euint32",
			"name": "",
			"type": "bytes32"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "index",
			"type": "uint256"
		  }
		],
		"name": "getEncryptedAttributeChunkCount",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "index",
			"type": "uint256"
		  }
		],
		"name": "getEncryptedAttributeMeta",
		"outputs": [
		  {
			"internalType": "uint32",
			"name": "totalBytes",
			"type": "uint32"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "index",
			"type": "uint256"
		  }
		],
		"name": "getEncryptedAttributeType",
		"outputs": [
		  {
			"internalType": "string",
			"name": "",
			"type": "string"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "index",
			"type": "uint256"
		  }
		],
		"name": "getEncryptedAttributeValue",
		"outputs": [
		  {
			"internalType": "euint32",
			"name": "",
			"type": "bytes32"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "getEncryptedAttributesCount",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "imageId",
			"type": "uint256"
		  }
		],
		"name": "getImageMeta",
		"outputs": [
		  {
			"components": [
			  {
				"internalType": "string",
				"name": "ipfsCid",
				"type": "string"
			  },
			  {
				"internalType": "uint32",
				"name": "width",
				"type": "uint32"
			  },
			  {
				"internalType": "uint32",
				"name": "height",
				"type": "uint32"
			  },
			  {
				"internalType": "bytes32",
				"name": "ciphertextRoot",
				"type": "bytes32"
			  },
			  {
				"internalType": "uint64",
				"name": "createdAt",
				"type": "uint64"
			  }
			],
			"internalType": "struct EncryptedImageNFT.ImageMeta",
			"name": "",
			"type": "tuple"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "getNFTInfo",
		"outputs": [
		  {
			"internalType": "address",
			"name": "owner",
			"type": "address"
		  },
		  {
			"internalType": "address",
			"name": "creator",
			"type": "address"
		  },
		  {
			"internalType": "bool",
			"name": "hasEncrypted",
			"type": "bool"
		  },
		  {
			"internalType": "bool",
			"name": "isDirectMintValue",
			"type": "bool"
		  },
		  {
			"components": [
			  {
				"internalType": "string",
				"name": "ipfsCid",
				"type": "string"
			  },
			  {
				"internalType": "uint32",
				"name": "width",
				"type": "uint32"
			  },
			  {
				"internalType": "uint32",
				"name": "height",
				"type": "uint32"
			  },
			  {
				"internalType": "bytes32",
				"name": "ciphertextRoot",
				"type": "bytes32"
			  },
			  {
				"internalType": "uint64",
				"name": "createdAt",
				"type": "uint64"
			  }
			],
			"internalType": "struct EncryptedImageNFT.ImageMeta",
			"name": "metadata",
			"type": "tuple"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "index",
			"type": "uint256"
		  }
		],
		"name": "getPlaintextAttribute",
		"outputs": [
		  {
			"components": [
			  {
				"internalType": "string",
				"name": "trait_type",
				"type": "string"
			  },
			  {
				"internalType": "string",
				"name": "value",
				"type": "string"
			  }
			],
			"internalType": "struct EncryptedImageNFT.PlaintextAttribute",
			"name": "",
			"type": "tuple"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "getPlaintextAttributesCount",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "imageId",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "index",
			"type": "uint256"
		  }
		],
		"name": "getRegisteredPlaintextAttribute",
		"outputs": [
		  {
			"components": [
			  {
				"internalType": "string",
				"name": "trait_type",
				"type": "string"
			  },
			  {
				"internalType": "string",
				"name": "value",
				"type": "string"
			  }
			],
			"internalType": "struct EncryptedImageNFT.PlaintextAttribute",
			"name": "",
			"type": "tuple"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "imageId",
			"type": "uint256"
		  }
		],
		"name": "getRegisteredPlaintextAttributesCount",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "address",
			"name": "viewer",
			"type": "address"
		  }
		],
		"name": "grantViewPermission",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "hasEncryptedData",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "address",
			"name": "user",
			"type": "address"
		  }
		],
		"name": "hasViewPermission",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"name": "images",
		"outputs": [
		  {
			"internalType": "string",
			"name": "ipfsCid",
			"type": "string"
		  },
		  {
			"internalType": "uint32",
			"name": "width",
			"type": "uint32"
		  },
		  {
			"internalType": "uint32",
			"name": "height",
			"type": "uint32"
		  },
		  {
			"internalType": "bytes32",
			"name": "ciphertextRoot",
			"type": "bytes32"
		  },
		  {
			"internalType": "uint64",
			"name": "createdAt",
			"type": "uint64"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "owner",
			"type": "address"
		  },
		  {
			"internalType": "address",
			"name": "operator",
			"type": "address"
		  }
		],
		"name": "isApprovedForAll",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"name": "isDirectMint",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"name": "isImageRegistered",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "imageId",
			"type": "uint256"
		  }
		],
		"name": "isImageRegisteredById",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "to",
			"type": "address"
		  }
		],
		"name": "mint",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "imageId",
			"type": "uint256"
		  },
		  {
			"internalType": "address",
			"name": "to",
			"type": "address"
		  }
		],
		"name": "mintFromRegisteredImage",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [],
		"name": "name",
		"outputs": [
		  {
			"internalType": "string",
			"name": "",
			"type": "string"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"name": "originalCreator",
		"outputs": [
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [],
		"name": "owner",
		"outputs": [
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "ownerOf",
		"outputs": [
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [],
		"name": "pHashSimilarityThreshold",
		"outputs": [
		  {
			"internalType": "uint32",
			"name": "",
			"type": "uint32"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"name": "plaintextAttributes",
		"outputs": [
		  {
			"internalType": "string",
			"name": "trait_type",
			"type": "string"
		  },
		  {
			"internalType": "string",
			"name": "value",
			"type": "string"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "bytes32",
			"name": "ciphertextRoot",
			"type": "bytes32"
		  },
		  {
			"internalType": "bytes32",
			"name": "inputTag",
			"type": "bytes32"
		  },
		  {
			"internalType": "string",
			"name": "ipfsCid",
			"type": "string"
		  },
		  {
			"internalType": "uint32",
			"name": "width",
			"type": "uint32"
		  },
		  {
			"internalType": "uint32",
			"name": "height",
			"type": "uint32"
		  },
		  {
			"internalType": "bytes32[]",
			"name": "encryptedFeatures",
			"type": "bytes32[]"
		  },
		  {
			"internalType": "bytes",
			"name": "inputProof",
			"type": "bytes"
		  },
		  {
			"components": [
			  {
				"internalType": "string",
				"name": "trait_type",
				"type": "string"
			  },
			  {
				"internalType": "string",
				"name": "value",
				"type": "string"
			  }
			],
			"internalType": "struct EncryptedImageNFT.PlaintextAttribute[]",
			"name": "plainAttributes",
			"type": "tuple[]"
		  },
		  {
			"components": [
			  {
				"internalType": "string",
				"name": "trait_type",
				"type": "string"
			  },
			  {
				"internalType": "bytes32[]",
				"name": "encryptedData",
				"type": "bytes32[]"
			  },
			  {
				"internalType": "bytes",
				"name": "inputProof",
				"type": "bytes"
			  },
			  {
				"internalType": "uint32",
				"name": "totalBytes",
				"type": "uint32"
			  }
			],
			"internalType": "struct EncryptedImageNFT.EncryptedAttributeInput[]",
			"name": "encryptedAttributeInputs",
			"type": "tuple[]"
		  }
		],
		"name": "registerEncryptedImage",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "imageId",
			"type": "uint256"
		  }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"name": "registeredImages",
		"outputs": [
		  {
			"internalType": "string",
			"name": "ipfsCid",
			"type": "string"
		  },
		  {
			"internalType": "uint32",
			"name": "width",
			"type": "uint32"
		  },
		  {
			"internalType": "uint32",
			"name": "height",
			"type": "uint32"
		  },
		  {
			"internalType": "bytes32",
			"name": "ciphertextRoot",
			"type": "bytes32"
		  },
		  {
			"internalType": "uint64",
			"name": "createdAt",
			"type": "uint64"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  },
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"name": "registeredPlaintextAttributes",
		"outputs": [
		  {
			"internalType": "string",
			"name": "trait_type",
			"type": "string"
		  },
		  {
			"internalType": "string",
			"name": "value",
			"type": "string"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "from",
			"type": "address"
		  },
		  {
			"internalType": "address",
			"name": "to",
			"type": "address"
		  },
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "from",
			"type": "address"
		  },
		  {
			"internalType": "address",
			"name": "to",
			"type": "address"
		  },
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "bytes",
			"name": "data",
			"type": "bytes"
		  }
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "operator",
			"type": "address"
		  },
		  {
			"internalType": "bool",
			"name": "approved",
			"type": "bool"
		  }
		],
		"name": "setApprovalForAll",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint32",
			"name": "newThreshold",
			"type": "uint32"
		  }
		],
		"name": "setPHashSimilarityThreshold",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "bytes4",
			"name": "interfaceId",
			"type": "bytes4"
		  }
		],
		"name": "supportsInterface",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [],
		"name": "symbol",
		"outputs": [
		  {
			"internalType": "string",
			"name": "",
			"type": "string"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "tokenURI",
		"outputs": [
		  {
			"internalType": "string",
			"name": "",
			"type": "string"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [],
		"name": "totalRegisteredImages",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [],
		"name": "totalSupply",
		"outputs": [
		  {
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "from",
			"type": "address"
		  },
		  {
			"internalType": "address",
			"name": "to",
			"type": "address"
		  },
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  }
		],
		"name": "transferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "newOwner",
			"type": "address"
		  }
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "bytes32",
			"name": "",
			"type": "bytes32"
		  }
		],
		"name": "usedInputTag",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "uint256",
			"name": "tokenId",
			"type": "uint256"
		  },
		  {
			"internalType": "bytes32",
			"name": "submittedHashHigh",
			"type": "bytes32"
		  },
		  {
			"internalType": "bytes32",
			"name": "submittedHashLow",
			"type": "bytes32"
		  },
		  {
			"internalType": "bytes",
			"name": "inputProof",
			"type": "bytes"
		  }
		],
		"name": "verifyImageOwnership",
		"outputs": [
		  {
			"internalType": "ebool",
			"name": "",
			"type": "bytes32"
		  }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	  }
] as const;


