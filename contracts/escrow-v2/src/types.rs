use soroban_sdk::{contracttype, Address, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Locked,
    Disputed,
    Released,
    Cancelled,
    Resolved,
}

/// Cancelling at least `min_secs_before` check-in refunds `refund_bps` / 10 000 of the price + fee.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tier {
    pub min_secs_before: u64,
    pub refund_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Booking {
    pub payer: Address,
    pub beneficiary: Address,
    pub amount: i128,
    pub fee: i128,
    pub deposit: i128,
    pub check_in: u64,
    pub deadline: u64,
    pub policy: Vec<Tier>,
    pub status: Status,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub token: Address,
    pub platform_wallet: Address,
    pub arbiter: Address,
    pub arbiter_window_secs: u64,
}

#[contracttype]
pub enum DataKey {
    Config,
    Booking(soroban_sdk::BytesN<32>),
}
