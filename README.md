# Vault - Personal Asset Manager

A working, responsive, local-first dashboard for cash, trading accounts, crypto holdings and other personal assets. The interface uses black and blue, with an optional gold profile badge.

## Open the dashboard

The easiest version is **vault-assets.html**. Open it in a desktop browser; it contains all the code it needs and makes no network requests.

The source version consists of `index.html`, `styles.css` and `app.js`. Keep these three files in the same folder. There is no package installation, build system, third-party JavaScript library or API key.

The first launch contains clearly labeled sample data. Use **Start fresh** before entering your real balances. This keeps your profile and currency settings but removes the sample assets, entries and chart history.

## Included features

- Profile name and subtitle editing, photo upload/replacement/removal, and an optional gold display badge.
- Headline net worth in USDT, calculated from every included asset. Other display currencies are configurable.
- Cash, forex, crypto, stocks/ETFs, property, other investments, and prop/demo accounts.
- Asset cards with brand logo uploads, original capital, current balance/value, gain/loss and percentage return.
- A common add/edit form, with optional quantity and unit-price calculation.
- Per-investment percentage-performance chart, allocation chart, and saved portfolio-value history.
- Daily profit/loss entries, account filters, monthly summaries, a clickable calendar, and a full activity log.
- Deposits, withdrawals, and linked internal transfers between accounts, including manual cross-currency conversion.
- Editable manual exchange rates, hidden-balance mode, JSON backup/restore and CSV ledger export.
- Browser-storage error warnings, backup validation, and protection against overwriting another tab's changes while a form is open.

## A typical workflow

1. Add a cash asset for money that is not invested. Enter the amount as both investment and current value.
2. Add each trading account or investment separately. Enter its contributed capital and what it is worth now.
3. Choose **Log P&L** on an account to record a new result. A profit of 100 increases that account's balance by 100 in its own currency. A loss decreases it.
4. Use **Transfer** to move money already tracked in your cash account to a trading account. The two balances change, but the included portfolio total does not increase just because money moved.
5. Use **Deposit** or **Withdrawal** only for capital entering or leaving the tracked accounts. These do not create trading profit.
6. Export a JSON backup regularly, especially before deleting data, changing browser, moving the local file or clearing browser storage.

Do not log a profit twice: a new P&L entry adds to the saved current balance. If your starting balance already includes a particular result, do not add it again.

## How the calculations work

All source amounts are entered in each asset's own currency. A conversion rate means:

    1 unit of the account currency = X USDT

USDT is fixed at 1 as the base unit. The initial USD rate is also 1 solely as a user-editable convenience, not a market quote or a guaranteed peg. No other live or suggested rates are provided.

For each account:

    current value = opening value + all logged value changes
    net capital = opening investment + deposits + transfers in
                  - withdrawals - transfers out + capital corrections
    profit/loss = current value - net capital

The asset's simple percentage return divides profit/loss by opening capital plus deposits and transfers in, including opening-capital corrections. The headline percentage uses opening capital plus external deposits so internal transfers are not counted twice in that denominator. A percentage is unavailable when its capital denominator is zero.

These are simple accounting comparisons, not tax, time-weighted or audited performance figures. Current totals and account gains are translated using the current saved conversion rate. Currency-exchange gains on historical capital are not separately modeled. Daily entries preserve the conversion rate used when recorded.

Editing an account's current value creates a valuation adjustment in the activity log, rather than silently overwriting its existing daily entries. Quantity multiplied by unit price is an optional button that fills the current-value field; it is not a continuously recalculating price feed.

The portfolio-value chart stores the most recent value saved on each day you change the workspace. It is a valuation history, not a return chart. A backdated daily entry changes today's current balance and is listed on the date you selected in the daily tracker; it does not reconstruct historical valuations. The app does not run background jobs when it is closed.

## Privacy, storage and scope

Data is stored in this browser, not in a cloud account. Browser permissions determine whether local saving is available. If saving is blocked or full, the app warns you; export a backup before closing the tab. Local-file storage may differ by browser and file location. Keep backups, and use a stable location for the file.

There is no sign-in, password protection, encryption, exchange connection, bank connection, live market feed, automatic device sync or automatic backup. Someone with access to the same browser profile may be able to see the data. JSON backups include your profile photo and logos and are not encrypted. Never enter credentials, bank passwords, API secrets, recovery phrases or private keys.

The gold badge is a visual personal-profile badge, not identity verification by a third party. Prop/demo accounts are excluded from net worth by default; real received payouts can be tracked separately.

Importing a backup replaces the entire current workspace after confirmation. Deleting an entry reverses its effect. Deleting either side of an internal transfer reverses both sides; reversals that would create a negative balance are blocked.

## Source files

- `index.html`: document shell, navigation and inline icon symbols.
- `styles.css`: desktop, tablet and mobile layouts.
- `app.js`: calculation model, storage, validation, forms, charts and exports.

The source can be served as a static website. Publishing these files does not add authentication, a database or synchronization; browser data remains local. Never place your backup JSON files in a public website folder.
