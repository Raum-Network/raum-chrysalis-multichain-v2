import { ethers } from 'ethers';
import { useWriteContract, useReadContract, useWaitForTransactionReceipt, useTransaction, useSimulateContract } from 'wagmi';
import stakeABI from '../lib/abi/ChrysalisSender.json';
import stakeCCTPABI from '../lib/abi/ChrysalisSenderCCTP.json';
import { createPublicClient, http } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { simulateContract } from "@wagmi/core"
import stakedUserBalance from './sepoliaContract';
import { config } from './walletConnect';
import Web3 from 'web3';
import ReceiverAbiCCTP from './abi/ChrysalisReceiverCCTP.json';
import { getCCIPStatus, getCCTPAttestation } from '../services/api';
import { SUPPORTED_NETWORKS } from '../config/contract';

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
  origin?: string;
  receiver?: string;
  amount?: number;
  sourceNetworkName?: string;
  destNetworkName?: string;
  sourceDecimals?: number;
  destDecimals?: number;
};

class StakeManager {
  private pollingInterval: number = 30000;
  private currentStatus: StakeStatus | null = null;
  private statusSubscribers: ((status: StakeStatus) => void)[] = [];
  private timerInterval: NodeJS.Timeout | null = null;
  private pollingTimeout: NodeJS.Timeout | null = null;
  private web3!: Web3;
  private sepoliaWeb3!: Web3;
  private networkConfig!: typeof SUPPORTED_NETWORKS[keyof typeof SUPPORTED_NETWORKS];
  private publicClient: any;

  statusInterval: any;

  constructor(chainId: number) {
    this.updateChainId(chainId);
  }

  updateChainId(chainId: number) {
    // Find the network config based on chainId
    const network = Object.values(SUPPORTED_NETWORKS).find(net => net.chainId === chainId);
    this.networkConfig = network || SUPPORTED_NETWORKS['arbitrum-sepolia'];

    // Initialize Web3 instances with the appropriate RPC URLs
    this.web3 = new Web3(this.networkConfig.rpcUrl);
    this.sepoliaWeb3 = new Web3('https://sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64');

    // Create a new public client for the current network
    this.publicClient = createPublicClient({
      chain: {
        id: this.networkConfig.chainId,
        name: this.networkConfig.name,
        network: this.networkConfig.name.toLowerCase().replace(' ', '-'),
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: [this.networkConfig.rpcUrl],
          },
          public: {
            http: [this.networkConfig.rpcUrl],
          },
        },
      },
      transport: http()
    });
  }

  private isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  public async stake(
    destinationChainSelector: string,
    receiver: string,
    amount: number,
    gasLimit: string,
    writeContractAsync: any,
    simulateTransaction: any,
    onStatusUpdate: (status: StakeStatus) => void
  ): Promise<void> {
    try {
      const txHashStake = await writeContractAsync({
        address: this.networkConfig.contracts.ccip as `0x${string}`,
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
        timeElapsed: '',
        expectedTime: "40m 00s",
        isCommitted: false,
        isBlessed: false,
        sourceNetworkName: this.networkConfig.name,
        destNetworkName: 'Sepolia'
      };

      onStatusUpdate(this.currentStatus);

      this.startTimer(initialTimestamp, onStatusUpdate);

      const receipt = await this.publicClient.waitForTransactionReceipt(
        { hash: txHashStake }
      )

      userAddress = receipt.from;

      const simulationData = await simulateContract(config, {
        address: this.networkConfig.contracts.ccip as `0x${string}`,
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
        origin: userAddress,
        receiver: receiver,
        amount: amount,
        sourceNetworkName: this.networkConfig.name,
        destNetworkName: 'Sepolia'
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
        address: this.networkConfig.contracts.cctp as `0x${string}`,
        abi: stakeCCTPABI,
        functionName: 'depositForBurnWithCaller',
        args: [amount, destinationDomain, mintReceipient, burnToken, destinationCaller]
      });

      const initialTimestamp = Date.now();

      this.currentStatus = {
        sourceTxHash: txHashStake,
        ccipMessageId: null,
        destinationTxHash: null,
        status: 'IN_PROGRESS',
        bridgingMessageId: null,
        timestamp: initialTimestamp,
        timeElapsed: '',
        expectedTime: "1m 00s",
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
      const eventTopic = this.web3.utils.keccak256('MessageSent(bytes)');
      const log = receipt.logs.find((l: any) => l.topics[0] === eventTopic);

      if (log && log.data) {
        const messageBytes = this.web3.eth.abi.decodeParameters(['bytes'], log.data)[0];
        const messageHash = this.web3.utils.keccak256(messageBytes as string);

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


  private async pollTransactionReceipt(txHash: string, maxRetries = 10, interval = 2000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {

      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
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
    maxRetries = 30
  ) {
    // Add initial delay of 3 seconds before starting attestation polling
    console.log('Waiting 3 seconds before starting attestation polling...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    let attestationResponse = { status: 'pending_confirmations', attestation: '' };
    let retryCount = 0;

    while (attestationResponse.status === 'pending_confirmations') {
      try {
        attestationResponse = await getCCTPAttestation(messageHash);

        // Reset retry count on successful call
        retryCount = 0;

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
      } catch (error: any) {
        console.error('Error fetching attestation:', error);

        if (error.response?.status === 404) {
          console.log('Attestation not found (404), retrying in 2 seconds...');
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

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

      // if (this.backgroundPolling) {
      //     await new Promise((r) => setTimeout(r, 1100));
      // }
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
      if (!import.meta.env.VITE_PRIVATE_KEY) {
        throw new Error("Private key is undefined");
      }

      const account = this.sepoliaWeb3.eth.accounts.privateKeyToAccount(
        import.meta.env.VITE_PRIVATE_KEY
      );
      this.sepoliaWeb3.eth.accounts.wallet.add(account);

      const contract = new this.sepoliaWeb3.eth.Contract(
        ReceiverAbiCCTP,
        `0x${this.networkConfig.contracts.cctpDestinationCaller}` as `0x${string}`
      );

      const hookData = await contract.methods.getHookData(
        amount,
        address.toLowerCase()
      ).call();

      const tx = contract.methods.receiveUSDC(hookData, messageBytes, attestation);
      const gas = await tx.estimateGas({ from: account.address });
      const gasPrice = await this.sepoliaWeb3.eth.getGasPrice();

      const txData = {
        from: account.address,
        to: `0x${this.networkConfig.contracts.cctpDestinationCaller}` as `0x${string}`,
        data: tx.encodeABI(),
        gas,
        gasPrice,
      };

      const signedTx = await account.signTransaction(txData);
      const receipt = await this.sepoliaWeb3.eth.sendSignedTransaction(
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

  private formatTimeElapsed(startTime: number): string {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }

  private startTimer(startTime: number, onStatusUpdate: (status: StakeStatus) => void) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      if (this.currentStatus) {
        this.currentStatus = {
          ...this.currentStatus,
          timeElapsed: ''
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

  private getNetworkName(chainName: string): string {
    if (chainName.toLowerCase().includes('sonieum')) {
      return 'Sonieum Minato';
    } else if (chainName.toLowerCase().includes('arbitrum')) {
      return 'Arbitrum Sepolia';
    } else if (chainName.toLowerCase().includes('base')) {
      return 'Base Sepolia';
    } else if (chainName.toLowerCase().includes('polygon')) {
      return 'Polygon Amoy';
    }
    return chainName;
  }

  private getNetworkDecimals(chainName: string): number {
    const networkKey = Object.keys(SUPPORTED_NETWORKS).find(key =>
      SUPPORTED_NETWORKS[key as keyof typeof SUPPORTED_NETWORKS].name.toLowerCase() === chainName.toLowerCase()
    );

    if (networkKey) {
      return SUPPORTED_NETWORKS[networkKey as keyof typeof SUPPORTED_NETWORKS].contracts.decimal || 6;
    }
    return 6; // Default to 6 decimals if network not found
  }

  private async checkStatus(
    txHash: string,
    messageId: string | null,
    initialTimestamp: number,
    onStatusUpdate: (status: StakeStatus) => void
  ) {
    try {
      if (!messageId) return;

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

        const sourceNetworkName = this.getNetworkName(ccipStatusBack.sourceNetworkName || 'Arbitrum Sepolia');
        const destNetworkName = this.getNetworkName(ccipStatusBack.destNetworkName || 'Sepolia');

        const updatedStatus = {
          ...this.currentStatus,
          status: newStatusBack,
          isCommitted,
          isBlessed,
          expectedTime: ['SUCCESS', 'FAILURE'].includes(newStatusBack) ? '' : "28m 03s",
          sourceNetworkName,
          destNetworkName,
          sourceDecimals: this.getNetworkDecimals(sourceNetworkName),
          destDecimals: this.getNetworkDecimals(destNetworkName)
        } as StakeStatus;

        this.updateStatus(updatedStatus, onStatusUpdate);

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

      const sourceNetworkName = this.getNetworkName(ccipStatus.sourceNetworkName || 'Arbitrum Sepolia');
      const destNetworkName = this.getNetworkName(ccipStatus.destNetworkName || 'Sepolia');

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
          isBlessed,
          sourceNetworkName,
          destNetworkName,
          sourceDecimals: this.getNetworkDecimals(sourceNetworkName),
          destDecimals: this.getNetworkDecimals(destNetworkName)
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
            expectedTime: "28m 03s",
            sourceNetworkName,
            destNetworkName,
            sourceDecimals: this.getNetworkDecimals(sourceNetworkName),
            destDecimals: this.getNetworkDecimals(destNetworkName)
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

    // this.backgroundPolling = true;
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

  public setExternalStatus(status: StakeStatus, onStatusUpdate: (status: StakeStatus) => void) {
    this.updateStatus(status, onStatusUpdate);
  }

  public startPollingAxelarStatus(
    txHash: string,
    initialTimestamp: number,
    onStatusUpdate: (status: StakeStatus) => void
  ) {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    this.statusInterval = setInterval(() => {
      this.checkAxelarStatus(txHash, initialTimestamp, onStatusUpdate);
    }, this.pollingInterval);
  }

  private async checkAxelarStatus(
    txHash: string,
    initialTimestamp: number,
    onStatusUpdate: (status: StakeStatus) => void
  ) {
    try {
      const response = await fetch(`https://testnet.api.gmp.axelarscan.io/?method=searchGMP&txHash=${txHash}`);
      const data = await response.json();

      if (data && data.data && data.data.length > 0) {
        let txData = data.data[0];
        let txStatus = txData.status;

        // Traverse the execution chain if the first executed state is just reaching the Axelar relayer instead of EVM Sepolia
        if (txStatus === 'executed' && txData.executed?.chain === 'axelar') {
          const nextHash = txData.executed.transactionHash;
          if (nextHash) {
            const nextResponse = await fetch(`https://testnet.api.gmp.axelarscan.io/?method=searchGMP&txHash=${nextHash}`);
            const nextData = await nextResponse.json();
            if (nextData && nextData.data && nextData.data.length > 0) {
              txData = nextData.data[0];
              txStatus = txData.status;
            }
          }
        }

        let newStatus: StakeStatus['status'] = this.currentStatus?.status || 'IN_PROGRESS';

        if (txStatus === 'executed') {
          // If the final leg execution occurs on an EVM chain, we are fully complete
          if (txData.executed?.chain_type === 'evm' || txData.executed?.chain === 'ethereum-sepolia') {
            newStatus = 'SUCCESS';
          }
        } else if (txStatus === 'error' || txStatus === 'failed') {
          newStatus = 'FAILURE';
        }

        if (!this.currentStatus || initialTimestamp >= this.currentStatus.timestamp) {
          const updatedStatus = {
            ...this.currentStatus!,
            status: newStatus,
            destinationTxHash: txData.executed?.transactionHash || null,
            expectedTime: ['SUCCESS', 'FAILURE'].includes(newStatus) ? '' : "15m 00s",
          };
          this.updateStatus(updatedStatus, onStatusUpdate);
        }

        if (newStatus === 'SUCCESS' || newStatus === 'FAILURE') {
          this.stopTimer();
          if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
          }
        }
      }
    } catch (error) {
      console.error('Error checking Axelar status:', error);
    }
  }
}

export default new StakeManager(421614); // Default to Arbitrum Sepolia