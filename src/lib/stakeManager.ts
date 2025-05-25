import { ethers } from 'ethers';
import { useWriteContract, useReadContract, useWaitForTransactionReceipt, useTransaction, useSimulateContract } from 'wagmi';
import stakeABI from '../lib/abi/ChrysalisSender.json';
import stakeCCTPABI from '../lib/abi/ChrysalisSenderCCTP.json';
import { createPublicClient, http } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import {simulateContract} from "@wagmi/core"
import stakedUserBalance from './sepoliaContract';
import { config } from './walletConnect';
import Web3 from 'web3';
import ReceiverAbiCCTP from './abi/ChrysalisReceiverCCTP.json';
import { getCCIPStatus, getCCTPAttestation } from '../services/api';

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http()
})

const abiCoder = new ethers.AbiCoder();

const tupleType = `tuple(
  uint64 sourceChainSelector,
  address sender,
  address receiver,
  uint64 sequenceNumber,
  uint256 gasLimit,
  bool strict,
  uint64 nonce,
  address feeToken,
  uint256 feeTokenAmount,
  bytes data,
  tuple(address token, uint256 amount)[] tokenAmounts,
  bytes32 extraData,
  bytes32 messageId
)`;

let userAddress: string;

const STAKE_CONTRACT_ADDRESS = '0x01851B172B1B0A5709DEEC827A88732Dba00C467';
const STAKE_CCTP_CONTRACT_ADDRESS = '0xd827d623E84EB86E4b829f92B3C77936BdAEF136';
const web3 = new Web3('https://arbitrum-sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64');
const sepoliaWeb3 = new Web3('https://sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64');
const RECEIVER_CONTRACT_ADDRESS = '0x91730db0d18005aa0e11d686a90560bd376a4825';
const RECEIVER_CONTRACT_ADDRESS_CCTP = '0x0267Cf87951fB8e6BE909025cCC67f8DDE991eA7';

export type StakeStatus = {
  sourceTxHash: string;
  ccipMessageId: string | null;
  destinationTxHash: any;
  status: 'UNTOUCHED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE' | 'COMMITTED' | 'BLESSED' | 'BRIDGING_BACK';
  bridgingMessageId: any;
  timestamp: number;
  timeElapsed: string;
  expectedTime: string;
  isCommitted: boolean;
  isBlessed: boolean;
  sourceChain?: 'arbitrum_sepolia' | 'sepolia';
  attestationStatus?: string;
  messageBytes?: string;
  attestation?: string;
  hideOnStakePage?: boolean;
  // Add these new properties
  origin?: string;
  receiver?: string;
  amount?: number; // Add amount property
};

class StakeManager {
  private pollingInterval: number = 30000; 
  private statusInterval: NodeJS.Timeout | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private currentStatus: StakeStatus | null = null;
  private backgroundPolling: boolean = true;
  private statusSubscribers: ((status: StakeStatus) => void)[] = []; // Subscribers array

  constructor() {}

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
      const txHashStake = await writeContractAsync({
        address: STAKE_CONTRACT_ADDRESS,
        abi: stakeABI,
        functionName: 'handleStakingAction',
        args: [
          destinationChainSelector,
          receiver,
          amount,
          gasLimit
        ]
      });

      const initialTimestamp = Date.now();

      this.currentStatus = {
        sourceTxHash: txHashStake,
        ccipMessageId: null,
        destinationTxHash: null,
        status: 'IN_PROGRESS',
        bridgingMessageId: null,
        timestamp: initialTimestamp,
        timeElapsed: this.formatTimeElapsed(initialTimestamp),
        expectedTime: "5m 02s",
        isCommitted: false,
        isBlessed: false
      };

      onStatusUpdate(this.currentStatus);

      this.startTimer(initialTimestamp, onStatusUpdate);

      const receipt = await publicClient.waitForTransactionReceipt(
        { hash: txHashStake }
      )

      userAddress = receipt.from;

      const simulationData = await simulateContract(config, {
        address: STAKE_CONTRACT_ADDRESS,
        abi: stakeABI,
        functionName: 'handleStakingAction',
        args: [
          destinationChainSelector,
          receiver,
          amount,
          gasLimit
        ],
        blockNumber: BigInt(receipt.blockNumber) - BigInt(1), 
        account: receipt.from,
        value: BigInt(0),
      });

      const messageId = simulationData?.result;

      if (!messageId) {
        throw new Error('MessageId not found in simulation');
      }
      
      this.currentStatus = {
        ...this.currentStatus,
        ccipMessageId: messageId,
        status: 'IN_PROGRESS',
        origin: userAddress, // Add origin
        receiver: receiver,   // Add receiver
        amount: amount        // Add amount
      };
      this.updateStatus(this.currentStatus, onStatusUpdate);

      // Start background polling
      this.startPollingStatus(txHashStake, messageId, initialTimestamp, onStatusUpdate);

      // Hide status after 30 seconds
      setTimeout(() => {
        if (this.currentStatus) {
          this.currentStatus = {
            ...this.currentStatus,
            hideOnStakePage: true
          };
          onStatusUpdate(this.currentStatus);
        }
      }, 30000);

    } catch (error) {
      this.stopTimer();
      console.error('Staking failed:', error);
      throw error;
    }
  }

  public async stakeCCTP(
    amount: number,
    destinationDomain: number,
    mintReceipient: string,
    burnToken: string,
    destinationCaller: string,
    address: string,
    writeContractAsync: any,
    simulateTransaction: any,
    onStatusUpdate: (status: StakeStatus) => void
  ): Promise<void> {
    try {
      const txHashStake = await writeContractAsync({
        address: STAKE_CCTP_CONTRACT_ADDRESS,
        abi: stakeCCTPABI,
        functionName: 'depositForBurnWithCaller',
        args: [amount, destinationDomain, mintReceipient, burnToken, destinationCaller]
      });

      const initialTimestamp = Date.now();

      // Initialize status with source transaction
      this.currentStatus = {
        sourceTxHash: txHashStake,
        ccipMessageId: null,
        destinationTxHash: null,
        status: 'IN_PROGRESS',
        bridgingMessageId: null,
        timestamp: initialTimestamp,
        timeElapsed: this.formatTimeElapsed(initialTimestamp),
        expectedTime: "5m 02s",
        isCommitted: false,
        isBlessed: false,
        attestationStatus: 'pending',
        sourceChain: 'arbitrum_sepolia',
        origin: address,
        receiver: mintReceipient,
        amount: amount
      };

      this.updateStatus(this.currentStatus, onStatusUpdate);
      this.notifyStatusSubscribers(this.currentStatus);
      this.startTimer(initialTimestamp, onStatusUpdate);

      const receipt = await this.pollTransactionReceipt(txHashStake);
      const eventTopic = web3.utils.keccak256('MessageSent(bytes)');
      const log = receipt.logs.find((l: any) => l.topics[0] === eventTopic);

      if (log && log.data) {
        const messageBytes = web3.eth.abi.decodeParameters(['bytes'], log.data)[0];
        const messageHash = web3.utils.keccak256(messageBytes as string);
          
        // Update status with messageBytes
        this.currentStatus = {
          ...this.currentStatus,
          messageBytes: messageBytes as string
        };
        this.updateStatus(this.currentStatus, onStatusUpdate);
        
        await this.pollAttestation(messageHash, messageBytes as string, amount, address, onStatusUpdate);
      }

    } catch (error) {
      this.stopTimer();
      console.error('CCTP Staking failed:', error);
      throw error;
    }
  }

  public stopBackgroundPolling() {
    this.backgroundPolling = false;
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }

  private async pollTransactionReceipt(txHash: string, maxRetries = 10, interval = 2000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const receipt = await web3.eth.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`Transaction receipt not found for txHash: ${txHash}`);
  }

  private async pollAttestation(
    messageHash: string,
    messageBytes: string,
    amount: number,
    address: string,
    onStatusUpdate: (status: StakeStatus) => void,
    maxRetries = 3
  ) {
    let attestationResponse = { status: 'pending_confirmations', attestation: '' };
    let retryCount = 0;

    while (attestationResponse.status === 'pending_confirmations' && this.backgroundPolling) {
      try {
        attestationResponse = await getCCTPAttestation(messageHash);

        this.currentStatus = {
          ...this.currentStatus!,
          sourceTxHash: this.currentStatus?.sourceTxHash || '',
          status: this.currentStatus?.status || 'IN_PROGRESS',
          bridgingMessageId: this.currentStatus?.bridgingMessageId || null,
          timestamp: this.currentStatus?.timestamp || Date.now(),
          timeElapsed: this.currentStatus?.timeElapsed || '',
          expectedTime: this.currentStatus?.expectedTime || '',
          isCommitted: this.currentStatus?.isCommitted || false,
          isBlessed: this.currentStatus?.isBlessed || false,
          attestationStatus: attestationResponse.status,
        };
        onStatusUpdate(this.currentStatus);

        if (attestationResponse.status === 'complete') {
          await this.callSepoliaContract(messageBytes, attestationResponse.attestation, amount, address, onStatusUpdate);
          break;
        }
      } catch (error) {
        console.error('Error fetching attestation:', error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying attestation request (${retryCount}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        } else {
          this.currentStatus = {
            sourceTxHash: this.currentStatus?.sourceTxHash ?? '',
            ccipMessageId: this.currentStatus?.ccipMessageId ?? null,
            destinationTxHash: this.currentStatus?.destinationTxHash ?? null,
            status: 'FAILURE',
            bridgingMessageId: this.currentStatus?.bridgingMessageId ?? null,
            timestamp: this.currentStatus?.timestamp ?? Date.now(),
            timeElapsed: this.formatTimeElapsed(this.currentStatus?.timestamp ?? Date.now()),
            expectedTime: this.currentStatus?.expectedTime ?? '',
            isCommitted: false,
            isBlessed: false,
            attestationStatus: 'error',
            sourceChain: this.currentStatus?.sourceChain ?? 'arbitrum_sepolia',
            messageBytes: this.currentStatus?.messageBytes ?? '',
            attestation: this.currentStatus?.attestation ?? ''
          } as StakeStatus;
          onStatusUpdate(this.currentStatus);
          this.stopTimer();
          throw new Error(`Failed to get attestation after ${maxRetries} retries`);
        }
      }

      if (this.backgroundPolling) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }
  }

  private async callSepoliaContract(
    messageBytes: string,
    attestation: string,
    amount: number,
    address: string,
    onStatusUpdate: (status: StakeStatus) => void
  ) {
    try {
      if (!process.env.NEXT_PUBLIC_PRIVATE_KEY) {
        throw new Error("Private key is undefined");
      }

      const account = sepoliaWeb3.eth.accounts.privateKeyToAccount(
        process.env.NEXT_PUBLIC_PRIVATE_KEY
      );
      sepoliaWeb3.eth.accounts.wallet.add(account);
      
      const contract = new sepoliaWeb3.eth.Contract(
        ReceiverAbiCCTP,
        RECEIVER_CONTRACT_ADDRESS_CCTP
      );

      const hookData = await contract.methods.getHookData(
        amount,
        address.toLowerCase()
      ).call();

      const tx = contract.methods.receiveUSDC(hookData, messageBytes, attestation);
      const gas = await tx.estimateGas({ from: account.address });
      const gasPrice = await sepoliaWeb3.eth.getGasPrice();

      const txData = {
        from: account.address,
        to: RECEIVER_CONTRACT_ADDRESS_CCTP,
        data: tx.encodeABI(),
        gas,
        gasPrice,
      };

      const signedTx = await account.signTransaction(txData);
      const receipt = await sepoliaWeb3.eth.sendSignedTransaction(
        signedTx.rawTransaction!
      );

      // Update status with destination transaction
      this.currentStatus = {
        ...this.currentStatus!,
        destinationTxHash: receipt.transactionHash,
        status: 'SUCCESS',
        sourceChain: 'sepolia'
      };

      this.updateStatus(this.currentStatus, onStatusUpdate);
      this.notifyStatusSubscribers(this.currentStatus);
      this.stopTimer();

    } catch (error) {
      console.error("Error calling Sepolia contract:", error);
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
    try {
      if (!messageId || !this.backgroundPolling) return;

      if (this.currentStatus?.bridgingMessageId) {
        const ccipStatusBack = await getCCIPStatus(this.currentStatus.bridgingMessageId);
        
        let newStatusBack: StakeStatus['status'] = this.currentStatus?.status || 'IN_PROGRESS';

        if (ccipStatusBack.state === 2) {
          newStatusBack = 'SUCCESS';
        } else if (ccipStatusBack.state === 1) {
          newStatusBack = 'FAILURE';
        } else if (this.currentStatus?.status === 'IN_PROGRESS') {
          if (ccipStatusBack.commitBlockTimestamp) {
            newStatusBack = 'COMMITTED';
          } else if (ccipStatusBack.blessBlockTimestamp) {
            newStatusBack = 'BLESSED';
          }
        }

        const isCommitted = !!ccipStatusBack.commitBlockTimestamp;
        const isBlessed = !!ccipStatusBack.blessBlockTimestamp;

        this.currentStatus = {
          ...this.currentStatus,
          status: newStatusBack,
          isCommitted,
          isBlessed,
          expectedTime: ['SUCCESS', 'FAILURE'].includes(newStatusBack) ? '' : "28m 03s"
        };
        onStatusUpdate(this.currentStatus);

        if (newStatusBack === 'SUCCESS' || newStatusBack === 'FAILURE') {
          this.stopTimer();
          if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
          }
        }
        return;
      }

      const ccipStatus = await getCCIPStatus(messageId);

      let newStatus: StakeStatus['status'] = this.currentStatus?.status || 'IN_PROGRESS';

      if (ccipStatus.state === 2) {
        newStatus = 'BRIDGING_BACK';
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
          bridgingMessageId: null,
          timestamp: initialTimestamp,
          timeElapsed: this.formatTimeElapsed(initialTimestamp),
          expectedTime: ['SUCCESS', 'FAILURE', 'BRIDGING_BACK'].includes(newStatus) ? '' : "28m 03s",
          isCommitted,
          isBlessed
        };
        onStatusUpdate(this.currentStatus);
      }

      if (newStatus === 'BRIDGING_BACK') {
        let bridgingMessageId: string | null = null;
        const provider = await stakedUserBalance.getProvider();
        if (!this.currentStatus.destinationTxHash) {
          return;
        }
        const receipt = await provider.getTransactionReceipt(this.currentStatus.destinationTxHash);

        const ccipLog = receipt?.logs.find(log => log.topics[0] === "0xd0c3c799bf9e2639de44391e7f524d229b2b55f5b1ea94b2bf7da42f7243dddd");
        const rawData = ccipLog?.data;
        try {
          if (rawData) {
            const decoded = abiCoder.decode([tupleType], rawData);
            bridgingMessageId = decoded[0][12];
          }
        } catch (simulationError) {
          console.error('Error getting bridging back transaction:', simulationError);
          bridgingMessageId = null;
        }

        if (bridgingMessageId) {
          this.currentStatus = {
            ...this.currentStatus,
            bridgingMessageId,
            status: 'IN_PROGRESS',
            expectedTime: "28m 03s"
          };
          onStatusUpdate(this.currentStatus);
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

    this.backgroundPolling = true;
    this.statusInterval = setInterval(() => {
      this.checkStatus(txHash, messageId, initialTimestamp, onStatusUpdate);
    }, this.pollingInterval);
  }

  public subscribeToStatus(callback: (status: StakeStatus) => void) {
    this.statusSubscribers.push(callback);
    // Return unsubscribe function
    return () => {
      this.statusSubscribers = this.statusSubscribers.filter(cb => cb !== callback);
    };
  }

  private notifyStatusSubscribers(status: StakeStatus) {
    this.statusSubscribers.forEach(callback => callback(status));
  }

  private updateStatus(status: StakeStatus, onStatusUpdate: (status: StakeStatus) => void) {
    this.currentStatus = status;
    onStatusUpdate(status);
    this.notifyStatusSubscribers(status);
  }

  public formatTimeElapsed(timestamp: number): string {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
}

export default new StakeManager();