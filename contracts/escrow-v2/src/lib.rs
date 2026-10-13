//! MicoPay escrow v2: holds a booking payment until the stay happens.
//!
//! Money in a booking can only ever go to three places: the guest (`payer`), the host
//! (`beneficiary`) or the platform wallet (`fee`). The arbiter decides disputes but cannot
//! send funds anywhere else, and every path that pays out sums exactly to what was locked.
//!
//! Timeline (ledger timestamps, seconds):
//!
//! ```text
//! lock ──── check_in ─────────────── deadline ──────────── deadline + arbiter_window
//!  │ cancel (policy refund)  │ release / dispute │ settle_default        │ settle_default
//!  │ host_cancel (full refund, any time while Locked)                     │ (also if Disputed)
//! ```
#![no_std]

mod errors;
mod types;

pub use errors::EscrowError;
pub use types::{Booking, Config, DataKey, Status, Tier};

use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, BytesN, Env, Vec};

const BPS: i128 = 10_000;
const MAX_TIERS: u32 = 8;
const INSTANCE_TTL_MIN: u32 = 17_280; // ~1 day
const INSTANCE_TTL_EXTEND: u32 = 518_400; // ~30 days

#[contract]
pub struct EscrowV2;

fn config(env: &Env) -> Result<Config, EscrowError> {
    env.storage().instance().get(&DataKey::Config).ok_or(EscrowError::NotInitialized)
}

fn load(env: &Env, id: &BytesN<32>) -> Result<Booking, EscrowError> {
    env.storage().persistent().get(&DataKey::Booking(id.clone())).ok_or(EscrowError::BookingNotFound)
}

/// Bookings can be made months ahead, so they always get the longest TTL the network allows.
fn save(env: &Env, id: &BytesN<32>, b: &Booking) {
    let key = DataKey::Booking(id.clone());
    env.storage().persistent().set(&key, b);
    let max = env.storage().max_ttl();
    env.storage().persistent().extend_ttl(&key, max / 2, max);
    env.storage().instance().extend_ttl(INSTANCE_TTL_MIN, INSTANCE_TTL_EXTEND);
}

fn pay(env: &Env, cfg: &Config, to: &Address, amount: i128) {
    if amount > 0 {
        token::Client::new(env, &cfg.token).transfer(&env.current_contract_address(), to, &amount);
    }
}

/// Normal outcome of a stay: host gets the price, platform its fee, guest the deposit back.
fn payout_stay(env: &Env, cfg: &Config, b: &Booking) {
    pay(env, cfg, &b.beneficiary, b.amount);
    pay(env, cfg, &cfg.platform_wallet, b.fee);
    pay(env, cfg, &b.payer, b.deposit);
}

/// Refund share for a cancellation made `secs_before` seconds before check-in.
/// Tiers are sorted by `min_secs_before` descending; the first one that applies wins.
fn refund_bps(policy: &Vec<Tier>, secs_before: u64) -> u32 {
    for t in policy.iter() {
        if secs_before >= t.min_secs_before {
            return t.refund_bps;
        }
    }
    0
}

#[contractimpl]
impl EscrowV2 {
    /// One-time setup: token held in escrow, platform wallet for fees, arbiter for disputes,
    /// and how long the arbiter has to decide a dispute after the booking deadline.
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        platform_wallet: Address,
        arbiter: Address,
        arbiter_window_secs: u64,
    ) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(EscrowError::AlreadyInitialized);
        }
        admin.require_auth();
        let cfg = Config { admin, token, platform_wallet, arbiter, arbiter_window_secs };
        env.storage().instance().set(&DataKey::Config, &cfg);
        env.storage().instance().extend_ttl(INSTANCE_TTL_MIN, INSTANCE_TTL_EXTEND);
        Ok(())
    }

    /// Guest pays `amount + fee + deposit` into escrow for booking `id`.
    /// `id` is chosen by the platform (hash of the booking); it can never be reused.
    #[allow(clippy::too_many_arguments)]
    pub fn lock(
        env: Env,
        id: BytesN<32>,
        payer: Address,
        beneficiary: Address,
        amount: i128,
        fee: i128,
        deposit: i128,
        check_in: u64,
        deadline: u64,
        policy: Vec<Tier>,
    ) -> Result<(), EscrowError> {
        payer.require_auth();
        let cfg = config(&env)?;
        if env.storage().persistent().has(&DataKey::Booking(id.clone())) {
            return Err(EscrowError::BookingExists);
        }
        if amount <= 0 || fee < 0 || deposit < 0 {
            return Err(EscrowError::InvalidAmount);
        }
        if payer == beneficiary {
            return Err(EscrowError::InvalidParties);
        }
        let now = env.ledger().timestamp();
        if check_in <= now || deadline <= check_in {
            return Err(EscrowError::InvalidDates);
        }
        if policy.len() > MAX_TIERS {
            return Err(EscrowError::InvalidPolicy);
        }
        let mut prev: Option<Tier> = None;
        for t in policy.iter() {
            if t.refund_bps as i128 > BPS {
                return Err(EscrowError::InvalidPolicy);
            }
            if let Some(p) = prev {
                // Earlier cancellation never refunds less than a later one.
                if t.min_secs_before >= p.min_secs_before || t.refund_bps > p.refund_bps {
                    return Err(EscrowError::InvalidPolicy);
                }
            }
            prev = Some(t);
        }

        let total = amount.checked_add(fee).and_then(|v| v.checked_add(deposit)).ok_or(EscrowError::InvalidAmount)?;
        token::Client::new(&env, &cfg.token).transfer(&payer, &env.current_contract_address(), &total);

        let b = Booking { payer: payer.clone(), beneficiary: beneficiary.clone(), amount, fee, deposit, check_in, deadline, policy, status: Status::Locked };
        save(&env, &id, &b);
        env.events().publish((symbol_short!("locked"), id), (payer, beneficiary, total, check_in, deadline));
        Ok(())
    }

    /// Guest cancels before check-in. The policy decides which share of `amount + fee`
    /// comes back; the rest is split between host and platform in proportion. The deposit
    /// always comes back. Returns what the guest received.
    pub fn cancel(env: Env, id: BytesN<32>) -> Result<i128, EscrowError> {
        let cfg = config(&env)?;
        let mut b = load(&env, &id)?;
        if b.status != Status::Locked {
            return Err(EscrowError::NotLocked);
        }
        b.payer.require_auth();
        let now = env.ledger().timestamp();
        if now >= b.check_in {
            return Err(EscrowError::TooLate);
        }
        let bps = refund_bps(&b.policy, b.check_in - now) as i128;
        let base = b.amount + b.fee;
        let refund = base * bps / BPS;
        let kept = base - refund;
        let to_platform = if base == 0 { 0 } else { kept * b.fee / base };
        let to_host = kept - to_platform;

        pay(&env, &cfg, &b.payer, refund + b.deposit);
        pay(&env, &cfg, &b.beneficiary, to_host);
        pay(&env, &cfg, &cfg.platform_wallet, to_platform);
        b.status = Status::Cancelled;
        save(&env, &id, &b);
        env.events().publish((symbol_short!("cancel"), id), (refund + b.deposit, to_host, to_platform));
        Ok(refund + b.deposit)
    }

    /// Host cancels: the guest gets everything back, at any moment before payout.
    pub fn host_cancel(env: Env, id: BytesN<32>) -> Result<(), EscrowError> {
        let cfg = config(&env)?;
        let mut b = load(&env, &id)?;
        if b.status != Status::Locked {
            return Err(EscrowError::NotLocked);
        }
        b.beneficiary.require_auth();
        pay(&env, &cfg, &b.payer, b.amount + b.fee + b.deposit);
        b.status = Status::Cancelled;
        save(&env, &id, &b);
        env.events().publish((symbol_short!("hcancel"), id), b.amount + b.fee + b.deposit);
        Ok(())
    }

    /// After check-in, the guest (stay was fine) or the arbiter releases the booking.
    pub fn release(env: Env, id: BytesN<32>, by: Address) -> Result<(), EscrowError> {
        let cfg = config(&env)?;
        let mut b = load(&env, &id)?;
        if b.status != Status::Locked {
            return Err(EscrowError::NotLocked);
        }
        if by != b.payer && by != cfg.arbiter {
            return Err(EscrowError::Unauthorized);
        }
        by.require_auth();
        if env.ledger().timestamp() < b.check_in {
            return Err(EscrowError::TooEarly);
        }
        payout_stay(&env, &cfg, &b);
        b.status = Status::Released;
        save(&env, &id, &b);
        env.events().publish((symbol_short!("released"), id), by);
        Ok(())
    }

    /// Guest opens a dispute between check-in and the deadline (damage, not as described…).
    /// It stops the default payout until the arbiter resolves it.
    pub fn dispute(env: Env, id: BytesN<32>) -> Result<(), EscrowError> {
        let mut b = load(&env, &id)?;
        if b.status != Status::Locked {
            return Err(EscrowError::NotLocked);
        }
        b.payer.require_auth();
        let now = env.ledger().timestamp();
        if now < b.check_in {
            return Err(EscrowError::TooEarly);
        }
        if now >= b.deadline {
            return Err(EscrowError::TooLate);
        }
        b.status = Status::Disputed;
        save(&env, &id, &b);
        env.events().publish((symbol_short!("dispute"), id), ());
        Ok(())
    }

    /// Host claims part of the deposit for damage; same effect as a guest dispute.
    pub fn claim_damage(env: Env, id: BytesN<32>) -> Result<(), EscrowError> {
        let mut b = load(&env, &id)?;
        if b.status != Status::Locked {
            return Err(EscrowError::NotLocked);
        }
        b.beneficiary.require_auth();
        let now = env.ledger().timestamp();
        if now < b.check_in {
            return Err(EscrowError::TooEarly);
        }
        if now >= b.deadline {
            return Err(EscrowError::TooLate);
        }
        b.status = Status::Disputed;
        save(&env, &id, &b);
        env.events().publish((symbol_short!("damage"), id), ());
        Ok(())
    }

    /// Arbiter splits a disputed booking. The three parts must add up to everything locked,
    /// and the platform can never take more than its original fee.
    pub fn resolve(env: Env, id: BytesN<32>, to_payer: i128, to_beneficiary: i128, to_platform: i128) -> Result<(), EscrowError> {
        let cfg = config(&env)?;
        cfg.arbiter.require_auth();
        let mut b = load(&env, &id)?;
        if b.status != Status::Disputed {
            return Err(EscrowError::NotDisputed);
        }
        if to_payer < 0 || to_beneficiary < 0 || to_platform < 0 || to_platform > b.fee {
            return Err(EscrowError::InvalidSplit);
        }
        if to_payer + to_beneficiary + to_platform != b.amount + b.fee + b.deposit {
            return Err(EscrowError::InvalidSplit);
        }
        pay(&env, &cfg, &b.payer, to_payer);
        pay(&env, &cfg, &b.beneficiary, to_beneficiary);
        pay(&env, &cfg, &cfg.platform_wallet, to_platform);
        b.status = Status::Resolved;
        save(&env, &id, &b);
        env.events().publish((symbol_short!("resolved"), id), (to_payer, to_beneficiary, to_platform));
        Ok(())
    }

    /// Anyone can finish a booking nobody acted on: after the deadline the host is paid and
    /// the deposit goes back. A disputed booking gets the same outcome only if the arbiter
    /// did not decide within its window, so funds are never stuck.
    pub fn settle_default(env: Env, id: BytesN<32>) -> Result<(), EscrowError> {
        let cfg = config(&env)?;
        let mut b = load(&env, &id)?;
        let now = env.ledger().timestamp();
        match b.status {
            Status::Locked if now >= b.deadline => {}
            Status::Disputed if now >= b.deadline.saturating_add(cfg.arbiter_window_secs) => {}
            Status::Locked | Status::Disputed => return Err(EscrowError::TooEarly),
            _ => return Err(EscrowError::NotLocked),
        }
        payout_stay(&env, &cfg, &b);
        b.status = Status::Released;
        save(&env, &id, &b);
        env.events().publish((symbol_short!("default"), id), ());
        Ok(())
    }

    /// Keeps a far-future booking alive; anyone can call it.
    pub fn bump(env: Env, id: BytesN<32>) -> Result<(), EscrowError> {
        let b = load(&env, &id)?;
        save(&env, &id, &b);
        Ok(())
    }

    pub fn get_booking(env: Env, id: BytesN<32>) -> Result<Booking, EscrowError> {
        load(&env, &id)
    }

    pub fn get_config(env: Env) -> Result<Config, EscrowError> {
        config(&env)
    }

    /// Admin can hand arbitration to another account (e.g. a multisig). Funds rules don't change.
    pub fn set_arbiter(env: Env, arbiter: Address) -> Result<(), EscrowError> {
        let mut cfg = config(&env)?;
        cfg.admin.require_auth();
        cfg.arbiter = arbiter;
        env.storage().instance().set(&DataKey::Config, &cfg);
        Ok(())
    }
}

#[cfg(test)]
mod test;
