import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  shouldHandleAcceptsForResources,
  shouldHandleApprovalsForResources,
  shouldHandleOverwritesForResources,
  shouldHandleRejectsForResources,
  shouldHandleSetPriorities,
  shouldSupportInterfacesForResources,
} from './behavior/multiresource';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

const name = 'RmrkTest';
const symbol = 'RMRKTST';
let nextTokenId = 1;
let nextResourceId = 1;

async function deployRmrkMultiResourceMockFixture() {
  const Token = await ethers.getContractFactory('RMRKMultiResourceMock');
  const token = await Token.deploy(name, symbol);
  await token.deployed();
  return { token };
}

async function mint(token: Contract, to: string): Promise<number> {
  const tokenId = nextTokenId;
  nextTokenId++;
  await token['mint(address,uint256)'](to, tokenId);
  return tokenId;
}

async function addResourceEntry(token: Contract, data?: string): Promise<BigNumber> {
  const resourceId = BigNumber.from(nextResourceId);
  nextResourceId++;
  await token.addResourceEntry(resourceId, data !== undefined ? data : 'metaURI');
  return resourceId;
}

async function addResourceToToken(
  token: Contract,
  tokenId: number,
  resId: BigNumber,
  overwrites: BigNumber | number,
): Promise<void> {
  await token.addResourceToToken(tokenId, resId, overwrites);
}

describe('MultiresourceMock MR behavior with minted token', async () => {
  const tokenId = 1;

  beforeEach(async function () {
    const tokenOwner = (await ethers.getSigners())[1];
    const { token } = await loadFixture(deployRmrkMultiResourceMockFixture);
    await token['mint(address,uint256)'](tokenOwner.address, tokenId);
    this.token = token;
  });

  shouldSupportInterfacesForResources();
  shouldHandleApprovalsForResources(tokenId);
  shouldHandleOverwritesForResources(tokenId, addResourceEntry, addResourceToToken);
});

describe('MultiresourceMock MR behavior with minted token and pending resources', async () => {
  const tokenId = 1;
  const resId1 = BigNumber.from(1);
  const resData1 = 'data1';
  const resId2 = BigNumber.from(2);
  const resData2 = 'data2';

  beforeEach(async function () {
    const tokenOwner = (await ethers.getSigners())[1];
    const { token } = await loadFixture(deployRmrkMultiResourceMockFixture);

    // Mint and add 2 resources to token
    await token['mint(address,uint256)'](tokenOwner.address, tokenId);
    await token.addResourceEntry(resId1, resData1);
    await token.addResourceEntry(resId2, resData2);
    await token.addResourceToToken(tokenId, resId1, 0);
    await token.addResourceToToken(tokenId, resId2, 0);

    this.token = token;
  });

  shouldHandleAcceptsForResources(tokenId, resId1, resData1, resId2, resData2);
  shouldHandleRejectsForResources(tokenId, resId1, resData1, resId2, resData2);
  shouldHandleSetPriorities(tokenId);
});

describe('MultiResourceMock Init', async function () {
  let token: Contract;

  before(async function () {
    ({ token } = await loadFixture(deployRmrkMultiResourceMockFixture));
  });

  it('Name', async function () {
    expect(await token.name()).to.equal(name);
  });

  it('Symbol', async function () {
    expect(await token.symbol()).to.equal(symbol);
  });
});

describe('MultiResourceMock Resource storage', async function () {
  let token: Contract;
  const metaURIDefault = 'metaURI';

  beforeEach(async function () {
    ({ token } = await loadFixture(deployRmrkMultiResourceMockFixture));
  });

  it('can add resource', async function () {
    const id = BigNumber.from(1);

    await expect(token.addResourceEntry(id, metaURIDefault))
      .to.emit(token, 'ResourceSet')
      .withArgs(id);
  });

  it('cannot get non existing resource', async function () {
    const id = BigNumber.from(1);
    await expect(token.getResource(id)).to.be.revertedWithCustomError(
      token,
      'RMRKNoResourceMatchingId',
    );
  });

  it('cannot add existing resource', async function () {
    const id = BigNumber.from(1);

    await token.addResourceEntry(id, metaURIDefault);
    await expect(token.addResourceEntry(id, 'newMetaUri')).to.be.revertedWithCustomError(
      token,
      'RMRKResourceAlreadyExists',
    );
  });

  it('cannot add resource with id 0', async function () {
    const id = 0;

    await expect(token.addResourceEntry(id, metaURIDefault)).to.be.revertedWithCustomError(
      token,
      'RMRKWriteToZero',
    );
  });

  it('cannot add same resource twice', async function () {
    const id = BigNumber.from(1);

    await expect(token.addResourceEntry(id, metaURIDefault))
      .to.emit(token, 'ResourceSet')
      .withArgs(id);

    await expect(token.addResourceEntry(id, metaURIDefault)).to.be.revertedWithCustomError(
      token,
      'RMRKResourceAlreadyExists',
    );
  });
});

describe('MultiResourceMock Adding resources to tokens', async function () {
  let token: Contract;
  let tokenOwner: SignerWithAddress;

  beforeEach(async function () {
    ({ token } = await loadFixture(deployRmrkMultiResourceMockFixture));
    tokenOwner = (await ethers.getSigners())[1];
  });

  it('can add resource to token', async function () {
    const resId = await addResourceEntry(token, 'data1');
    const resId2 = await addResourceEntry(token, 'data2');
    const tokenId = await mint(token, tokenOwner.address);

    await expect(token.addResourceToToken(tokenId, resId, 0)).to.emit(
      token,
      'ResourceAddedToToken',
    );
    await expect(token.addResourceToToken(tokenId, resId2, 0)).to.emit(
      token,
      'ResourceAddedToToken',
    );

    const pending = await token.getFullPendingResources(tokenId);
    expect(pending).to.be.eql([
      [resId, 'data1'],
      [resId2, 'data2'],
    ]);

    expect(await token.getPendingResObjectByIndex(tokenId, 0)).to.eql([resId, 'data1']);
  });

  it('cannot add non existing resource to token', async function () {
    const resId = BigNumber.from(1);
    const tokenId = await mint(token, tokenOwner.address);

    await expect(token.addResourceToToken(tokenId, resId, 0)).to.be.revertedWithCustomError(
      token,
      'RMRKNoResourceMatchingId',
    );
  });

  it('cannot add resource to non existing token', async function () {
    const resId = await addResourceEntry(token);
    const tokenId = 1;

    await expect(token.addResourceToToken(tokenId, resId, 0)).to.be.revertedWithCustomError(
      token,
      'ERC721InvalidTokenId',
    );
  });

  it('cannot add resource twice to the same token', async function () {
    const resId = await addResourceEntry(token);
    const tokenId = await mint(token, tokenOwner.address);

    await token.addResourceToToken(tokenId, resId, 0);
    await expect(token.addResourceToToken(tokenId, resId, 0)).to.be.revertedWithCustomError(
      token,
      'RMRKResourceAlreadyExists',
    );
  });

  it('cannot add too many resources to the same token', async function () {
    const tokenId = await mint(token, tokenOwner.address);

    for (let i = 1; i <= 128; i++) {
      const resId = await addResourceEntry(token);
      await token.addResourceToToken(tokenId, resId, 0);
    }

    // Now it's full, next should fail
    const resId = await addResourceEntry(token);
    await expect(token.addResourceToToken(tokenId, resId, 0)).to.be.revertedWithCustomError(
      token,
      'RMRKMaxPendingResourcesReached',
    );
  });

  it('can add same resource to 2 different tokens', async function () {
    const resId = await addResourceEntry(token);
    const tokenId1 = await mint(token, tokenOwner.address);
    const tokenId2 = await mint(token, tokenOwner.address);

    await token.addResourceToToken(tokenId1, resId, 0);
    await token.addResourceToToken(tokenId2, resId, 0);

    expect(await token.getPendingResources(tokenId1)).to.be.eql([resId]);
    expect(await token.getPendingResources(tokenId2)).to.be.eql([resId]);
  });
});

describe('MultiResourceMock Token URI', async function () {
  let token: Contract;
  let owner: SignerWithAddress;
  const metaURIDefault = 'metaURI';

  before(async () => {
    owner = (await ethers.getSigners())[0];
  });

  beforeEach(async function () {
    ({ token } = await loadFixture(deployRmrkMultiResourceMockFixture));
  });

  it('can set fallback URI', async function () {
    await token.setFallbackURI('TestURI');
    expect(await token.getFallbackURI()).to.be.eql('TestURI');
  });

  it('gets fallback URI if no active resources on token', async function () {
    const fallBackUri = 'fallback404';
    const tokenId = await mint(token, owner.address);

    await token.setFallbackURI(fallBackUri);
    expect(await token.tokenURI(tokenId)).to.eql(fallBackUri);
  });

  it('can get token URI when resource is not enumerated', async function () {
    const resId = await addResourceEntry(token);
    const resId2 = await addResourceEntry(token);
    const tokenId = await mint(token, owner.address);

    await token.addResourceToToken(tokenId, resId, 0);
    await token.addResourceToToken(tokenId, resId2, 0);
    await token.acceptResource(tokenId, 0);
    await token.acceptResource(tokenId, 0);
    expect(await token.tokenURI(tokenId)).to.eql(metaURIDefault);
  });

  it('can get token URI when resource is enumerated', async function () {
    const resId = await addResourceEntry(token);
    const resId2 = await addResourceEntry(token);
    const tokenId = await mint(token, owner.address);

    await token.addResourceToToken(tokenId, resId, 0);
    await token.addResourceToToken(tokenId, resId2, 0);
    await token.acceptResource(tokenId, 0);
    await token.acceptResource(tokenId, 0);
    await token.setTokenEnumeratedResource(resId, true);
    expect(await token.isTokenEnumeratedResource(resId)).to.eql(true);
    expect(await token.tokenURI(tokenId)).to.eql(`${metaURIDefault}${tokenId}`);
  });

  it('can get token URI at specific index', async function () {
    const resId = await addResourceEntry(token, 'UriA');
    const resId2 = await addResourceEntry(token, 'UriB');
    const tokenId = await mint(token, owner.address);

    await token.addResourceToToken(tokenId, resId, 0);
    await token.addResourceToToken(tokenId, resId2, 0);
    await token.acceptResource(tokenId, 0);
    await token.acceptResource(tokenId, 0);

    expect(await token.tokenURIAtIndex(tokenId, 1)).to.eql('UriB');
  });
});

// FIXME: this is broken
describe.skip('MultiResourceMock approvals cleaning', async () => {
  let addrs: SignerWithAddress[];
  let token: Contract;

  beforeEach(async function () {
    const [, ...signersAddr] = await ethers.getSigners();
    addrs = signersAddr;
    ({ token } = await loadFixture(deployRmrkMultiResourceMockFixture));
  });

  it('cleans token and resources approvals on transfer', async function () {
    const tokenOwner = addrs[1];
    const newOwner = addrs[2];
    const approved = addrs[3];
    const tokenId = await mint(token, tokenOwner.address);
    await token.connect(tokenOwner).approve(approved.address, tokenId);
    await token.connect(tokenOwner).approveForResources(approved.address, tokenId);

    expect(await token.getApproved(tokenId)).to.eql(approved.address);
    expect(await token.getApprovedForResources(tokenId)).to.eql(approved.address);

    await token.connect(tokenOwner).transfer(newOwner.address, tokenId);

    expect(await token.getApproved(tokenId)).to.eql(ethers.constants.AddressZero);
    expect(await token.getApprovedForResources(tokenId)).to.eql(ethers.constants.AddressZero);
  });

  it('cleans token and resources approvals on burn', async function () {
    const tokenOwner = addrs[1];
    const approved = addrs[3];
    const tokenId = await mint(token, tokenOwner.address);
    await token.connect(tokenOwner).approve(approved.address, tokenId);
    await token.connect(tokenOwner).approveForResources(approved.address, tokenId);

    expect(await token.getApproved(tokenId)).to.eql(approved.address);
    expect(await token.getApprovedForResources(tokenId)).to.eql(approved.address);

    await token.connect(tokenOwner).burn(tokenId);

    await expect(token.getApproved(tokenId)).to.be.revertedWithCustomError(
      token,
      'ERC721InvalidTokenId',
    );
    await expect(token.getApprovedForResources(tokenId)).to.be.revertedWithCustomError(
      token,
      'ERC721InvalidTokenId',
    );
  });
});
