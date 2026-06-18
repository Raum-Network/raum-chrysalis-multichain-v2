use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("3MZSFAUSTpkuQtoAWW1nB51jnXk2BzbBJoiuNa6tr67P");

pub const SOLANA_DEVNET_USDC: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const SOLANA_DEVNET_LINK: Pubkey = pubkey!("LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L");
pub const SOLANA_DEVNET_WSOL: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
pub const CCTP_TOKEN_MESSENGER_MINTER_V2: Pubkey = pubkey!("CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe");
pub const CCTP_MESSAGE_TRANSMITTER_V2: Pubkey = pubkey!("CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC");
pub const CCIP_ROUTER: Pubkey = pubkey!("Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C");
pub const CCIP_CHAIN_SELECTOR_SOLANA_DEVNET: u64 = 16_423_721_717_087_811_551;

#[program]
pub mod chrysalis_solana_sender {
    use super::*;

    /// CCTP wrapper like EVM `depositForBurnWithCaller`.
    ///
    /// Caller/client must pass Circle TokenMessengerMinterV2 accounts as remaining accounts,
    /// in exact order expected by Circle instruction.
    pub fn deposit_for_burn_with_caller(
        ctx: Context<DepositForBurnWithCaller>,
        amount: u64,
        destination_domain: u32,
        mint_recipient: Pubkey,
        destination_caller: Pubkey,
        max_fee: u64,
        min_finality_threshold: u32,
        circle_ix_data: Vec<u8>,
    ) -> Result<()> {
        require!(amount > 0, ChrysalisError::InvalidAmount);
        require_keys_eq!(ctx.accounts.usdc_mint.key(), SOLANA_DEVNET_USDC, ChrysalisError::InvalidUsdcMint);

        let metas = ctx
            .remaining_accounts
            .iter()
            .map(|account| AccountMeta {
                pubkey: account.key(),
                is_signer: account.is_signer,
                is_writable: account.is_writable,
            })
            .collect::<Vec<_>>();

        let ix = Instruction {
            program_id: CCTP_TOKEN_MESSENGER_MINTER_V2,
            accounts: metas,
            data: circle_ix_data,
        };

        invoke(&ix, ctx.remaining_accounts)?;

        emit!(CctpBurnRequested {
            sender: ctx.accounts.sender.key(),
            amount,
            destination_domain,
            mint_recipient,
            burn_token: ctx.accounts.usdc_mint.key(),
            destination_caller,
            max_fee,
            min_finality_threshold,
        });

        Ok(())
    }

    /// CCIP wrapper like EVM `handleStakingAction`.
    ///
    /// Caller/client must pre-build Chainlink CCIP Router instruction data and accounts.
    /// This keeps program stable while CCIP SVM account layout evolves.
    pub fn handle_staking_action_ccip(
        ctx: Context<HandleStakingActionCcip>,
        destination_chain_selector: u64,
        receiver: Vec<u8>,
        amount: u64,
        gas_limit: u64,
        fee_token: Pubkey,
        router_ix_data: Vec<u8>,
    ) -> Result<()> {
        require!(amount > 0, ChrysalisError::InvalidAmount);
        require!(
            fee_token == SOLANA_DEVNET_LINK || fee_token == SOLANA_DEVNET_WSOL,
            ChrysalisError::InvalidFeeToken
        );
        require_keys_eq!(ctx.accounts.usdc_mint.key(), SOLANA_DEVNET_USDC, ChrysalisError::InvalidUsdcMint);

        let metas = ctx
            .remaining_accounts
            .iter()
            .map(|account| AccountMeta {
                pubkey: account.key(),
                is_signer: account.is_signer,
                is_writable: account.is_writable,
            })
            .collect::<Vec<_>>();

        let ix = Instruction {
            program_id: CCIP_ROUTER,
            accounts: metas,
            data: router_ix_data,
        };

        invoke(&ix, ctx.remaining_accounts)?;

        emit!(CcipStakingAction {
            sender: ctx.accounts.sender.key(),
            destination_chain_selector,
            receiver,
            amount,
            gas_limit,
            fee_token,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct DepositForBurnWithCaller<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = sender_usdc.owner == sender.key(),
        constraint = sender_usdc.mint == usdc_mint.key()
    )]
    pub sender_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct HandleStakingActionCcip<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = sender_usdc.owner == sender.key(),
        constraint = sender_usdc.mint == usdc_mint.key()
    )]
    pub sender_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[event]
pub struct CctpBurnRequested {
    pub sender: Pubkey,
    pub amount: u64,
    pub destination_domain: u32,
    pub mint_recipient: Pubkey,
    pub burn_token: Pubkey,
    pub destination_caller: Pubkey,
    pub max_fee: u64,
    pub min_finality_threshold: u32,
}

#[event]
pub struct CcipStakingAction {
    pub sender: Pubkey,
    pub destination_chain_selector: u64,
    pub receiver: Vec<u8>,
    pub amount: u64,
    pub gas_limit: u64,
    pub fee_token: Pubkey,
}

#[error_code]
pub enum ChrysalisError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Invalid USDC mint")]
    InvalidUsdcMint,
    #[msg("Invalid fee token")]
    InvalidFeeToken,
}
