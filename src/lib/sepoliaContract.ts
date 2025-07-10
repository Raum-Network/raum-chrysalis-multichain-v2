import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../config/contract';

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
    this.contract = new ethers.Contract(
      this.networkConfig.contracts.destination!,
      ['function stakedAmount(address) view returns (uint256)'],
      this.provider
    );
    this.contractCCTP = new ethers.Contract(
      `0x${SUPPORTED_NETWORKS['arbitrum-sepolia'].contracts.cctpDestinationCaller}`,
      ['function stakedAmount(address) view returns (uint256)'],
      this.provider
    );
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.contract.stakedAmount(address);
      return (Number(balance) / (1e18)).toString();
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  }

  async getBalanceCCTP(address: string): Promise<string> {
    try {
      const balance = await this.contractCCTP.stakedAmount(address);
      return (Number(balance) / 1e18).toString();
    } catch (error) {
      // console.log('Error getting CCTP balance:', error);
      return '0';
    }
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
}

export default new SepoliaContract(421614); // Default to Arbitrum Sepolia