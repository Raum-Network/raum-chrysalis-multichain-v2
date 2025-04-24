import { ethers, EventLog } from 'ethers';
import { useWriteContract, useReadContract, useWaitForTransactionReceipt, useTransaction, useSimulateContract } from 'wagmi';
import stakeABI from '../lib/abi/ChrysalisSender.json';
import { createPublicClient, http } from 'viem'
import { polygonAmoy } from 'viem/chains'
import {simulateContract} from "@wagmi/core"
import { config } from './walletConnect';

const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http()
})

const CCIP_SEND_REQUESTED_ABI = [
   "event CCIPSendRequested(bytes32 messageId, uint64 sequenceNumber, address feeToken, uint256 fees, (uint256 sourceChainSelector, bytes sender, uint256 destChainSelector, bytes receiver, bytes data, (address token, uint256 amount)[] tokenAmounts, bytes feeTokenData) message)"
];

const STAKE_CONTRACT_ADDRESS = '0x1337D3f9Bd1F73617A85Fc666e217bc8B5747aff';

// Updated ABI to match your contract
const STAKING_ABI = [
  "function stakeTokens(uint64 _destinationChainSelector, address _receiver, uint256 _amount, uint64 _gasLimit) external returns (bytes32)",
  "event StakingAction(bytes32 indexed messageId, uint64 destinationChainSelector, address receiver, uint256 amount, uint256 ccipFee, address sender, uint8 actionType)"
];


const { JsonRpcProvider } = require("ethers");

export type StakeStatus = {
  sourceTxHash: string;
  ccipMessageId: string | null;
  destinationTxHash: string | null;
  status: 'UNTOUCHED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE' | 'COMMITTED' | 'BLESSED';
  timestamp: number;
  timeElapsed: string;
  expectedTime: string;
  isCommitted: boolean;
  isBlessed: boolean;
};

class StakeManager {
  private provider: ethers.BrowserProvider | null = null;
  private stakingContract: ethers.Contract | undefined;
  private pollingInterval: number = 30000; // Set to 30 seconds for checking status periodically
  private statusInterval: NodeJS.Timeout | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private currentStatus: StakeStatus | null = null; // Add this to track current status
  private contractAddress: string | undefined;

  constructor() {
    // Remove provider initialization from constructor
  }

  private isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  public async stake(
    destinationChainSelector: string,
    receiver: string,
    amount: number,
    gasLimit: string,
    writeContractAsync: any,
    simulateTransaction:any,
    onStatusUpdate: (status: StakeStatus) => void
  ): Promise<void> {
    try {
      // Use the passed in writeContractAsync function
      const txHashStake = await writeContractAsync({
        address: STAKE_CONTRACT_ADDRESS,
        abi: stakeABI,
        functionName: 'stakeTokens',
        args: [
          destinationChainSelector,
          receiver,
          amount,
          gasLimit
        ]
      });

      // Start timer only after transaction is confirmed
      const initialTimestamp = Date.now();

      // Set initial status
      this.currentStatus = {
        sourceTxHash: txHashStake,
        ccipMessageId: null,
        destinationTxHash: null,
        status: 'IN_PROGRESS',
        timestamp: initialTimestamp,
        timeElapsed: this.formatTimeElapsed(initialTimestamp),
        expectedTime: "13m 07s",
        isCommitted: false,
        isBlessed: false
      };

      // Initial status update
      onStatusUpdate(this.currentStatus);

      // Start the timer interval
      this.startTimer(initialTimestamp, onStatusUpdate);
      // Wait for transaction receipt
      // const receipt = await useTransaction({
      //   hash: txHashStake
      // });

      const receipt = await publicClient.waitForTransactionReceipt(
        { hash: txHashStake }
      )

      // Simulate the transaction using wagmi's useSimulateContract
      const simulationData = await simulateContract( config , {
        address: STAKE_CONTRACT_ADDRESS,
        abi: stakeABI,
        functionName: 'stakeTokens',
        args: [
          destinationChainSelector,
          receiver,
          amount,
          gasLimit
        ],
        blockNumber: BigInt(receipt.blockNumber) - BigInt(1), // Simulate at the block before the transaction
        account: receipt.from,
        value: BigInt(0),
      });

    

      const messageId = simulationData?.result;

      if (!messageId) {
        throw new Error('MessageId not found in simulation');
      }

      // Update status with messageId
      this.currentStatus = {
        ...this.currentStatus,
        ccipMessageId: messageId,
        status: 'IN_PROGRESS'
      };
      onStatusUpdate(this.currentStatus);

      // Start polling the status
      this.startPollingStatus(txHashStake, messageId, initialTimestamp, onStatusUpdate);

    } catch (error) {
      this.stopTimer();
      console.error('Staking failed:', error);
      throw error;
    }
  }

  private startTimer(initialTimestamp: number, onStatusUpdate: (status: StakeStatus) => void) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      if (this.currentStatus) {
        this.currentStatus = {
          ...this.currentStatus,
          timeElapsed: this.formatTimeElapsed(initialTimestamp)
        };
        onStatusUpdate(this.currentStatus);
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async checkStatus(
    txHash: string,
    messageId: string | null,
    initialTimestamp: number,
    onStatusUpdate: (status: StakeStatus) => void
  ) {
    // if (!this.stakingContract) return;

    try {
      if (messageId) {
        const response = await fetch(`/api/ccip-status?messageId=${messageId}`);
        const ccipStatus = await response.json();

        let newStatus: StakeStatus['status'] = this.currentStatus?.status || 'IN_PROGRESS';

        if (ccipStatus.state === 2) {
          newStatus = 'SUCCESS';
        } else if (ccipStatus.state === 1) {
          newStatus = 'FAILURE';
        } else if (this.currentStatus?.status === 'IN_PROGRESS') {
          if (ccipStatus.commitBlockTimestamp) {
            newStatus = 'COMMITTED';
          } else if (ccipStatus.blessBlockTimestamp) {
            newStatus = 'BLESSED';
          }
        }

        const isCommitted = !!ccipStatus.commitBlockTimestamp;
        const isBlessed = !!ccipStatus.blessBlockTimestamp;

        if (!this.currentStatus || initialTimestamp >= this.currentStatus.timestamp) {
          this.currentStatus = {
            sourceTxHash: txHash,
            ccipMessageId: messageId,
            destinationTxHash: ccipStatus.receiptTransactionHash || null,
            status: newStatus,
            timestamp: initialTimestamp,
            timeElapsed: this.formatTimeElapsed(initialTimestamp),
            expectedTime: newStatus === 'SUCCESS' || newStatus === 'FAILURE' ? '' : "13m 07s",
            isCommitted,
            isBlessed
          };
          onStatusUpdate(this.currentStatus);
        }

        if (newStatus === 'SUCCESS' || newStatus === 'FAILURE') {
          this.currentStatus = {
            sourceTxHash: txHash,
            ccipMessageId: messageId,
            destinationTxHash: ccipStatus.receiptTransactionHash || null,
            status: newStatus,
            timestamp: initialTimestamp,
            timeElapsed: this.formatTimeElapsed(initialTimestamp),
            expectedTime: newStatus === 'SUCCESS' || newStatus === 'FAILURE' ? '' : "13m 07s",
            isCommitted,
            isBlessed
          };
          onStatusUpdate(this.currentStatus);
          this.stopTimer();
          if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
          }
        }
      }
    } catch (error) {
      console.error('Error checking staking status:', error);
    }
  }


  private startPollingStatus(
    txHash: string,
    messageId: string | null,
    initialTimestamp: number,
    onStatusUpdate: (status: StakeStatus) => void
  ) {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    this.statusInterval = setInterval(() => {
      this.checkStatus(txHash, messageId, initialTimestamp, onStatusUpdate);
    }, this.pollingInterval);
  }

  public formatTimeElapsed(timestamp: number): string {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000); // seconds
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }

}

export default new StakeManager();
