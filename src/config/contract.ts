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
    decimal?: number;
  };
  icon?: string;
  ccipNames: {
    sourceName: string;
    destName: string;
  };
  sourceDomain: number;
};

export type Networks = 'arbitrum-sepolia' | 'op-sepolia' | 'polygon-amoy' 

export const SUPPORTED_NETWORKS: Record<Networks, NetworkConfig> = {
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    contracts: {
      ccip: '0x01851b172b1b0a5709deec827a88732dba00c467',
      cctp:'0x907D0cCc4e0Fa0EbDa7a0BDbFae592027607c22B',
      usdc: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d',
      fees: '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
      destination: '0x4EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
      decimal: 6
    },
    ccipNames: {
      sourceName: 'ethereum-testnet-sepolia-arbitrum-1',
      destName: 'ethereum-testnet-sepolia'
    },
    sourceDomain: 3
  },
  'op-sepolia': {
    name: 'Optimism Sepolia',
    chainId: 11155420,
    rpcUrl: 'https://optimism-sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
    explorer: 'https://sepolia-optimism.etherscan.io',
    contracts: {
      ccip: '0x0000000000000000000000000000000000000000',
      usdc: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
      fees: '0x0000000000000000000000000000000000000000',
      cctp:'0x459922d991923FcA7948dbee715C8dEBeF53948d',
      destination: '0x4EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
      decimal: 6
    },
    ccipNames: {
      sourceName: 'op_sepolia',
      destName: 'sepolia'
    },
    sourceDomain: 2
  },
  'polygon-amoy': {
    name: 'Polygon Amoy',
    chainId: 80002,
    rpcUrl: 'https://polygon-amoy.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
    explorer: 'https://www.oklink.com/amoy',
    contracts: {
     ccip: '0x0000000000000000000000000000000000000000',
      usdc: '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582',
      fees: '0x0000000000000000000000000000000000000000',
      cctp:'0x47ca18a5d1B79Bca11a3f41cD528c660299984d5',
      destination: '0x4EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
      decimal: 6
    },
    ccipNames: {
      sourceName: 'polygon-testnet-amoy',
      destName: 'ethereum-testnet-sepolia'
    },
    sourceDomain: 7
  },

};