import { BridgeProtocol, NetworkConfig, SUPPORTED_NETWORKS } from '../config/contract';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export const normalizeEvmAddress = (value?: string | null): `0x${string}` => {
  if (!value) return ZERO_ADDRESS;
  const trimmed = value.trim();
  if (!trimmed) return ZERO_ADDRESS;
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`;
};

export const isZeroAddress = (value?: string | null): boolean => {
  return normalizeEvmAddress(value).toLowerCase() === ZERO_ADDRESS;
};

export const isProtocolSupported = (networkConfig: NetworkConfig, protocol: BridgeProtocol): boolean => {
  return networkConfig.supportedProtocols.includes(protocol);
};

const ETHEREUM_SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

const normalizeNetworkName = (value: string) =>
  value.trim().toLowerCase().replace(/[_\s]+/g, '-');

const isEthereumSepoliaName = (networkName: string) => {
  const normalized = normalizeNetworkName(networkName);
  return normalized === 'sepolia' ||
    normalized === 'ethereum-sepolia' ||
    normalized === 'ethereum-testnet-sepolia';
};

export const getTxExplorerUrl = (
  txHash: string,
  networkName: string,
  protocol?: BridgeProtocol | string
): string => {
  if (!txHash) return '#';
  if (protocol === 'Axelar ITS') {
    return `https://testnet.axelarscan.io/gmp/${txHash}`;
  }

  if (isEthereumSepoliaName(networkName)) {
    return `${ETHEREUM_SEPOLIA_EXPLORER}/tx/${txHash}`;
  }

  const normalizedNetworkName = normalizeNetworkName(networkName);
  const network = Object.values(SUPPORTED_NETWORKS).find(
    (candidate) =>
      normalizeNetworkName(candidate.name) === normalizedNetworkName ||
      normalizeNetworkName(candidate.ccipNames.sourceName) === normalizedNetworkName ||
      normalizeNetworkName(candidate.ccipNames.destName) === normalizedNetworkName
  );

  if (!network) {
    return `${ETHEREUM_SEPOLIA_EXPLORER}/tx/${txHash}`;
  }

  if (network.chainFamily === 'solana') {
    const cluster = network.solana?.cluster || 'devnet';
    return `${network.explorer.replace(/\/+$/, '')}/tx/${txHash}?cluster=${cluster}`;
  }

  return `${network.explorer.replace(/\/+$/, '')}/tx/${txHash}`;
};
