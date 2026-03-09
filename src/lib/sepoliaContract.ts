import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../config/contract';
import { decodeAccountID } from "xrpl";
import { isProtocolSupported, normalizeEvmAddress } from './networkSupport';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Buffer } from "buffer";

function formatAddressForEVM(address: string): string {
  if (address && address.startsWith('r')) {
    try {
      const accountIDBytes = decodeAccountID(address);
      return `0x${Buffer.from(accountIDBytes).toString("hex")}`;
    } catch {
      return address;
    }
  }
  return address;
}

class SepoliaContract {
  private provider!: ethers.JsonRpcProvider;
  private contract!: ethers.Contract;
  private contractCCTP!: ethers.Contract;
  private networkConfig!: typeof SUPPORTED_NETWORKS[keyof typeof SUPPORTED_NETWORKS];

  constructor(chainId: number) {
    this.updateChainId(chainId);
  }

  updateChainId(chainId: number) {
    // Find the network config based on chainId
    const network = Object.values(SUPPORTED_NETWORKS).find(net => net.chainId === chainId);
    this.networkConfig = network || SUPPORTED_NETWORKS['arbitrum-sepolia'];

    // Initialize provider and contracts with the appropriate addresses
    this.provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64');
    // If Ripple Testnet (chainId 0), the actual EVM wrapper contract on Sepolia is stored in cctpDestinationCaller
    // The 'destination' field holds the XRPL recipient address which ethers cannot parse as a contract address
    const evmDestinationAddress = chainId === 0
      ? this.networkConfig.contracts.cctpDestinationCaller!
      : this.networkConfig.contracts.destination!;
    const safeEvmDestinationAddress = normalizeEvmAddress(evmDestinationAddress);
    const cctpDestinationCaller = normalizeEvmAddress(this.networkConfig.contracts.cctpDestinationCaller);

    this.contract = new ethers.Contract(
      safeEvmDestinationAddress,
      ['function stakedAmount(address) view returns (uint256)'],
      this.provider
    );
    this.contractCCTP = new ethers.Contract(
      cctpDestinationCaller,
      ['function stakedAmount(address) view returns (uint256)'],
      this.provider
    );
  }

  async getBalance(address: string): Promise<string> {
    try {
      const formattedAddress = formatAddressForEVM(address);
      const balance = await this.contract.stakedAmount(formattedAddress);
      console.log(balance, formattedAddress)
      return (Number(balance) / (1e18)).toString();
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  }

  async getBalanceCCTP(address: string): Promise<string> {
    try {
      if (!isProtocolSupported(this.networkConfig, 'CCTP')) {
        return '0';
      }
      const formattedAddress = formatAddressForEVM(address);
      const balance = await this.contractCCTP.stakedAmount(formattedAddress);
      return (Number(balance) / 1e18).toString();
    } catch {
      // console.log('Error getting CCTP balance:', error);
      return '0';
    }
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
}

export default new SepoliaContract(421614); // Default to Arbitrum Sepolia
