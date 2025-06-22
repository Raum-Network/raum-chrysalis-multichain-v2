import { ethers } from 'ethers';
import sepoliaCCTPABI from '../lib/abi/ChrysalisReceiverCCTP.json'

const SEPOLIA_CONTRACT_ADDRESS = '0x185915e86A5DD567FC8D381914503cb517e51317';
const SEPOLIA_RPC_URL = 'https://sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64';
const SEPOLIA_CONTRACT_CCTP_ADDRESS = "0x4EFF55608e01E7C4592dDB38F77E1ae1fE49fF73";

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
    this.contractCCTP = new ethers.Contract(SEPOLIA_CONTRACT_CCTP_ADDRESS, sepoliaCCTPABI, this.provider);
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

      public async getStakersCount(): Promise<string> {
    
        try {
          const count = await this.contractCCTP.uniqueRecipientCount();
          return count.toString();
        } catch (error) {
          console.error('Error fetching count:', error);
          throw error;
        }
        }

        public async totalUsdcStaked(): Promise<number> {
    
          try {
            const count = await this.contractCCTP.totalUSDCStaked();
            return (Number(count) / 10 ** 6);
          } catch (error) {
            console.error('Error fetching count:', error);
            throw error;
          }
          }
}



export default new stakedUserBalance();