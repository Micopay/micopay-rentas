use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    BookingNotFound = 3,
    BookingExists = 4,
    InvalidAmount = 5,
    InvalidParties = 6,
    InvalidDates = 7,
    InvalidPolicy = 8,
    NotLocked = 9,
    NotDisputed = 10,
    TooEarly = 11,
    TooLate = 12,
    Unauthorized = 13,
    InvalidSplit = 14,
}
