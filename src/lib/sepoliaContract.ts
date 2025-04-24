import { ethers } from 'ethers';

const SEPOLIA_CONTRACT_ADDRESS = '0x7d3d9397A713800B586c07f65a05b9c2eB5e6DF1';
const SEPOLIA_RPC_URL = 'https://1rpc.io/sepolia';

// ABI for the specific function you want to call
const CONTRACT_ABI = [
  "function stakedAmount(address account) view returns (uint256)",
  
];

class stakedUserBalance {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    this.contract = new ethers.Contract(SEPOLIA_CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);
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

  
}

export default new stakedUserBalance(); 