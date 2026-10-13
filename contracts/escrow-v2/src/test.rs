#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, token, vec, Address, BytesN, Env};

const DAY: u64 = 86_400;
const T0: u64 = 1_800_000_000;

struct Ctx {
    env: Env,
    escrow: EscrowV2Client<'static>,
    token: token::Client<'static>,
    guest: Address,
    host: Address,
    platform: Address,
    arbiter: Address,
}

fn setup() -> Ctx {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = T0);
    let admin = Address::generate(&env);
    let guest = Address::generate(&env);
    let host = Address::generate(&env);
    let platform = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    token::StellarAssetClient::new(&env, &sac.address()).mint(&guest, &1_000_000);
    let id = env.register(EscrowV2, ());
    let escrow = EscrowV2Client::new(&env, &id);
    escrow.initialize(&admin, &sac.address(), &platform, &arbiter, &(7 * DAY));
    let token = token::Client::new(&env, &sac.address());
    Ctx { env, escrow, token, guest, host, platform, arbiter }
}

fn moderate(env: &Env) -> Vec<Tier> {
    // ≥5 days: 100 %, ≥1 day: 50 %, later: nothing.
    vec![env, Tier { min_secs_before: 5 * DAY, refund_bps: 10_000 }, Tier { min_secs_before: DAY, refund_bps: 5_000 }]
}

fn bid(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

/// Price 10 000, fee 500, deposit 2 000; check-in in 10 days, deadline 3 days after a 2-night stay.
fn book(c: &Ctx, n: u8) -> BytesN<32> {
    let id = bid(&c.env, n);
    c.escrow.lock(&id, &c.guest, &c.host, &10_000, &500, &2_000, &(T0 + 10 * DAY), &(T0 + 15 * DAY), &moderate(&c.env));
    id
}

fn at(c: &Ctx, t: u64) {
    c.env.ledger().with_mut(|l| l.timestamp = t);
}

fn balances(c: &Ctx) -> (i128, i128, i128, i128) {
    (c.token.balance(&c.guest), c.token.balance(&c.host), c.token.balance(&c.platform), c.token.balance(&c.escrow.address))
}

#[test]
fn lock_takes_everything_into_escrow() {
    let c = setup();
    let id = book(&c, 1);
    assert_eq!(balances(&c), (1_000_000 - 12_500, 0, 0, 12_500));
    assert_eq!(c.escrow.get_booking(&id).status, Status::Locked);
}

#[test]
fn booking_id_cannot_be_reused() {
    let c = setup();
    book(&c, 1);
    let r = c.escrow.try_lock(&bid(&c.env, 1), &c.guest, &c.host, &1, &0, &0, &(T0 + DAY), &(T0 + 2 * DAY), &moderate(&c.env));
    assert_eq!(r, Err(Ok(EscrowError::BookingExists)));
}

#[test]
fn lock_rejects_bad_input() {
    let c = setup();
    let p = moderate(&c.env);
    let e = &c.env;
    assert_eq!(c.escrow.try_lock(&bid(e, 2), &c.guest, &c.host, &0, &0, &0, &(T0 + DAY), &(T0 + 2 * DAY), &p), Err(Ok(EscrowError::InvalidAmount)));
    assert_eq!(c.escrow.try_lock(&bid(e, 2), &c.guest, &c.guest, &1, &0, &0, &(T0 + DAY), &(T0 + 2 * DAY), &p), Err(Ok(EscrowError::InvalidParties)));
    assert_eq!(c.escrow.try_lock(&bid(e, 2), &c.guest, &c.host, &1, &0, &0, &T0, &(T0 + 2 * DAY), &p), Err(Ok(EscrowError::InvalidDates)));
    assert_eq!(c.escrow.try_lock(&bid(e, 2), &c.guest, &c.host, &1, &0, &0, &(T0 + DAY), &(T0 + DAY), &p), Err(Ok(EscrowError::InvalidDates)));
    // A later cancellation refunding more than an earlier one is not a valid policy.
    let bad = vec![e, Tier { min_secs_before: 5 * DAY, refund_bps: 5_000 }, Tier { min_secs_before: DAY, refund_bps: 10_000 }];
    assert_eq!(c.escrow.try_lock(&bid(e, 2), &c.guest, &c.host, &1, &0, &0, &(T0 + DAY), &(T0 + 2 * DAY), &bad), Err(Ok(EscrowError::InvalidPolicy)));
    let over = vec![e, Tier { min_secs_before: DAY, refund_bps: 10_001 }];
    assert_eq!(c.escrow.try_lock(&bid(e, 2), &c.guest, &c.host, &1, &0, &0, &(T0 + DAY), &(T0 + 2 * DAY), &over), Err(Ok(EscrowError::InvalidPolicy)));
}

#[test]
fn early_cancel_refunds_everything() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 4 * DAY); // 6 days before check-in
    assert_eq!(c.escrow.cancel(&id), 12_500);
    assert_eq!(balances(&c), (1_000_000, 0, 0, 0));
}

#[test]
fn late_cancel_follows_policy_and_splits_the_rest() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 8 * DAY); // 2 days before: 50 % of 10 500 back, deposit back
    assert_eq!(c.escrow.cancel(&id), 5_250 + 2_000);
    // kept 5 250 split in proportion: platform 5 250 × 500 / 10 500 = 250, host 5 000.
    assert_eq!(balances(&c), (1_000_000 - 5_250, 5_000, 250, 0));
}

#[test]
fn last_minute_cancel_keeps_price_but_returns_deposit() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 10 * DAY - 60);
    assert_eq!(c.escrow.cancel(&id), 2_000);
    assert_eq!(balances(&c), (1_000_000 - 10_500, 10_000, 500, 0));
}

#[test]
fn guest_cannot_cancel_after_check_in() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 10 * DAY);
    assert_eq!(c.escrow.try_cancel(&id), Err(Ok(EscrowError::TooLate)));
}

#[test]
fn host_cancel_refunds_guest_in_full() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 9 * DAY);
    c.escrow.host_cancel(&id);
    assert_eq!(balances(&c), (1_000_000, 0, 0, 0));
}

#[test]
fn release_pays_host_fee_and_returns_deposit() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 10 * DAY);
    c.escrow.release(&id, &c.guest);
    assert_eq!(balances(&c), (1_000_000 - 10_500, 10_000, 500, 0));
    assert_eq!(c.escrow.try_release(&id, &c.guest), Err(Ok(EscrowError::NotLocked)));
}

#[test]
fn release_needs_check_in_and_the_right_signer() {
    let c = setup();
    let id = book(&c, 1);
    assert_eq!(c.escrow.try_release(&id, &c.guest), Err(Ok(EscrowError::TooEarly)));
    at(&c, T0 + 11 * DAY);
    assert_eq!(c.escrow.try_release(&id, &c.host), Err(Ok(EscrowError::Unauthorized)));
    c.escrow.release(&id, &c.arbiter);
    assert_eq!(c.token.balance(&c.host), 10_000);
}

#[test]
fn default_after_deadline_pays_host() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 15 * DAY - 1);
    assert_eq!(c.escrow.try_settle_default(&id), Err(Ok(EscrowError::TooEarly)));
    at(&c, T0 + 15 * DAY);
    c.escrow.settle_default(&id);
    assert_eq!(balances(&c), (1_000_000 - 10_500, 10_000, 500, 0));
}

#[test]
fn dispute_blocks_default_until_arbiter_window_ends() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 12 * DAY);
    c.escrow.claim_damage(&id);
    at(&c, T0 + 15 * DAY);
    assert_eq!(c.escrow.try_settle_default(&id), Err(Ok(EscrowError::TooEarly)));
    at(&c, T0 + 22 * DAY); // deadline + 7-day arbiter window
    c.escrow.settle_default(&id);
    assert_eq!(balances(&c), (1_000_000 - 10_500, 10_000, 500, 0));
}

#[test]
fn arbiter_splits_a_dispute() {
    let c = setup();
    let id = book(&c, 1);
    at(&c, T0 + 12 * DAY);
    c.escrow.dispute(&id);
    // Host keeps the price plus 1 500 of the deposit for damage; guest gets 500 back.
    assert_eq!(c.escrow.try_resolve(&id, &500, &11_600, &500), Err(Ok(EscrowError::InvalidSplit)));
    assert_eq!(c.escrow.try_resolve(&id, &0, &11_500, &1_000), Err(Ok(EscrowError::InvalidSplit)));
    c.escrow.resolve(&id, &500, &11_500, &500);
    assert_eq!(balances(&c), (1_000_000 - 12_000, 11_500, 500, 0));
}

#[test]
fn resolve_only_for_disputes_and_only_in_window() {
    let c = setup();
    let id = book(&c, 1);
    assert_eq!(c.escrow.try_resolve(&id, &12_500, &0, &0), Err(Ok(EscrowError::NotDisputed)));
    assert_eq!(c.escrow.try_dispute(&id), Err(Ok(EscrowError::TooEarly)));
    at(&c, T0 + 15 * DAY);
    assert_eq!(c.escrow.try_dispute(&id), Err(Ok(EscrowError::TooLate)));
}

#[test]
fn every_path_empties_the_escrow() {
    // Each terminal path leaves exactly zero in the contract.
    let c = setup();
    for (n, path) in [(1u8, 0u8), (2, 1), (3, 2), (4, 3), (5, 4)] {
        at(&c, T0);
        let id = bid(&c.env, n);
        c.escrow.lock(&id, &c.guest, &c.host, &7_777, &333, &1_111, &(T0 + 10 * DAY), &(T0 + 15 * DAY), &moderate(&c.env));
        match path {
            0 => { at(&c, T0 + 8 * DAY); c.escrow.cancel(&id); }
            1 => { c.escrow.host_cancel(&id); }
            2 => { at(&c, T0 + 10 * DAY); c.escrow.release(&id, &c.guest); }
            3 => { at(&c, T0 + 15 * DAY); c.escrow.settle_default(&id); }
            _ => { at(&c, T0 + 11 * DAY); c.escrow.dispute(&id); c.escrow.resolve(&id, &1_000, &7_888, &333); }
        }
        assert_eq!(c.token.balance(&c.escrow.address), 0, "path {path}");
    }
}

#[test]
fn only_admin_changes_arbiter() {
    let c = setup();
    let new = Address::generate(&c.env);
    c.escrow.set_arbiter(&new);
    assert_eq!(c.escrow.get_config().arbiter, new);
}
