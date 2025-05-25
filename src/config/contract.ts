export type NetworkConfig = {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  contracts: {
    ccip: string;
    usdc: string;
    fees: string;
    destination?: string;
    cctp?: string;
  };
  icon?: string;
};

export type Networks = 'arbitrum-sepolia' | 'base-sepolia' | 'polygon-amoy' | 'sonieum-minato';

export const SUPPORTED_NETWORKS: Record<Networks, NetworkConfig> = {
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    contracts: {
      ccip: '0x01851b172b1b0a5709deec827a88732dba00c467',
      cctp:'0xd827d623E84EB86E4b829f92B3C77936BdAEF136',
      usdc: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d',
      fees: '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
      destination: '0x185915e86a5dd567fc8d381914503cb517e51317'
    }
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    contracts: {
      ccip: '0x0000000000000000000000000000000000000000',
      usdc: '0x0000000000000000000000000000000000000000',
      fees: '0x0000000000000000000000000000000000000000',
      cctp:'',
      destination: '0x'
    }
  },
  'polygon-amoy': {
    name: 'Polygon Amoy',
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://www.oklink.com/amoy',
    contracts: {
     ccip: '0x0000000000000000000000000000000000000000',
      usdc: '0x0000000000000000000000000000000000000000',
      fees: '0x0000000000000000000000000000000000000000',
      cctp:'',
      destination: '0x'
    }
  },
  'sonieum-minato': {
    name: 'Sonieum Minato',
    chainId: 1946,
    rpcUrl: 'https://rpc.minato.sonieum.com',
    explorer: 'https://soneium-minato.blockscout.com/',
    contracts: {
     ccip: '0x0000000000000000000000000000000000000000',
      usdc: '0x0000000000000000000000000000000000000000',
      fees: '0x0000000000000000000000000000000000000000',
      cctp:'',
      destination: '0x'
    }
  }
};