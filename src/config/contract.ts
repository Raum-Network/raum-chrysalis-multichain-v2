export type NetworkConfig = {
  name: string;
  chainFamily?: 'evm' | 'xrpl' | 'solana';
  chainId: number;
  rpcUrl: string;
  wssUrl?: string;
  publicRpc: string;
  explorer: string;
  supportedProtocols: BridgeProtocol[];
  assetSymbol: 'USDC' | 'XRP';
  destinationDomain?: number;
  sourceDomainId?: number;
  contracts: {
    ccip: string;
    usdc: string;
    fees: string;
    destination?: string;
    cctp?: string;
    decimal?: number;
    cctpDestinationCaller?: string;
  };
  solana?: {
    cluster: 'devnet' | 'testnet' | 'mainnet-beta';
    usdcMint: string;
    cctpV2: {
      messageTransmitter: string;
      tokenMessengerMinter: string;
    };
    cctpV1?: {
      messageTransmitter: string;
      tokenMessengerMinter: string;
    };
    ccip: {
      router: string;
      chainSelector: string;
      rmn: string;
      feeQuoter: string;
      burnMintPoolProgram: string;
      lockReleasePoolProgram: string;
      linkToken: string;
      wsolToken: string;
    };
  };
  icon?: string;
  ccipNames: {
    sourceName: string;
    destName: string;
  };
};

export type BridgeProtocol = 'CCIP' | 'CCTP' | 'Axelar ITS';

export type Networks =
  | 'arbitrum-sepolia'
  | 'base-sepolia'
  | 'lisk-sepolia'
  | 'plume-testnet'
  | 'arc-testnet'
  | 'solana-devnet'
  | 'ripple-testnet';

export const SUPPORTED_NETWORKS: Record<Networks, NetworkConfig> = {
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    supportedProtocols: ['CCIP', 'CCTP'],
    assetSymbol: 'USDC',
    destinationDomain: 0,
    sourceDomainId: 3,
    publicRpc: "https://sepolia-rollup.arbitrum.io/rpc",
    rpcUrl: 'https://arbitrum-sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
    explorer: 'https://sepolia.arbiscan.io',
    contracts: {
      ccip: '0x01851b172b1b0a5709deec827a88732dba00c467',
      cctp: '0x907D0cCc4e0Fa0EbDa7a0BDbFae592027607c22B',
      cctpDestinationCaller: '0267Cf87951fB8e6BE909025cCC67f8DDE991eA7',
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
    supportedProtocols: ['CCIP'],
    assetSymbol: 'USDC',
    rpcUrl: 'https://sepolia.base.org',
    publicRpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    contracts: {
      ccip: '0x45057d6CC1608C7E3B13570A29078848A8794D9e',
      usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      fees: '0xE4aB69C077896252FAFBD49EFD26B5D171A32410',
      cctp: '0x0000000000000000000000000000000000000000',
      cctpDestinationCaller: '0000000000000000000000000000000000000000',
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
    supportedProtocols: ['CCIP'],
    assetSymbol: 'USDC',
    rpcUrl: 'https://lisk-sepolia.drpc.org/',
    publicRpc: 'https://lisk-sepolia.drpc.org/',
    explorer: 'https://sepolia-blockscout.lisk.com/',
    contracts: {
      ccip: '0x459922d991923FcA7948dbee715C8dEBeF53948d',
      usdc: '0x043052cf7cf2a9679d9563d951a73856d5e5b4c4',
      fees: '0x6641415a61bCe80D97a715054d1334360Ab833Eb',
      cctp: '0x0000000000000000000000000000000000000000',
      cctpDestinationCaller: '0000000000000000000000000000000000000000',
      destination: '0x185915e86a5dd567fc8d381914503cb517e51317',
      decimal: 18
    },
    ccipNames: {
      sourceName: 'ethereum-testnet-sepolia-lisk-1',
      destName: 'ethereum-testnet-sepolia'
    }
  },
  'plume-testnet': {
    name: 'Plume Testnet',
    chainId: 98867,
    supportedProtocols: ['CCIP'],
    assetSymbol: 'USDC',
    rpcUrl: 'https://testnet-rpc.plume.org',
    publicRpc: 'https://testnet-rpc.plume.org',
    explorer: 'https://testnet-explorer.plume.org',
    contracts: {
      ccip: '0xAe8cbEBA91FD9DE3aa15530AF2b768DAd75f039D',
      usdc: '0xCCF0AD40cc0a328e46d061b11Ee1EDCC7278D2f3',
      fees: '0xB97e3665AEAF96BDD6b300B2e0C93C662104A068',
      cctp: '0x0000000000000000000000000000000000000000',
      cctpDestinationCaller: '0000000000000000000000000000000000000000',
      destination: '0x11467A1595c300BB182f2ce832DcEE1F61797e62',
      decimal: 18
    },
    ccipNames: {
      sourceName: 'plume-testnet-sepolia',
      destName: 'ethereum-testnet-sepolia'
    }
  },
  'arc-testnet': {
    name: 'Arc Testnet',
    chainId: 5042002,
    supportedProtocols: ['CCTP'],
    assetSymbol: 'USDC',
    destinationDomain: 0,
    sourceDomainId: 26,
    rpcUrl: 'https://arc-testnet.g.alchemy.com/v2/rhTXLao3kvghbdRHQrcvM',
    publicRpc: 'https://arc-testnet.g.alchemy.com/v2/rhTXLao3kvghbdRHQrcvM',
    explorer: 'https://testnet.arcscan.app',
    contracts: {
      ccip: '0x0000000000000000000000000000000000000000',
      usdc: '0x3600000000000000000000000000000000000000',
      fees: '0x0000000000000000000000000000000000000000',
      cctp: '0x459922d991923FcA7948dbee715C8dEBeF53948d',
      cctpDestinationCaller: '0x50fDEE816a0eD2736AceB493D8Dae337835C65C8',
      destination: '0x50fDEE816a0eD2736AceB493D8Dae337835C65C8',
      decimal: 6
    },
    ccipNames: {
      sourceName: 'arc_testnet',
      destName: 'sepolia'
    }
  },
  // 'op-sepolia': {
  //   name: 'Optimism Sepolia',
  //   chainId: 11155420,
  //   supportedProtocols: ['CCTP'],
  //   assetSymbol: 'USDC',
  //   destinationDomain: 0,
  //   sourceDomainId: 2,
  //   rpcUrl: 'https://optimism-sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
  //   publicRpc: 'https://optimism-sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
  //   explorer: 'https://sepolia-optimism.etherscan.io',
  //   contracts: {
  //     ccip: '0x0000000000000000000000000000000000000000',
  //     usdc: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  //     fees: '0x0000000000000000000000000000000000000000',
  //     cctp: '0x459922d991923FcA7948dbee715C8dEBeF53948d',
  //     cctpDestinationCaller: '0x4EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
  //     destination: '0x4EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
  //     decimal: 6
  //   },
  //   ccipNames: {
  //     sourceName: 'op_sepolia',
  //     destName: 'sepolia'
  //   }
  // },
  // 'polygon-amoy': {
  //   name: 'Polygon Amoy',
  //   chainId: 80002,
  //   supportedProtocols: ['CCTP'],
  //   assetSymbol: 'USDC',
  //   destinationDomain: 0,
  //   sourceDomainId: 7,
  //   rpcUrl: 'https://polygon-amoy.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
  //   publicRpc: 'https://polygon-amoy.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
  //   explorer: 'https://www.oklink.com/amoy',
  //   contracts: {
  //     ccip: '0x0000000000000000000000000000000000000000',
  //     usdc: '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582',
  //     fees: '0x0000000000000000000000000000000000000000',
  //     cctp: '0x47ca18a5d1B79Bca11a3f41cD528c660299984d5',
  //     cctpDestinationCaller: '0x4EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
  //     destination: '0x4EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
  //     decimal: 6
  //   },
  //   ccipNames: {
  //     sourceName: 'polygon-testnet-amoy',
  //     destName: 'ethereum-testnet-sepolia'
  //   }
  // },
  'ripple-testnet': {
    name: 'Ripple Testnet',
    chainFamily: 'xrpl',
    chainId: 0,
    supportedProtocols: ['Axelar ITS'],
    assetSymbol: 'XRP',
    rpcUrl: 'https://s.altnet.rippletest.net:51234',
    wssUrl: 'wss://s.altnet.rippletest.net:51233',
    publicRpc: 'https://s.altnet.rippletest.net:51234',
    explorer: 'https://xrpscan.com/testnet',
    contracts: {
      ccip: '',
      usdc: '',
      fees: '',
      cctp: '',
      cctpDestinationCaller: '0xfA2B78FD59E3E86425e7Bee5768fA5e7FA41D18c',
      destination: 'rNrjh1KGZk2jBR3wPfAQnoidtFFYQKbQn2',
      decimal: 6
    },
    ccipNames: {
      sourceName: '',
      destName: ''
    }
  },
  'solana-devnet': {
    name: 'Solana Devnet',
    chainFamily: 'solana',
    chainId: 901,
    supportedProtocols: ['CCTP'],
    assetSymbol: 'USDC',
    destinationDomain: 0,
    sourceDomainId: 5,
    rpcUrl: 'https://solana-devnet.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
    publicRpc: 'https://solana-devnet.infura.io/v3/cea2942c462d447983f9f20783cd2f64',
    explorer: 'https://explorer.solana.com',
    contracts: {
      ccip: '3MZSFAUSTpkuQtoAWW1nB51jnXk2BzbBJoiuNa6tr67P',
      cctp: '3MZSFAUSTpkuQtoAWW1nB51jnXk2BzbBJoiuNa6tr67P',
      cctpDestinationCaller: '0xFCa4F35688cB2271122b0597260037127Feff708',
      usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      fees: 'LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L',
      destination: '0xFCa4F35688cB2271122b0597260037127Feff708',
      decimal: 6
    },
    solana: {
      cluster: 'devnet',
      usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      cctpV2: {
        messageTransmitter: 'CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC',
        tokenMessengerMinter: 'CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe'
      },
      cctpV1: {
        messageTransmitter: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
        tokenMessengerMinter: 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3'
      },
      ccip: {
        router: 'Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C',
        chainSelector: '16423721717087811551',
        rmn: 'RmnXLft1mSEwDgMKu2okYuHkiazxntFFcZFrrcXxYg7',
        feeQuoter: 'FeeQPGkKDeRV1MgoYfMH6L8o3KeuYjwUZrgn4LRKfjHi',
        burnMintPoolProgram: '41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB',
        lockReleasePoolProgram: '8eqh8wppT9c5rw4ERqNCffvU6cNFJWff9WmkcYtmGiqC',
        linkToken: 'LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L',
        wsolToken: 'So11111111111111111111111111111111111111112'
      }
    },
    ccipNames: {
      sourceName: 'solana-devnet',
      destName: 'ethereum-testnet-sepolia'
    }
  },
};
