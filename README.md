# Vault - Money, Assets & Loans

A self-contained personal finance dashboard using your supplied logo and palette:
Obsidian Root `#0C0E09`, Nox Noir `#141414`, and Electric Sun `#FCFF1A`.

## Open the app

Open `vault-money-and-loans.html` in a normal desktop browser. No installation, account, external font, library or internet connection is required for the standalone file. The app uses the browser's local storage. Local-file storage behavior can differ between browsers and file locations; export JSON backups before moving or renaming the file.

For a static-hosting workflow, keep `index.html`, `app.js` and `styles.css` together. The logo is also embedded in the HTML, so the standalone version has no asset dependencies. The separate `logo.svg` is your original source asset.

There is no hosting account or cloud database in this delivery. Protect access to the computer and browser profile that contain your records.

## Keep your existing records

1. In the previous website, open **Backup & restore** and export a JSON backup before switching versions.
2. Open this version and use **Backup & restore > Import JSON**. Confirm that the displayed account and entry counts are correct.
3. Keep the original backup. Version 1 files are accepted and upgraded; new version 2 loan backups are not readable by the old app.

The existing storage key is retained for browsers that share the same storage location. The upgrade does not reset existing balances, logos, profile photos, manual currency rates or entry history. A new filename may have different storage, so use the explicit export/import procedure rather than relying on automatic detection.

Existing cash balances are not guessed from the old investment field. If an older Binance card showed an opening investment of 758 and a current value of 0, the actual saved available balance was 0. Edit Binance and enter the real available balance. Do not enter 758 unless that is what is still available.

An empty installation opens with clearly labeled illustrative data. **Start fresh** clears that demo. Do not use Start fresh after importing your records unless you intend to erase the workspace.

## Everyday cash and bank accounts

Choose **Everyday cash / bank / wallet** for Binance cash, a local bank, a cash wallet or savings used for daily needs. The form asks for one **Available balance right now**, not an opening investment and return.

The card offers:

- **Money in** for salary, freelance income, refunds, gifts and other money arriving from outside the tracked accounts.
- **Spend / Money out** for shopping, bills, family support and other payments. Add a category, person or merchant, date and note.
- **Transfer** only for movement between two of your own accounts already tracked in Vault. Both balances are updated together.

A gift to family is Money out under Family & friends. Money that a friend is expected to return belongs in Loans instead. Do not log the same transaction in both places.

The Everyday money page has a monthly selector, account selector, money-in/out totals, a category breakdown and transaction history. Monthly flow totals exclude transfers, loan movements and balance corrections. Loan interest/fees remain with the loan's repayment record, not the everyday flow report.

Cash accounts never show investment ROI. Legacy cash entries labeled Profit or Loss are preserved in the backup and shown as Money in (legacy) or Money out (legacy); they are excluded from the investment profit tracker. These labels do not invent categories for older transactions.

Editing a cash balance records a balance correction. It does not invent an expense or income record. For normal daily use, record individual movements instead of repeatedly overwriting the balance.

## Investment accounts

Forex, crypto, stock and other investment accounts retain the opening-investment and current-value fields, uploaded logos, quantity-times-price helper, P&L logging and return chart.

A new P&L entry changes the current saved balance. Log a result only when it is not already included in that balance. Use Transfer when funding an investment from another account tracked here rather than logging an external deposit as well.

Prop/demo balances remain excluded from personal totals by default.

## Loans: borrowing and lending

Use **I borrowed money** for a liability and **I lent money** for money someone owes you. Each record tracks a person or company, label, currency, original principal, principal outstanding when tracking started, start date, next due date and notes.

### Existing loan

Enter the original principal and the amount currently unpaid. Leave **This is new money. Update a cash account now** OFF. This adds the outstanding debt or receivable without adding or deducting the cash a second time.

For example, an original loan of 1,000 with 600 still unpaid starts at 600 outstanding. The 400 already repaid is shown in the history summary; the app does not invent dates or individual transactions for it.

### New borrowing or lending

Turn the cash-movement option ON and choose an included everyday account. New borrowing increases that cash balance and the liability together. New lending reduces cash and adds a receivable. For this option, the original principal and outstanding principal must be equal.

### Repayments

Open the loan and record **Principal repaid**, optional **Interest / fees**, date and optional next due date. Choose the cash account to pay from or receive into.

Only principal reduces the amount outstanding. Principal plus interest/fees is the cash movement. The app converts between loan and account currencies using your saved manual rates. A preview shows the resulting balances before saving.

Turn **Update my cash account balance** OFF only when recording a payment already included in the saved balance, or a historical payment through an untracked account. That record changes the outstanding loan without moving cash again.

Interest is recorded as a paid amount, not automatically calculated or accrued. This is not an amortization engine or a lender statement. Outstanding principal reaching zero marks the loan fully repaid; unrecorded interest is not tracked as a separate liability.

The next due date is manual. Blank in the repayment form clears it; a full principal repayment clears it automatically. Overdue and due-today labels appear when you open or refresh the app. There are no background notifications or automatic payments.

### Correcting mistakes

Repayment history has a reverse action. Reversing removes both the principal reduction and its linked cash movement, including recorded interest. Deleting a linked payment from Activity opens the same reversal flow rather than leaving an orphaned loan record.

Deleting a loan reverses its linked cash entries and removes its repayment history after confirmation. Operations that would make a current account balance negative are blocked. Accounts with linked loan movements cannot be deleted until those links have been removed through the loan workflow.

Financial loan fields are locked after repayments or cash movements exist; label, person, notes and due date remain editable. Reverse incorrect records before replacing them.

## Totals and calculations

- **Estimated total value**: included current cash and investment balances, converted into USDT. Loan principal is shown separately.
- **Net worth**: estimated total value + outstanding principal owed to you - outstanding principal you owe.
- **Investment P&L**: sum of current value minus net contributed capital for included non-cash assets. Everyday spending, income and loan movements are excluded.
- **Investment return**: each investment's P&L divided by its contributed capital. This is simple bookkeeping, not a time-weighted or tax return.
- **Cash flow**: recorded everyday money in minus money out for the selected month. It is not trading profit and is not a historical cash balance.

Illustrative examples:

- 758 cash minus a 100 purchase = 658 cash. No investment loss is created.
- Moving 100 between two included accounts changes neither total assets nor net worth, subject to the saved conversion rates and rounding.
- Borrowing 500 into tracked cash increases cash by 500 and debt by 500; principal alone creates no net worth.
- Paying 100 principal and 5 interest reduces cash by 105, debt by 100 and net worth by 5. Investment P&L does not change.

Receivables are valued at recorded outstanding principal; this is not a guarantee of repayment. Manually entered rates determine current USDT valuations. Entry reports use the conversion rate saved when the entry was recorded. No live prices, bank integrations or exchange connections are included.

Daily history snapshots record the included asset total at the time of an edit. They are not a net-worth chart or reconstructed historical bank statement. Backdated entries affect the current balance when saved, and do not rebuild past valuation snapshots.

## Backups and privacy

Use **Export JSON** for a complete backup, including loans and repayments. Activity CSV and Loans CSV are additional human-readable records, not substitutes for a restorable JSON backup. Imports replace the current workspace after confirmation.

Data and backups are not encrypted by the app. Do not enter private keys, seed phrases, bank passwords or account credentials. The profile badge is decorative, not identity verification. Hide balances affects the dashboard display; editing forms, exports and some explicit detail dialogs reveal actual amounts.

The application does not send network requests. Data is stored only in the current browser unless you export it. Storage failures produce a warning; export a backup before closing the page when saving is unavailable.

## Implementation and checks

The application uses plain HTML, CSS, SVG and JavaScript, with no build system or external dependencies. Calculations are rounded to eight decimal places. This is a personal tracking tool, not audited financial software.

The accompanying test report records 58 automated checks covering old-backup migration, cash flows, investment separation, transfers, borrowing, lending, repayments, interest, reversal safety, manual conversions, JSON export/reload, profile editing, and layout widths from 360 to 1280 pixels. Additional demo screenshots were inspected at desktop and phone sizes.

The restricted testing browser rendered the authored HTML directly, using an in-memory Storage API test double. JSON was exported and reloaded in a fresh document. Native storage persistence in your particular local-file browser environment was not tested; regular exported backups remain essential.
