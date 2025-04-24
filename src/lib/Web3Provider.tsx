"use client";

import Web3 from 'web3';
import { WagmiProvider, createConfig, http } from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [polygonAmoy],
    transports: {
      // RPC URL for each chain
      [polygonAmoy.id]: http(
        `https://polygon-amoy.drpc.org`,
      ),
    },

    // Required API Keys
    walletConnectProjectId: "ffd25e3cc20b883d266134ce525caf88",

    // Required App Info
    appName: "Chrysalis - SteadyStake",

    // Optional App Info
    appUrl: "https://steadystake.chrysalis.raum.network", // your app's url
    appIcon: "https://family.co/logo.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
);

const queryClient = new QueryClient();

const USDC_CONTRACT_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"; // Polygon Amoy USDC
const USDC_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];


import { ReactNode } from 'react';

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
