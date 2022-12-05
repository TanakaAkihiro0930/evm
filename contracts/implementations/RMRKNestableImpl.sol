// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.16;

import "./abstracts/RMRKAbstractNestableImpl.sol";

error RMRKMintUnderpriced();

/**
 * @title RMRKNestableImpl
 * @author RMRK team
 * @notice Implementation of RMRK nestable module.
 */
contract RMRKNestableImpl is RMRKAbstractNestableImpl {
    /**
     * @notice Used to initialize the smart contract.
     * @param name_ Name of the token collection
     * @param symbol_ Symbol of the token collection
     * @param maxSupply_ Maximum supply of tokens in the collection
     * @param pricePerMint_ Minting price of a token represented in the smallest denomination of the native currency
     * @param collectionMetadata_ The collection metadata URI
     * @param tokenURI_ The base URI of the token metadata
     * @param royaltyRecipient The recipient of resale royalties
     * @param royaltyPercentageBps The percentage of resale value to be allocated to the `royaltyRecipient` expressed in
     *  basis points
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 pricePerMint_,
        string memory collectionMetadata_,
        string memory tokenURI_,
        address royaltyRecipient,
        uint256 royaltyPercentageBps //in basis points
    )
        RMRKMintingUtils(maxSupply_, pricePerMint_)
        RMRKCollectionMetadata(collectionMetadata_)
        RMRKRoyalties(royaltyRecipient, royaltyPercentageBps)
        RMRKNestable(name_, symbol_)
    {
        _setTokenURI(tokenURI_);
    }

    /**
     * @notice Used to mint the desired number of tokens to the specified address.
     * @dev The `data` value of the `_safeMint` method is set to an empty value.
     * @dev Can only be called while the open sale is open.
     * @param to Address to which to mint the token
     * @param numToMint Number of tokens to mint
     */
    function mint(
        address to,
        uint256 numToMint
    ) public payable virtual notLocked saleIsOpen {
        (uint256 nextToken, uint256 totalSupplyOffset) = _preMint(numToMint);

        for (uint256 i = nextToken; i < totalSupplyOffset; ) {
            _safeMint(to, i, "");
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Used to mint a desired number of child tokens to a given parent token.
     * @dev The `data` value of the `_safeMint` method is set to an empty value.
     * @dev Can only be called while the open sale is open.
     * @param to Address of the collection smart contract of the token into which to mint the child token
     * @param numToMint Number of tokens to mint
     * @param destinationId ID of the token into which to mint the new child token
     */
    function nestMint(
        address to,
        uint256 numToMint,
        uint256 destinationId
    ) public payable virtual notLocked saleIsOpen {
        (uint256 nextToken, uint256 totalSupplyOffset) = _preMint(numToMint);

        for (uint256 i = nextToken; i < totalSupplyOffset; ) {
            _nestMint(to, i, destinationId, "");
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Used to verify that the amount of native currency accompanying the transaction equals the expected value.
     * @param value The expected amount of native currency to accompany the transaction
     */
    function _charge(uint256 value) internal virtual override {
        if (value != msg.value) revert RMRKMintUnderpriced();
    }
}