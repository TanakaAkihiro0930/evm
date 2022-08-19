// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

/**
 * @title ERC721 token receiver interface
 * @dev Interface for any contract that wants to support safeTransfers
 * from ERC721 asset contracts.
 */
interface IRMRKNestingWithEquippable {

    /**
    * @dev Returns address of Equippable contract
    */
    function getEquippablesAddress() external view returns (address);

    /**
    * @dev Returns approved or owner status of `spender` for `tokenId`.
    */
    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool);
}
