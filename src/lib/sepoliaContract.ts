import { ethers } from 'ethers';

const SEPOLIA_CONTRACT_ADDRESS = '0x185915e86A5DD567FC8D381914503cb517e51317';
const SEPOLIA_RPC_URL = 'https://sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64';
const SEPOLIA_CONTRACT_CCTP_ADDRESS = "0x0267Cf87951fB8e6BE909025cCC67f8DDE991eA7";

// Add ERC20 transfer event to the ABI
const CONTRACT_ABI = [
  "function stakedAmount(address account) view returns (uint256)",
];

class stakedUserBalance {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private contractCCTP: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    this.contract = new ethers.Contract(SEPOLIA_CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);
    this.contractCCTP = new ethers.Contract(SEPOLIA_CONTRACT_CCTP_ADDRESS, CONTRACT_ABI, this.provider);
  }

  public async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.contract.stakedAmount(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  public async getProvider(): Promise<ethers.JsonRpcProvider> {
    return this.provider;
  }
  public async getBalanceCCTP(address: string): Promise<string> {
    
      try {
        const balance = await this.contractCCTP.stakedAmount(address);
        return ethers.formatEther(balance);
      } catch (error) {
        console.error('Error fetching balance:', error);
        throw error;
      }
      }
}



export default new stakedUserBalance();