export type NetworkConfig = {
  name: string;
  chainId: number;
  rpcUrl: string;
  publicRpc:string;
  explorer: string;
  contracts: {
    ccip: string;
    usdc: string;
    fees: string;
    destination?: string;
    cctp?: string;
    decimal?: number;
    cctpDestinationCaller?: string;
  };
  icon?: string;
  ccipNames: {
    sourceName: string;
    destName: string;
  };
};

export type Networks = 'arbitrum-sepolia' | 'base-sepolia' | 'lisk-sepolia';

export const SUPPORTED_NETWORKS: Record<Networks, NetworkConfig> = {
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    publicRpc:"https://sepolia-rollup.arbitrum.io/rpc",
    rpcUrl: 'https://arbitrum-sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
    explorer: 'https://sepolia.arbiscan.io',
    contracts: {
      ccip: '0x01851b172b1b0a5709deec827a88732dba00c467',
      cctp:'0x907D0cCc4e0Fa0EbDa7a0BDbFae592027607c22B',
      cctpDestinationCaller:'0267Cf87951fB8e6BE909025cCC67f8DDE991eA7',
      usdc: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d',
      fees: '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
      destination: '0x185915e86a5dd567fc8d381914503cb517e51317',
      decimal: 6
    },
    ccipNames: {
      sourceName: 'ethereum-testnet-sepolia-arbitrum-1',
      destName: 'ethereum-testnet-sepolia'
    }
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    publicRpc:'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    contracts: {
      ccip: '0x45057d6CC1608C7E3B13570A29078848A8794D9e',
      usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      fees: '0xE4aB69C077896252FAFBD49EFD26B5D171A32410',
      cctp:'0x0000000000000000000000000000000000000000',
      cctpDestinationCaller:'0000000000000000000000000000000000000000',
      destination: '0x185915e86a5dd567fc8d381914503cb517e51317',
      decimal: 6
    },
    ccipNames: {
      sourceName: 'ethereum-testnet-sepolia-base-1',
      destName: 'ethereum-testnet-sepolia'
    }
  },
  'lisk-sepolia': {
    name: 'Lisk Sepolia',
    chainId: 4202,
    rpcUrl: 'https://lisk-sepolia.drpc.org/',
    publicRpc:'https://lisk-sepolia.drpc.org/',
    explorer: 'https://sepolia-blockscout.lisk.com/',
    contracts: {
      ccip: '0x459922d991923FcA7948dbee715C8dEBeF53948d',
      usdc: '0x043052cf7cf2a9679d9563d951a73856d5e5b4c4',
      fees: '0x6641415a61bCe80D97a715054d1334360Ab833Eb',
      cctp:'0x0000000000000000000000000000000000000000',
      cctpDestinationCaller:'0000000000000000000000000000000000000000',
      destination: '0x185915e86a5dd567fc8d381914503cb517e51317',
      decimal: 18
    },
    ccipNames: {
      sourceName: 'ethereum-testnet-sepolia-lisk-1',
      destName: 'ethereum-testnet-sepolia'
    }
  },
};