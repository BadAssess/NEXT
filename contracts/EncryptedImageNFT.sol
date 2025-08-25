// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedImageNFT is SepoliaConfig, ERC721, Ownable {
	using Strings for uint256;

	struct ImageMeta {
		string ipfsCid;
		uint32 width;
		uint32 height;
		bytes32 ciphertextRoot;
		uint64 createdAt;
	}

	struct PlaintextAttribute {
		string trait_type;
		string value;
	}

	struct EncryptedAttribute {
		string trait_type;
		euint32[] chunks;
		uint32 totalBytes;
	}

	struct EncryptedAttributeInput {
		string trait_type;
		bytes32[] encryptedData;
		bytes inputProof;
		uint32 totalBytes;
	}

	struct EncryptedFeatures {
		euint32 perceptualHashHigh;
		euint32 perceptualHashLow;
		euint8 dominantRed;
		euint8 dominantGreen;
		euint8 dominantBlue;
		euint8 brightness;
		euint8 contrast;
		euint32 timestamp;
		euint32 aspectRatio;
	}

	mapping(uint256 => ImageMeta) public images;
	mapping(uint256 => ImageMeta) public registeredImages;
	mapping(uint256 => EncryptedFeatures) private _imageFeatures;
	mapping(uint256 => EncryptedFeatures) private _registeredImageFeatures;
	mapping(uint256 => PlaintextAttribute[]) public plaintextAttributes;
	mapping(uint256 => PlaintextAttribute[]) public registeredPlaintextAttributes;
	mapping(uint256 => EncryptedAttribute[]) private _encryptedAttributes;
	mapping(uint256 => EncryptedAttribute[]) private _registeredEncryptedAttributes;
	mapping(uint256 => mapping(address => bool)) public extraViewers;
	mapping(uint256 => address) public originalCreator;
	mapping(uint256 => bool) public isDirectMint;
	mapping(uint256 => bool) public isImageRegistered;
	mapping(bytes32 => bool) public usedInputTag;

	uint256 private _tokenIdCounter;
	uint256 private _imageIdCounter;
	uint32 public pHashSimilarityThreshold = 1000;

	event ImageRegistered(uint256 indexed imageId, string ipfsCid, bytes32 ciphertextRoot, address indexed creator);
	event NFTMinted(uint256 indexed tokenId, uint256 indexed imageId, address indexed to, address minter);
	event PermissionGranted(uint256 indexed tokenId, address indexed viewer);
	event BatchPermissionGranted(uint256 indexed tokenId, address indexed viewer, uint256 count);
	event DirectMinted(uint256 indexed tokenId, address indexed to, address indexed minter);

	constructor() ERC721("EncryptedImage", "EIMG") Ownable(msg.sender) {}

	function setPHashSimilarityThreshold(uint32 newThreshold) external onlyOwner {
		pHashSimilarityThreshold = newThreshold;
	}
	function mint(address to) external onlyOwner returns (uint256 tokenId) {
		tokenId = ++_tokenIdCounter;
		
		images[tokenId] = ImageMeta({
			ipfsCid: "",
			width: 0,
			height: 0,
			ciphertextRoot: bytes32(0),
			createdAt: uint64(block.timestamp)
		});
		
		isDirectMint[tokenId] = true;
		originalCreator[tokenId] = msg.sender;
		extraViewers[tokenId][msg.sender] = true;
		
		_safeMint(to, tokenId);
		emit DirectMinted(tokenId, to, msg.sender);
	}
	function batchMint(address[] calldata recipients) external onlyOwner returns (uint256[] memory tokenIds) {
		tokenIds = new uint256[](recipients.length);
		
		for (uint256 i = 0; i < recipients.length; i++) {
			uint256 tokenId = ++_tokenIdCounter;
			
			images[tokenId] = ImageMeta({
				ipfsCid: "",
				width: 0,
				height: 0,
				ciphertextRoot: bytes32(0),
				createdAt: uint64(block.timestamp)
			});
			
			isDirectMint[tokenId] = true;
			originalCreator[tokenId] = msg.sender;
			extraViewers[tokenId][msg.sender] = true;
			
			_safeMint(recipients[i], tokenId);
			tokenIds[i] = tokenId;
			emit DirectMinted(tokenId, recipients[i], msg.sender);
		}
	}
	function registerEncryptedImage(
		bytes32 ciphertextRoot,
		bytes32 inputTag,
		string calldata ipfsCid,
		uint32 width,
		uint32 height,
		bytes32[] calldata encryptedFeatures,
		bytes calldata inputProof,
		PlaintextAttribute[] calldata plainAttributes,
		EncryptedAttributeInput[] calldata encryptedAttributeInputs
	) external returns (uint256 imageId) {
		require(!usedInputTag[inputTag], "inputTag already used");
		require(encryptedFeatures.length == 9, "Features count mismatch");
		usedInputTag[inputTag] = true;

		imageId = ++_imageIdCounter;

		_registeredImageFeatures[imageId] = EncryptedFeatures({
			perceptualHashHigh: FHE.fromExternal(externalEuint32.wrap(encryptedFeatures[0]), inputProof),
			perceptualHashLow: FHE.fromExternal(externalEuint32.wrap(encryptedFeatures[1]), inputProof),
			dominantRed: FHE.fromExternal(externalEuint8.wrap(encryptedFeatures[2]), inputProof),
			dominantGreen: FHE.fromExternal(externalEuint8.wrap(encryptedFeatures[3]), inputProof),
			dominantBlue: FHE.fromExternal(externalEuint8.wrap(encryptedFeatures[4]), inputProof),
			brightness: FHE.fromExternal(externalEuint8.wrap(encryptedFeatures[5]), inputProof),
			contrast: FHE.fromExternal(externalEuint8.wrap(encryptedFeatures[6]), inputProof),
			timestamp: FHE.fromExternal(externalEuint32.wrap(encryptedFeatures[7]), inputProof),
			aspectRatio: FHE.fromExternal(externalEuint32.wrap(encryptedFeatures[8]), inputProof)
		});

		_grantRegisteredFeatureACL(imageId, msg.sender);
		_allowThisForRegisteredFeatures(imageId);

		for (uint256 i = 0; i < plainAttributes.length; i++) {
			registeredPlaintextAttributes[imageId].push(plainAttributes[i]);
		}

		for (uint256 i = 0; i < encryptedAttributeInputs.length; i++) {
			EncryptedAttributeInput calldata ai = encryptedAttributeInputs[i];
			EncryptedAttribute storage attr = _pushEmptyRegisteredEncryptedAttribute(imageId);
			attr.trait_type = ai.trait_type;
			attr.totalBytes = ai.totalBytes;
			for (uint256 j = 0; j < ai.encryptedData.length; j++) {
				euint32 chunk = FHE.fromExternal(
					externalEuint32.wrap(ai.encryptedData[j]),
					ai.inputProof
				);
				attr.chunks.push(chunk);
				FHE.allow(chunk, msg.sender);
				FHE.allowThis(chunk);
			}
		}

		registeredImages[imageId] = ImageMeta({
			ipfsCid: ipfsCid,
			width: width,
			height: height,
			ciphertextRoot: ciphertextRoot,
			createdAt: uint64(block.timestamp)
		});

		isImageRegistered[imageId] = true;
		originalCreator[imageId] = msg.sender;

		emit ImageRegistered(imageId, ipfsCid, ciphertextRoot, msg.sender);
	}
	function mintFromRegisteredImage(uint256 imageId, address to) external returns (uint256 tokenId) {
		require(isImageRegistered[imageId], "Image not registered");
		require(to != address(0), "Cannot mint to zero address");

		tokenId = ++_tokenIdCounter;

		images[tokenId] = registeredImages[imageId];
		_imageFeatures[tokenId] = _registeredImageFeatures[imageId];
		
		PlaintextAttribute[] storage sourceAttributes = registeredPlaintextAttributes[imageId];
		for (uint256 i = 0; i < sourceAttributes.length; i++) {
			plaintextAttributes[tokenId].push(sourceAttributes[i]);
		}
		
		EncryptedAttribute[] storage sourceEncrypted = _registeredEncryptedAttributes[imageId];
		for (uint256 i = 0; i < sourceEncrypted.length; i++) {
			EncryptedAttribute storage src = sourceEncrypted[i];
			EncryptedAttribute storage dst = _pushEmptyEncryptedAttribute(tokenId);
			dst.trait_type = src.trait_type;
			dst.totalBytes = src.totalBytes;
			for (uint256 j = 0; j < src.chunks.length; j++) {
				dst.chunks.push(src.chunks[j]);
			}
		}

		isDirectMint[tokenId] = false;
		originalCreator[tokenId] = originalCreator[imageId];

		extraViewers[tokenId][to] = true;
		_grantFeatureACL(tokenId, to);
		_grantAttributeACL(tokenId, to);
		extraViewers[tokenId][msg.sender] = true;
		_grantFeatureACL(tokenId, msg.sender);
		_grantAttributeACL(tokenId, msg.sender);

		_safeMint(to, tokenId);
		emit NFTMinted(tokenId, imageId, to, msg.sender);
	}

	function grantViewPermission(uint256 tokenId, address viewer) external {
		require(
			originalCreator[tokenId] == msg.sender || ownerOf(tokenId) == msg.sender,
			"only original creator or owner can grant permission"
		);
		extraViewers[tokenId][viewer] = true;
		
		if (!isDirectMint[tokenId]) {
			_grantFeatureACL(tokenId, viewer);
			_grantAttributeACL(tokenId, viewer);
		}
		
		emit PermissionGranted(tokenId, viewer);
	}

	function hasViewPermission(uint256 tokenId, address user) public view returns (bool) {
		if (originalCreator[tokenId] == user) return true;
		
		if (!isDirectMint[tokenId]) {
			return extraViewers[tokenId][user];
		}
		
		if (ownerOf(tokenId) == user) return true;
		return extraViewers[tokenId][user];
	}
	function verifyImageOwnership(
		uint256 tokenId,
		bytes32 submittedHashHigh,
		bytes32 submittedHashLow,
		bytes calldata inputProof
	) external returns (ebool) {
		require(_exists(tokenId), "Token does not exist");
		require(hasViewPermission(tokenId, msg.sender), "No permission to verify");
		require(images[tokenId].ciphertextRoot != bytes32(0), "No encrypted data");
		
		euint32 highIn = FHE.fromExternal(externalEuint32.wrap(submittedHashHigh), inputProof);
		euint32 lowIn = FHE.fromExternal(externalEuint32.wrap(submittedHashLow), inputProof);
		
		ebool highMatch = FHE.eq(_imageFeatures[tokenId].perceptualHashHigh, highIn);
		ebool lowMatch = FHE.eq(_imageFeatures[tokenId].perceptualHashLow, lowIn);
		
		return FHE.and(highMatch, lowMatch);
	}
	function checkImageSimilarity(uint256 tokenId1, uint256 tokenId2) external returns (ebool) {
		require(_exists(tokenId1) && _exists(tokenId2), "Token does not exist");
		require(
			hasViewPermission(tokenId1, msg.sender) || hasViewPermission(tokenId2, msg.sender),
			"No permission for either token"
		);
		require(images[tokenId1].ciphertextRoot != bytes32(0) && images[tokenId2].ciphertextRoot != bytes32(0), "No encrypted data");
		
		euint32 aHigh = _imageFeatures[tokenId1].perceptualHashHigh;
		euint32 bHigh = _imageFeatures[tokenId2].perceptualHashHigh;
		euint32 aLow = _imageFeatures[tokenId1].perceptualHashLow;
		euint32 bLow = _imageFeatures[tokenId2].perceptualHashLow;
		
		euint32 diffHighAB = FHE.sub(aHigh, bHigh);
		euint32 diffHighBA = FHE.sub(bHigh, aHigh);
		ebool isHighALess = FHE.lt(aHigh, bHigh);
		euint32 highAbs = FHE.select(isHighALess, diffHighBA, diffHighAB);
		
		euint32 diffLowAB = FHE.sub(aLow, bLow);
		euint32 diffLowBA = FHE.sub(bLow, aLow);
		ebool isLowALess = FHE.lt(aLow, bLow);
		euint32 lowAbs = FHE.select(isLowALess, diffLowBA, diffLowAB);
		
		euint32 thresholdE = FHE.asEuint32(pHashSimilarityThreshold);
		ebool highSimilar = FHE.lt(highAbs, thresholdE);
		ebool lowSimilar = FHE.lt(lowAbs, thresholdE);
		
		ebool similar = FHE.and(highSimilar, lowSimilar);
		FHE.allowThis(similar);
		FHE.allow(similar, msg.sender);
		return similar;
	}
	function calculateImageRarity(uint256 tokenId) external returns (euint32) {
		require(_exists(tokenId), "Token does not exist");
		require(hasViewPermission(tokenId, msg.sender), "No permission to calculate rarity");
		require(images[tokenId].ciphertextRoot != bytes32(0), "No encrypted data");
		
		EncryptedFeatures storage features = _imageFeatures[tokenId];
		
		euint32 rarity = FHE.add(
			FHE.asEuint32(features.contrast),
			FHE.mul(FHE.asEuint32(features.dominantRed), FHE.asEuint32(3))
		);
		
		return rarity;
	}
	function _grantFeatureACL(uint256 tokenId, address viewer) internal {
		EncryptedFeatures storage features = _imageFeatures[tokenId];
		FHE.allow(features.perceptualHashHigh, viewer);
		FHE.allow(features.perceptualHashLow, viewer);
		FHE.allow(features.dominantRed, viewer);
		FHE.allow(features.dominantGreen, viewer);
		FHE.allow(features.dominantBlue, viewer);
		FHE.allow(features.brightness, viewer);
		FHE.allow(features.contrast, viewer);
		FHE.allow(features.timestamp, viewer);
		FHE.allow(features.aspectRatio, viewer);
	}

	function _allowThisForFeatures(uint256 tokenId) internal {
		EncryptedFeatures storage features = _imageFeatures[tokenId];
		FHE.allowThis(features.perceptualHashHigh);
		FHE.allowThis(features.perceptualHashLow);
		FHE.allowThis(features.dominantRed);
		FHE.allowThis(features.dominantGreen);
		FHE.allowThis(features.dominantBlue);
		FHE.allowThis(features.brightness);
		FHE.allowThis(features.contrast);
		FHE.allowThis(features.timestamp);
		FHE.allowThis(features.aspectRatio);
	}

	function _grantAttributeACL(uint256 tokenId, address viewer) internal {
		EncryptedAttribute[] storage attributes = _encryptedAttributes[tokenId];
		for (uint256 i = 0; i < attributes.length; i++) {
			for (uint256 j = 0; j < attributes[i].chunks.length; j++) {
				FHE.allow(attributes[i].chunks[j], viewer);
			}
		}
	}

	function _pushEmptyEncryptedAttribute(uint256 tokenId) internal returns (EncryptedAttribute storage attr) {
		_encryptedAttributes[tokenId].push();
		return _encryptedAttributes[tokenId][_encryptedAttributes[tokenId].length - 1];
	}

	function _pushEmptyRegisteredEncryptedAttribute(uint256 imageId) internal returns (EncryptedAttribute storage attr) {
		_registeredEncryptedAttributes[imageId].push();
		return _registeredEncryptedAttributes[imageId][_registeredEncryptedAttributes[imageId].length - 1];
	}

	function _grantRegisteredFeatureACL(uint256 imageId, address viewer) internal {
		EncryptedFeatures storage features = _registeredImageFeatures[imageId];
		FHE.allow(features.perceptualHashHigh, viewer);
		FHE.allow(features.perceptualHashLow, viewer);
		FHE.allow(features.dominantRed, viewer);
		FHE.allow(features.dominantGreen, viewer);
		FHE.allow(features.dominantBlue, viewer);
		FHE.allow(features.brightness, viewer);
		FHE.allow(features.contrast, viewer);
		FHE.allow(features.timestamp, viewer);
		FHE.allow(features.aspectRatio, viewer);
	}

	function _allowThisForRegisteredFeatures(uint256 imageId) internal {
		EncryptedFeatures storage features = _registeredImageFeatures[imageId];
		FHE.allowThis(features.perceptualHashHigh);
		FHE.allowThis(features.perceptualHashLow);
		FHE.allowThis(features.dominantRed);
		FHE.allowThis(features.dominantGreen);
		FHE.allowThis(features.dominantBlue);
		FHE.allowThis(features.brightness);
		FHE.allowThis(features.contrast);
		FHE.allowThis(features.timestamp);
		FHE.allowThis(features.aspectRatio);
	}

	function getPlaintextAttributesCount(uint256 tokenId) external view returns (uint256) {
		require(_exists(tokenId), "Token does not exist");
		return plaintextAttributes[tokenId].length;
	}

	function getRegisteredPlaintextAttributesCount(uint256 imageId) external view returns (uint256) {
		require(isImageRegistered[imageId], "Image not registered");
		return registeredPlaintextAttributes[imageId].length;
	}

	function getEncryptedAttributesCount(uint256 tokenId) external view returns (uint256) {
		require(_exists(tokenId), "Token does not exist");
		return _encryptedAttributes[tokenId].length;
	}

	function getPlaintextAttribute(uint256 tokenId, uint256 index) external view returns (PlaintextAttribute memory) {
		require(_exists(tokenId), "Token does not exist");
		require(index < plaintextAttributes[tokenId].length, "Index out of bounds");
		return plaintextAttributes[tokenId][index];
	}

	function getRegisteredPlaintextAttribute(uint256 imageId, uint256 index) external view returns (PlaintextAttribute memory) {
		require(isImageRegistered[imageId], "Image not registered");
		require(index < registeredPlaintextAttributes[imageId].length, "Index out of bounds");
		return registeredPlaintextAttributes[imageId][index];
	}

	function getEncryptedAttributeType(uint256 tokenId, uint256 index) external view returns (string memory) {
		require(_exists(tokenId), "Token does not exist");
		require(index < _encryptedAttributes[tokenId].length, "Index out of bounds");
		return _encryptedAttributes[tokenId][index].trait_type;
	}

	function getEncryptedAttributeValue(uint256 tokenId, uint256 index) external view returns (euint32) {
		require(_exists(tokenId), "Token does not exist");
		require(hasViewPermission(tokenId, msg.sender), "No permission to view encrypted attributes");
		require(index < _encryptedAttributes[tokenId].length, "Index out of bounds");
		EncryptedAttribute storage a = _encryptedAttributes[tokenId][index];
		require(a.chunks.length > 0, "Empty attribute");
		return a.chunks[0];
	}

	function getEncryptedAttributeChunkCount(uint256 tokenId, uint256 index) external view returns (uint256) {
		require(_exists(tokenId), "Token does not exist");
		require(index < _encryptedAttributes[tokenId].length, "Index out of bounds");
		return _encryptedAttributes[tokenId][index].chunks.length;
	}

	function getEncryptedAttributeChunk(uint256 tokenId, uint256 index, uint256 chunkIndex) external view returns (euint32) {
		require(_exists(tokenId), "Token does not exist");
		require(hasViewPermission(tokenId, msg.sender), "No permission to view encrypted attributes");
		require(index < _encryptedAttributes[tokenId].length, "Index out of bounds");
		require(chunkIndex < _encryptedAttributes[tokenId][index].chunks.length, "Chunk index out of bounds");
		return _encryptedAttributes[tokenId][index].chunks[chunkIndex];
	}

	function getEncryptedAttributeMeta(uint256 tokenId, uint256 index) external view returns (uint32 totalBytes) {
		require(_exists(tokenId), "Token does not exist");
		require(index < _encryptedAttributes[tokenId].length, "Index out of bounds");
		return _encryptedAttributes[tokenId][index].totalBytes;
	}
	function batchGrantViewPermission(uint256 tokenId, address[] calldata viewers) external {
		require(
			originalCreator[tokenId] == msg.sender || ownerOf(tokenId) == msg.sender,
			"only original creator or owner can grant permission"
		);
		
		for (uint256 i = 0; i < viewers.length; i++) {
			extraViewers[tokenId][viewers[i]] = true;
			
			if (!isDirectMint[tokenId]) {
				_grantFeatureACL(tokenId, viewers[i]);
				_grantAttributeACL(tokenId, viewers[i]);
			}
			
			emit PermissionGranted(tokenId, viewers[i]);
		}
	}
	function tokenURI(uint256 tokenId) public view override returns (string memory) {
		require(_exists(tokenId), "Token does not exist");
		
		ImageMeta memory meta = images[tokenId];
		bool hasEncrypted = meta.ciphertextRoot != bytes32(0);
		
		string memory json;
		
		if (hasEncrypted) {
			json = string(abi.encodePacked(
				'{"name":"Encrypted Image #', tokenId.toString(),
				'","description":"An encrypted image NFT with FHE privacy protection",',
				'"image":"ipfs://', meta.ipfsCid,
				'","external_url":"ipfs://', meta.ipfsCid,
				'","attributes":['
			));
			
			json = string(abi.encodePacked(
				json,
				'{"trait_type":"Width","value":', uint256(meta.width).toString(), '},',
				'{"trait_type":"Height","value":', uint256(meta.height).toString(), '},',
				'{"trait_type":"Created At","value":', uint256(meta.createdAt).toString(), '},',
				'{"trait_type":"Has Encrypted Features","value":"true"}'
			));
			
			PlaintextAttribute[] memory plainAttrs = plaintextAttributes[tokenId];
			for (uint256 i = 0; i < plainAttrs.length; i++) {
				json = string(abi.encodePacked(
					json, ',',
					'{"trait_type":"', plainAttrs[i].trait_type,
					'","value":"', plainAttrs[i].value, '"}'
				));
			}
			
			uint256 encryptedCount = _encryptedAttributes[tokenId].length;
			for (uint256 i = 0; i < encryptedCount; i++) {
				json = string(abi.encodePacked(
					json, ',',
					'{"trait_type":"', _encryptedAttributes[tokenId][i].trait_type,
					'","value":"[ENCRYPTED]"}'
				));
			}
		} else {
			json = string(abi.encodePacked(
				'{"name":"Direct Mint NFT #', tokenId.toString(),
				'","description":"A directly minted NFT without encrypted data",',
				'"attributes":[',
				'{"trait_type":"Created At","value":', uint256(meta.createdAt).toString(), '},',
				'{"trait_type":"Has Encrypted Features","value":"false"},',
				'{"trait_type":"Mint Type","value":"Direct"}'
			));
		}
		
		json = string(abi.encodePacked(json, ']}'));
		
		return string(abi.encodePacked(
			"data:application/json;utf8,",
			json
		));
	}

	function hasEncryptedData(uint256 tokenId) external view returns (bool) {
		require(_exists(tokenId), "Token does not exist");
		return images[tokenId].ciphertextRoot != bytes32(0);
	}

	function totalSupply() external view returns (uint256) {
		return _tokenIdCounter;
	}

	function totalRegisteredImages() external view returns (uint256) {
		return _imageIdCounter;
	}

	function getAllMintedNFTs(uint256 startIndex, uint256 count) external view returns (uint256[] memory tokenIds) {
		uint256 total = _tokenIdCounter;
		if (startIndex >= total) {
			return new uint256[](0);
		}
		
		uint256 endIndex = startIndex + count;
		if (endIndex > total) {
			endIndex = total;
		}
		
		uint256 actualCount = endIndex - startIndex;
		tokenIds = new uint256[](actualCount);
		
		for (uint256 i = 0; i < actualCount; i++) {
			uint256 tokenId = startIndex + i + 1;
			if (_exists(tokenId)) {
				tokenIds[i] = tokenId;
			}
		}
	}

	function getAllNFTOwners(uint256 startIndex, uint256 count) external view returns (address[] memory owners) {
		uint256 total = _tokenIdCounter;
		if (startIndex >= total) {
			return new address[](0);
		}
		
		uint256 endIndex = startIndex + count;
		if (endIndex > total) {
			endIndex = total;
		}
		
		uint256 actualCount = endIndex - startIndex;
		owners = new address[](actualCount);
		
		for (uint256 i = 0; i < actualCount; i++) {
			uint256 tokenId = startIndex + i + 1;
			if (_exists(tokenId)) {
				owners[i] = _ownerOf(tokenId);
			}
		}
	}

	function getNFTInfo(uint256 tokenId) external view returns (
		address owner,
		address creator,
		bool hasEncrypted,
		bool isDirectMintValue,
		ImageMeta memory metadata
	) {
		require(_exists(tokenId), "Token does not exist");
		
		owner = _ownerOf(tokenId);
		creator = originalCreator[tokenId];
		hasEncrypted = images[tokenId].ciphertextRoot != bytes32(0);
		isDirectMintValue = isDirectMint[tokenId];
		metadata = images[tokenId];
	}

	function isImageRegisteredById(uint256 imageId) external view returns (bool) {
		return isImageRegistered[imageId];
	}

	function getImageMeta(uint256 imageId) external view returns (ImageMeta memory) {
		require(isImageRegistered[imageId], "Image not registered");
		return registeredImages[imageId];
	}

	function _exists(uint256 tokenId) internal view returns (bool) {
		return _ownerOf(tokenId) != address(0);
	}

	function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
		return super.supportsInterface(interfaceId);
	}

	function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
		address from = super._update(to, tokenId, auth);
		if (from != address(0) && to != address(0)) {
			if (!isDirectMint[tokenId]) {
				extraViewers[tokenId][to] = true;
				_grantFeatureACL(tokenId, to);
				_grantAttributeACL(tokenId, to);
			}
		}
		return from;
	}
}
