// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.9;

import "./access/AccessControl.sol";
import "./interfaces/IRMRKBaseStorage.sol";
import "./utils/Address.sol";

contract RMRKBaseStorage is AccessControl, IRMRKBaseStorage {
  using Address for address;
    /*
    REVIEW NOTES:

    This contract represents an initial working implementation for a representation of a single RMRK base.

    In its current implementation, the single base struct is overloaded to handle both fixed and slot-style
    assets. This implementation is simple but inefficient, as each stores a complete string representation.
    of each asset. Future implementations may want to include a mapping of common prefixes / suffixes and
    getters that recompose these assets on the fly.

    IntakeStruct currently requires the user to pass an id of type bytes8 as an identifier. Other options
    include computing the id on-chain as a hash of attributes of the struct, or a simple incrementer. Passing
    an ID or an incrementer will likely be the cheapest in terms of gas cost.

    In its current implementation, all base asset entries MUST be passed via an array during contract construction.
    This is the only way to ensure contract immutability after deployment, though due to the gas costs of RMRK
    base assets it is hightly recommended that developers are offered a commit > freeze pattern, by which developers
    are allowed multiple commits until a 'freeze' function is called, after which the base contract is no
    longer mutable.

    */


    //bytes8 is sort of arbitrary here--resource IDs in RMRK substrate are bytes8 for reference
    mapping(bytes8 => Base) private bases;
    mapping(bytes8 => mapping(address => bool)) private isEquippable;

    bytes8[] private baseIds;

    bytes32 public constant issuer = keccak256("ISSUER");

    //TODO: Make private
    string public name;

    event AddedEquippablesToEntry(bytes8 baseId, address[] equippableAddresses);
    event AddedEquippableToAll(address equippableAddress);

    //Inquire about using an index instead of hashed ID to prevent any chance of collision
    //Consider moving to interface
    struct IntakeStruct {
        bytes8 id;
        Base base;
    }

    //Consider merkel tree for equippables validation?

    /**
    @dev Base items are only settable during contract deployment (with one exception, see addEquippableIds).
    * This may need to be changed for contracts which would reach the block gas limit.
    */

    constructor(string memory _name) {
        _grantRole(issuer, msg.sender);
        _setRoleAdmin(issuer, issuer);
        name = _name;
    }

    /**
    @dev Private function for handling an array of base item inputs. Takes an array of type IntakeStruct.
    */

    function _addBaseEntryList(IntakeStruct[] memory intakeStruct) internal {
        for (uint256 i = 0; i < intakeStruct.length; i++) {
            _addBaseEntry(intakeStruct[i]);
        }
    }

    /**
    @dev Private function which writes base item entries to storage. intakeStruct takes the form of a struct containing
    * a bytes8 identifier and a base struct object.
    */

    function _addBaseEntry(IntakeStruct memory intakeStruct) internal {
        require(bases[intakeStruct.id].itemType == ItemType.None, "Base already exists");
        bases[intakeStruct.id] = intakeStruct.base;
        baseIds.push(intakeStruct.id);
    }

    /**
    @dev Getter for a single base item entry.
    */

    function getBaseEntry(bytes8 _id) external view returns (Base memory) {
        return (bases[_id]);
    }

    /**
    @dev Public function which adds a number of equippableAddresses to a single base entry. Only accessible by the contract
    * deployer or transferred Issuer, designated by the modifier onlyIssuer as per the inherited contract issuerControl.
    */

    function addEquippableAddresses(
        bytes8 _baseEntryid,
        address[] memory _equippableAddresses
    ) public onlyRole(issuer) {
        require(_equippableAddresses.length > 0, "RMRK: Zero-length ids passed.");
        require(bases[_baseEntryid].itemType != ItemType.None, "RMRK: Base entry does not exist.");
        uint256 len = _equippableAddresses.length;
        for (uint i; i<len;) {
          isEquippable[_baseEntryid][_equippableAddresses[i]] = true;
          unchecked {++i;}
        }
        emit AddedEquippablesToEntry(_baseEntryid, _equippableAddresses);
    }

    /**
    @dev Public function which adds a single equippableId to every base item.
    * Handle this function with care, this function can be extremely gas-expensive. Only accessible by the contract
    * deployer or transferred Issuer, designated by the modifier onlyIssuer as per the inherited contract issuerControl.
    */

    function addEquippableIdToAll(address _equippableAddress) public onlyRole(issuer) {
        uint256 len = baseIds.length;
        for (uint256 i = 0; i < len;) {
            bytes8 baseId_ = baseIds[i];
            if (bases[baseId_].itemType == ItemType.Slot) {
                isEquippable[baseId_][_equippableAddress] = true;
                unchecked {++i;}
            }
        }
        emit AddedEquippableToAll(_equippableAddress);
    }

    function checkIsEquippable(bytes8 baseId, address targetAddress) public view returns (bool isEquippable_) {
        isEquippable_ = isEquippable[baseId][targetAddress];
    }

    function checkIsEquippableMulti(bytes8[] calldata baseId, address[] calldata targetAddress) public view returns (bool[] memory isEquippable_) {
        uint256 len = baseId.length;
        require(len == targetAddress.length, "Mismatched input array length");
        for (uint i; i<len;) {
          isEquippable_[i] = isEquippable[baseId[i]][targetAddress[i]];
          unchecked {++i;}
        }
    }

    /**
    @dev Getter for multiple base item entries.
    */

    function getBaseEntries(bytes8[] calldata _ids)
        external
        view
        returns (Base[] memory)
    {
        Base[] memory baseEntries;
        return baseEntries;
    }
}
