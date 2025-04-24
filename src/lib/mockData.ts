import { Transaction } from '../types/transaction';

// Generate random transaction ID
const generateTxId = () => {
  return '0x' + Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
};

// Generate random address
const generateAddress = () => {
  return '0x' + Array.from({ length: 40 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
};

// Generate date within the last 90 days
const generateDate = () => {
  const now = new Date();
  const pastDate = new Date();
  pastDate.setDate(now.getDate() - Math.floor(Math.random() * 90));
  
  // Add random hours, minutes, seconds
  pastDate.setHours(Math.floor(Math.random() * 24));
  pastDate.setMinutes(Math.floor(Math.random() * 60));
  pastDate.setSeconds(Math.floor(Math.random() * 60));
  
  return pastDate.toISOString();
};

// Generate descriptions for different transaction types
const generateDescription = (type: string) => {
  const descriptions = {
    deposit: [
      'Deposit from wallet',
      'Deposit from exchange',
      'Deposit from mining rewards',
      'Deposit from faucet',
      'Deposit from staking rewards'
    ],
    withdrawal: [
      'Withdrawal to exchange',
      'Withdrawal to wallet',
      'Withdrawal to bank account',
      'Withdrawal for payment',
      'Withdrawal to hardware wallet'
    ],
    transfer: [
      'Transfer to savings',
      'Transfer to trading account',
      'Transfer to yield farm',
      'Transfer to liquidity pool',
      'Transfer to staking contract'
    ],
    fee: [
      'Network fee',
      'Transaction fee',
      'Processing fee',
      'Exchange fee',
      'Gas fee for contract interaction'
    ]
  };
  
  const options = descriptions[type as keyof typeof descriptions] || descriptions.transfer;
  return options[Math.floor(Math.random() * options.length)];
};

// Generate random amount based on transaction type
const generateAmount = (type: string) => {
  let baseAmount = 0;
  
  switch (type) {
    case 'deposit':
      baseAmount = 0.1 + Math.random() * 2;
      break;
    case 'withdrawal':
      baseAmount = 0.05 + Math.random() * 1.5;
      break;
    case 'transfer':
      baseAmount = 0.01 + Math.random() * 0.5;
      break;
    case 'fee':
      baseAmount = 0.001 + Math.random() * 0.02;
      break;
    default:
      baseAmount = 0.1 + Math.random() * 1;
  }
  
  // Round to a reasonable number of decimal places
  return parseFloat(baseAmount.toFixed(6));
};

// Generate transaction status, with weighting toward completed
const generateStatus = () => {
  const random = Math.random();
  if (random < 0.85) return 'completed';
  if (random < 0.95) return 'pending';
  return 'failed';
};

// Generate mock transactions
export const mockTransactions: Transaction[] = Array.from({ length: 25 }, (_, i) => {
  const types = ['deposit', 'withdrawal', 'transfer', 'fee'];
  const type = types[Math.floor(Math.random() * (i > 20 ? 3 : 4))]; // Fewer fee transactions
  const txId = generateTxId();
  const address = generateAddress();
  const status = generateStatus();
  
  return {
    id: txId,
    type: type as any,
    status: status as any,
    amount: generateAmount(type),
    fee: type === 'fee' ? 0 : parseFloat((Math.random() * 0.005).toFixed(6)),
    currency: 'ETH',
    date: generateDate(),
    description: generateDescription(type),
    address: type !== 'fee' ? address : undefined,
    reference: Math.random() > 0.5 ? `REF-${Math.floor(Math.random() * 10000)}` : undefined,
    blockExplorer: status === 'completed' ? `https://etherscan.io/tx/${txId}` : undefined
  };
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());