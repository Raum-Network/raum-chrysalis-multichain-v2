#Chrysalis

Chrysalis is a cross-chain liquid staking application built by Raum. It gives users a single interface to start a stake from multiple source networks, route the asset through different bridge protocols, track the transfer lifecycle, and view the resulting staking position on the destination side.

This repository contains:

- A Vite + React frontend for wallet connection, staking flows, dashboards, rewards, and transaction tracking
- Protocol-aware client logic for Chainlink CCIP, Circle CCTP, and Axelar ITS flows
- A lightweight transaction persistence layer backed by Vercel serverless functions and Upstash Redis
- An XRPL NFT minting service used to issue staking receipt NFTs for Ripple/Axelar-based flows

## What We Built

Chrysalis is designed as a multichain staking control surface rather than a single-network dApp.

From the user perspective, the app allows them to:

- Connect an EVM wallet through Wagmi + ConnectKit, or connect an XRPL wallet through Crossmark
- Choose a supported source network
- Deposit the supported asset for that network
- Route the transfer through the protocol(s) available on that network
- Monitor the cross-chain transaction until settlement
- View the resulting destination-side staking state
- For Ripple flows, receive staking receipts as XRPL NFTs

The current product supports multiple testnet-first routes and uses Ethereum Sepolia as the main destination context for settlement and staking state display.

## Supported Networks and Protocols

The supported networks are defined in [`src/config/contract.ts`](/Users/madhurverma/Documents/raum-chrysalis-multichain/src/config/contract.ts).

### Source networks

- Arbitrum Sepolia
- Base Sepolia
- Lisk Sepolia
- Plume Testnet
- Arc Testnet
- Ripple Testnet

### Bridge / messaging protocols

- `CCIP` for supported EVM routes
- `CCTP` for supported USDC routes
- `Axelar ITS` for Ripple/XRPL-based flows

### Asset model

- EVM routes use `USDC` as the source asset
- Ripple routes use `XRP` as the source asset
- The app presents the destination staking position in ETH/stETH terms depending on the flow

## Product Experience

### Home

The landing page introduces Chrysalis as a multi-protocol staking surface, shows the active network context, and exposes the primary entry points into the app.

### Stake

The stake page is the core workflow. It:

- Detects which protocols are available on the current network
- Lets the user choose between protocol routes where more than one is supported
- Checks balances and allowances
- Starts the staking flow
- Subscribes to live transaction status updates
- Displays explorer links and protocol-specific status states
- Pulls a reference APY feed for the staking UX

### Dashboard

The dashboard acts as the user’s position overview. It combines:

- Available wallet balance
- Destination-side staked balance
- Reference APR
- Network and protocol capability summaries
- XRPL staking receipt NFTs for Ripple-based positions

### Transactions

The transactions page is the operational history view. It merges data from several sources:

- Live in-memory staking status updates
- CCIP transaction history
- CCTP attestation / message status
- Persisted transaction records stored locally and optionally in Upstash Redis
- XRPL/Axelar-derived receipt activity for Ripple flows

### Rewards

The rewards page is currently a product-facing placeholder/demo surface. It presents sample reward, claim, and history UI, but it is not yet wired to a real rewards contract or live accounting backend.

## Architecture Overview

### Frontend stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- React Router
- Wagmi
- ConnectKit
- TanStack Query
- Zustand

### Wallet connectivity

Wallet logic lives primarily in [`src/lib/walletConnect.ts`](/Users/madhurverma/Documents/raum-chrysalis-multichain/src/lib/walletConnect.ts).

It supports:

- Standard EVM wallet connections through Wagmi/WalletConnect
- Custom network switching for supported EVM testnets
- XRPL wallet sessions through Crossmark for Ripple Testnet
- Balance handling for both EVM and XRPL wallets

### Network configuration

[`src/config/contract.ts`](/Users/madhurverma/Documents/raum-chrysalis-multichain/src/config/contract.ts) is the main source of truth for:

- Supported chains
- Chain IDs
- RPC and explorer URLs
- Supported protocol matrix
- Token decimals
- Contract addresses used per route
- Destination-side addresses

### Staking orchestration

The main staking hook is [`src/hooks/useStaking.ts`](/Users/madhurverma/Documents/raum-chrysalis-multichain/src/hooks/useStaking.ts).

It is responsible for:

- Reading token balances and allowances
- Picking the correct contract path for the active protocol
- Starting cross-chain stake transactions
- Reacting to status updates from the stake manager
- Persisting transaction metadata
- Fetching XRPL NFT receipts and offers for Ripple flows

### Transaction persistence

Transaction persistence uses a layered approach:

- Local browser cache via `localStorage`
- Optional remote persistence via `/api/transactions`
- Upstash Redis as the remote storage backend when configured

Relevant files:

- [`src/services/transactionRepository.ts`](/Users/madhurverma/Documents/raum-chrysalis-multichain/src/services/transactionRepository.ts)
- [`api/transactions.js`](/Users/madhurverma/Documents/raum-chrysalis-multichain/api/transactions.js)

This makes the transaction view resilient even when remote storage is unavailable.

### XRPL staking receipt NFTs

Ripple/Axelar flows can mint staking receipt NFTs on XRPL. The NFT metadata encodes a compact staking receipt that includes:

- Staker address
- Amount
- Token symbol
- Pool / route name
- APY
- Stake timestamp
- Minted stETH amount
- A compact ID

Relevant files:

- [`server.js`](/Users/madhurverma/Documents/raum-chrysalis-multichain/server.js)
- [`mintNFT.js`](/Users/madhurverma/Documents/raum-chrysalis-multichain/mintNFT.js)
- [`stakingMetadata.js`](/Users/madhurverma/Documents/raum-chrysalis-multichain/stakingMetadata.js)

## Cross-Chain Flow at a Glance

At a high level, the app works like this:

1. The user connects a wallet and selects a supported source network.
2. The app derives which bridge protocols are valid for that network.
3. The user approves the relevant asset if needed.
4. The app initiates the route-specific stake transaction.
5. A protocol-specific status manager tracks bridging progress.
6. The destination-side staking state is fetched and surfaced in the dashboard.
7. The transaction page aggregates status from protocol APIs and local/remote persistence.
8. For Ripple flows, an XRPL NFT receipt is minted and later displayed in the UI.

## External Integrations

The app relies on several external services and protocol APIs:

- Chainlink CCIP explorer/API
- Circle Iris Sandbox API for CCTP attestations and messages
- Lido-style APR feed used as a reference APY input in the UX
- XRPL node access for Ripple flows and NFT minting
- Upstash Redis for persisted transaction history

Vercel rewrites in [`vercel.json`](/Users/madhurverma/Documents/raum-chrysalis-multichain/vercel.json) proxy some of these services under local app paths such as:

- `/ccip-api/*`
- `/circle-api/*`
- `/api/*`

## Repository Structure

```text
.
├── api/                         # Vercel serverless functions
├── src/
│   ├── components/             # Shared UI building blocks
│   ├── config/                 # Network and contract configuration
│   ├── context/                # App-wide providers
│   ├── hooks/                  # Staking and transaction hooks
│   ├── lib/                    # Protocol helpers, contract logic, wallet helpers
│   ├── pages/                  # Route-level screens
│   ├── services/               # API clients and persistence utilities
│   ├── store/                  # Zustand stores
│   └── utils/                  # Storage and helper utilities
├── server.js                   # XRPL NFT minting API
├── mintNFT.js                  # XRPL mint + offer logic
├── stakingMetadata.js          # XRPL NFT receipt encoding/decoding
└── vercel.json                 # Rewrites for protocol APIs and SPA routing
```

## Local Development

### Prerequisites

- Node.js 18+ recommended
- npm
- Access to the wallets and networks you want to test
- Optional: XRPL minter credentials for NFT minting flows
- Optional: Upstash Redis credentials for remote transaction persistence

### Install dependencies

```bash
npm install
```

### Start the frontend

```bash
npm run dev
```

This starts the Vite development server.

### Build the frontend

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Start the XRPL minting backend

There is no npm script for the XRPL API yet, so start it directly:

```bash
node server.js
```

By default it runs on port `3000`.

## Environment Variables

This project uses a mix of frontend-safe configuration embedded in source files and backend runtime configuration provided through environment variables.

### XRPL minting backend

The XRPL NFT API reads the following variables in [`config.js`](/Users/madhurverma/Documents/raum-chrysalis-multichain/config.js):

- `XRPL_NODE`
- `MINTER_SEED`
- `MINTER_ADDRESS`
- `NFT_TAXON`
- `NFT_TRANSFER_FEE`

Example:

```env
XRPL_NODE=wss://s.altnet.rippletest.net:51233
MINTER_SEED=your_minter_seed
MINTER_ADDRESS=your_minter_address
NFT_TAXON=0
NFT_TRANSFER_FEE=0
```

### Transaction persistence backend

The serverless transaction API supports Upstash-compatible REST credentials:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

It also accepts:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `REDIS_URL`

If these are not set:

- The app still works
- Transaction history falls back to local browser storage
- Remote persistence is disabled

## Backend / API Endpoints

### Vercel function: persisted transactions

[`api/transactions.js`](/Users/madhurverma/Documents/raum-chrysalis-multichain/api/transactions.js)

- `GET /api/transactions?address=<wallet>`
  - Returns persisted transactions for a wallet
- `POST /api/transactions`
  - Upserts a transaction record

### XRPL minting API

[`server.js`](/Users/madhurverma/Documents/raum-chrysalis-multichain/server.js)

- `GET /health`
  - Basic health check
- `GET /reserve-nft-id`
  - Reserves the next NFT sequence and predicts the NFTokenID
- `POST /release-nft-id`
  - Releases a reserved sequence if minting does not proceed
- `POST /mint-staking-nft`
  - Mints a staking receipt NFT and creates a directed sell offer for the staker
- `POST /accept-offer`
  - Accepts an NFT sell offer in custodial mode
- `GET /nft/:nfTokenID`
  - Decodes and returns the NFT metadata

## Important Implementation Notes

- Network/protocol support is intentionally explicit. The UI only offers protocols listed for the active network.
- Some routes are testnet-only and some destination assumptions are Sepolia-specific.
- The rewards surface is currently mocked and should not be treated as production reward accounting.
- Transaction history is best-effort resilient: local cache first, remote sync when available.
- XRPL receipt metadata is compact because XRPL NFT URI payload size is limited.

## Known Gaps / Future Improvements

- Add npm scripts for running the XRPL backend locally
- Move hardcoded public config values into clearer environment-driven configuration
- Add automated tests for staking flows and transaction persistence
- Add real rewards accounting instead of placeholder data
- Document deployment environments and secret management more formally
- Split frontend and backend services more cleanly if the project grows

## Why This Repo Matters

This project demonstrates how a staking product can abstract over multiple bridge/messaging protocols while still keeping protocol-specific visibility for the user. Instead of hiding the routing layer completely, Chrysalis makes the route, status, and destination settlement context visible so users can understand how their stake moves across chains.

That is the core thing this repo built: a unified multichain staking UX over CCIP, CCTP, and XRPL/Axelar flows.
