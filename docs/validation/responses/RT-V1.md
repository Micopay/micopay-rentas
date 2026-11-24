# RT-V1 · Product validation: The guest: would you book this way?

- **Issue:** #8
- **Country / general region:** West Africa
- **Did you run the demo locally?** no

## 1. First read — what do you think it is?

*Read the README only up to its first `##` heading. Write this before reading anything else.*

- What does MicoPay Rentas do, in your own words?
  > It looks like a short-term rental booking service for homes in Tepoztlán, Morelos. It holds my booking payment in a Stellar escrow instead of keeping it in the platform's bank account, and it pays the host after I check in.
- Who is it for?
  > It is for guests looking for short stays and hosts renting homes in Tepoztlán. It appears to serve both sides, with MicoPay acting as the platform and arbiter.
- What problem does it solve?
  > It is meant to make a rental booking feel safer for both sides. It protects my payment before check-in, gives the host a clear rule for receiving it, and puts cancellation and damage-deposit rules in the contract.

## 2. After the full README — what did you get wrong?

- What did you misunderstand in step 1, or what surprised you?
  > I understood the basic escrow idea, but I was surprised that the app is only a planned connection today. The README says guests and hosts currently use local testnet keys, while the MicoPay app would later let them pay, approve bookings and handle sign requests. I also learned that the host is not paid automatically at check-in; the guest can release payment after check-in, and an unchanged escrow settles after the claims window closes.
- What is still unclear?
  > The README explains that disputes may be resolved from evidence, but it does not say how I submit photos or other evidence or how clearly the result will be shown to me. I would also want to see exactly how the remaining claims window works after check-in and where the exchange rate is shown before I confirm payment.

## 3. Short-term rentals where you live

- Your country / general region (no city or address needed).
  > West Africa.
- Where you live, how do people rent homes for short stays? (Airbnb, Booking, other platforms, social media groups, renting directly…)
  > I see short stays arranged through large booking platforms, social media listings, local agents and direct conversations with hosts or property managers. I would expect a close friend or family member's recommendation to influence a direct booking, especially where the platform is unfamiliar.
- What fees do guests or hosts notice, and what do they think of them? A percentage is fine; no amounts of money.
  > On larger platforms, guests commonly notice service and host fees, as well as less favorable exchange rates. I find a clearly stated 3% platform fee easier to evaluate than fees that appear in several places during checkout.
- Do people book directly with the host? What makes them trust or distrust doing that?
  > I do see direct bookings, but I would trust one more if I could verify the listing, communicate with the host and pay through a system that neither side could reverse or alter unilaterally. The main distrust comes from fake listings, unclear cancellation terms and fear that an upfront transfer will not be returned.
- Are there common problems with cancellations, damage deposits or disputes?
  > Yes. In my experience, cancellations and damage deposits can become disputes because the rules are often communicated by message or not shown clearly before payment. I would want a booking record that states the policy and leaves a written trail for claims.
- Do you live this yourself (as a guest or host), see it up close, or only hear about it?
  > I have seen it up close when friends and family arrange short stays and have had to ask hosts about cancellation, check-in and refund conditions before transferring money.

## 4. Value

- **How useful does it look to you?** 1 (not at all) – 5 (very). Why?
  > 4 out of 5. The escrow under `escrow-v2` would be useful because my payment waits until check-in instead of going to the platform or host immediately, and the cancellation policy, damage deposit and dispute fallback are written into the contract. It is not a 5 because the planned app integration and key-handling experience are not available today.
- What is the most valuable part?
  > The most valuable part is the refund and release logic in step 2 and step 5 of "How a booking works." If the host cancels, I get everything back; if I cancel, the contract applies the selected policy and always returns the deposit. The automatic default settlement also means funds should not remain indefinitely trapped.
- What is missing?
  > Before booking, I would want a clearer checkout breakdown, verification information for the listing and host, and the exact claims deadline. After check-in, I would want an evidence upload step for damage disputes and a simple status view showing that the payment is released or the dispute is under review.
- What would stop you (or the person in your issue's role) from using it?
  > I would stop if I had to manage wallet keys or exchange USDC on an unfamiliar service before I could pay, the listed price changed through an unclear exchange rate, or I could not verify the property and host. Vague claim deadlines or a dispute process with no easy evidence submission would also stop me.

## 5. The MicoPay app

*The README section "How it connects to the MicoPay app (planned)" describes the guest paying from the MicoPay app and the host cashing out with an agent or via SPEI.*

- Does that connection make the product more useful to you? What would it change for you?
  > Yes. Paying from the MicoPay app in USDC or through cash-on-network access would remove the need for me to manage Stellar testnet keys, and app-based sign requests would make payment, release and claims easier to approve. I would also value seeing the same booking status and payment actions in one place instead of signing separate transactions.

## 6. What confused you

- Which screen, step or term confused you, and what did you expect instead?
  > The README sentence "The host is paid after check-in" could be read as immediate payment, but step 3 says I can release the payment after check-in or report a problem until claims close. I expected the booking screen to state both rules directly: whether the release is waiting for my action and when the claims window ends. I would show a timeline that distinguishes check-in, the claims deadline and final settlement.

## 7. Questions for your issue

- Would you book a stay this way? Why or why not?
  > I would consider booking this way if the property and host were verified and the app displayed the full cost, cancellation rules and claims deadline before payment. I like that neither the platform nor the host can move funds outside the escrow contract, but I would hesitate while it still requires testnet keys and I cannot yet use the planned MicoPay payment flow.
- Does the escrow (the host is paid after check-in) give you confidence? What else would you need?
  > It gives me confidence that the host cannot receive the stay payment before I arrive. I would also need to verify the listing and host, see a clear check-in confirmation step, understand the claim evidence process and know how to get help during a dispute. I would want a clear countdown for the claims window and the process for reporting a property that does not match the listing.
- What would stop you from booking?
  > I would not book if the exchange rate or final payable amount was unclear, the host and property could not be verified, cancellation and deposit rules were hidden, or I had to move funds through an unfamiliar wallet. A long or opaque dispute process and uncertainty about receiving help after check-in would also stop me.

## 8. Ideas

Up to 3. For each one: the problem it solves, then the idea.

1. **Problem:** Guests cannot tell whether a listing and host are trustworthy before committing payment. · **Idea:** Add a verification summary to the listing page showing clearly which identity, property or host checks are available, while keeping the information privacy-safe.
2. **Problem:** It is easy to misunderstand the final booking cost and exactly how much becomes refundable. · **Idea:** Add a fixed checkout receipt that separates stay, cleaning, the 3% fee and refundable damage deposit, and explains the MXN-to-USDC rate used at that moment.
3. **Problem:** A guest or host may not know how to support a dispute or what happens while it is under review. · **Idea:** Add a structured claim screen with optional evidence upload, a visible deadline and status updates after the claim is submitted and when the arbiter resolves or the default settlement applies.
