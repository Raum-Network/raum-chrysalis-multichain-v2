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

export type Networks = 'arbitrum-sepolia' | 'base-sepolia';

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
      cctp:'0x185915e86a5dd567fc8d381914503cb517e51317',
      cctpDestinationCaller:'0000000000000000000000000000000000000000',
      destination: '0x185915e86a5dd567fc8d381914503cb517e51317',
      decimal: 6
    },
    ccipNames: {
      sourceName: 'ethereum-testnet-sepolia-base-1',
      destName: 'ethereum-testnet-sepolia'
    }
  },
};