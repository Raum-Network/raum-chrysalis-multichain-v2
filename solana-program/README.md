# Chrysalis Solana Sender

Anchor wrapper for Solana Devnet source routes.

Program id: `3MZSFAUSTpkuQtoAWW1nB51jnXk2BzbBJoiuNa6tr67P`

## Devnet constants

- USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- LINK fee token: `LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L`
- WSOL: `So11111111111111111111111111111111111111112`
- CCTP V2 TokenMessengerMinter: `CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe`
- CCTP V2 MessageTransmitter: `CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC`
- CCIP Router: `Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C`
- Solana Devnet CCIP selector: `16423721717087811551`

## Deploy

```bash
cd solana-program
anchor build --no-idl
anchor deploy --provider.cluster devnet
```

Program keypair:

```text
target/deploy/chrysalis_solana_sender-keypair.json
```

Do not commit this keypair.

## Shape

- `deposit_for_burn_with_caller`: validates devnet USDC, CPI-calls Circle `TokenMessengerMinterV2`, emits `CctpBurnRequested`.
- `handle_staking_action_ccip`: validates devnet USDC plus LINK/WSOL fee token, CPI-calls Chainlink CCIP router, emits `CcipStakingAction`.

Client must build and pass Circle/CCIP instruction bytes plus required remaining accounts. This keeps Chrysalis program stable while Circle/Chainlink account layouts change.
