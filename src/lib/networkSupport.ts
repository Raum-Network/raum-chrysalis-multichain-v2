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

export const getTxExplorerUrl = (
  txHash: string,
  networkName: string,
  protocol?: BridgeProtocol | string
): string => {
  if (!txHash) return '#';
  if (protocol === 'Axelar ITS') {
    return `https://testnet.axelarscan.io/gmp/${txHash}`;
  }

  const network = Object.values(SUPPORTED_NETWORKS).find(
    (candidate) => candidate.name.toLowerCase() === networkName.toLowerCase()
  );

  if (!network) {
    return `https://sepolia.arbiscan.io/tx/${txHash}`;
  }

  return `${network.explorer.replace(/\/+$/, '')}/tx/${txHash}`;
};
