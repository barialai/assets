# Vault - Your Personal Workspace

A self-contained personal asset, everyday money and loan tracker.
Interface update 3; backup data format remains version 2.

## Open the website

For a desktop browser, open `vault-money-and-loans.html`. It contains the entire
interface, styles, script and brand mark. No build step, npm install, external
font, bank login or exchange connection is needed.

The website is not publicly hosted by this download. To use a normal website
address on phones and computers, publish the `index.html`, `styles.css`, `app.js`
and `logo.svg` files together on your static web host. Use HTTPS. Do not upload
personal JSON backups to the public website folder. The hosted interface still
keeps each browser's records locally; hosting the interface does not create
cloud synchronization or user accounts. A phone's file-preview screen is not
an interactive website browser.

## Start from your existing records

Open Backup & restore using the folder button in the top bar, the desktop
sidebar, or More in the mobile bottom navigation. Choose Upload & review backup,
select your latest Vault JSON file, review its contents, acknowledge replacement,
and choose Restore workspace.

Restoring does not replay transactions or add balances a second time. It replaces
this browser's workspace with the records in the file. Your accounts, available
cash, investments, loans, repayments, profile photo, asset logos, currency rates
and saved valuation history are included. No supplied financial records or
photos are embedded into these website files.

The initial demo is clearly labelled and uses illustrative balances. Choose
Start fresh only for a new, empty workspace; choose Restore backup for an
existing one.

## Moving between devices

1. Save any open forms, then choose Download full backup on the first device.
2. Save the .json file in a private location and move it to the other device.
3. Open the same website in a browser on the other device.
4. Open Backup & restore, choose that file, review it and confirm.
5. After making more changes, export a fresh backup before switching devices.

This is a manual file transfer, not live sync or a two-way merge. A backup is a
snapshot of the records when it was created, not future changes. The timestamp
in the app means a backup was prepared, not that the operating system confirmed
where you saved the downloaded file. Verify that your copy is in Files or
Downloads. CSV exports are reports only and cannot restore a workspace.

## Restore safeguards

- Version 1 and version 2 Vault JSON backups are accepted, up to 12 MB and the
  existing per-collection limits.
- Invalid data, missing linked records or unsupported versions stop the import.
- An import preview shows the profile, counts, saved date and included images.
- Restore requires an explicit acknowledgement and confirmation.
- An older-file warning appears when applicable.
- Download current first preserves a portable copy before replacement.
- The pre-restore option keeps one previous workspace in this browser. Review
  previous workspace in Backups lets you restore it. It is not an independent
  backup: clearing browser data also removes that copy.
- If browser storage refuses the active-workspace write, restore stops without
  replacing the active records. Limited browser storage may fit less than the
  maximum accepted file size.
- Two open tabs on the same website detect conflicting local updates. Always
  finish with one tab before importing elsewhere.

Backups are plain JSON, not encrypted. Keep them private. Never enter passwords,
bank credentials, seed phrases or private keys into notes. This is not an
authenticated banking application.

## Date picker

The custom picker replaces native date fields and the cash-flow month filter.
It uses the exact brand palette, month/year selection, today highlighting,
selected-date highlighting, contextual quick dates, optional clearing, Cancel
and an explicit Use date / Use month action. Required fields and minimum/maximum
dates retain their validation. Dates are stored as local calendar dates, not
converted into UTC dates.

On a phone, the calendar opens as a bottom sheet with large tap targets. For
keyboard use, focus a day and use the arrow keys, Home/End or Page Up/Down.
Shift + Page Up/Down changes year. Enter/Space selects a date, then Use date
applies it. Escape cancels without changing the form.

## Mobile layout

The bottom navigation exposes Overview, Money, Loans, Tracker and More.
Backup & restore is also available from the top bar. Accounts and loans become
single-column cards on phones. Activity and repayment tables become readable
transaction cards. Forms use larger controls, single-column fields, numeric
keyboards, sticky headings and save controls. Safe-area spacing supports
notched-screen browser layouts. Desktop and tablet layouts remain available.

## Existing accounting behavior

Everyday spending, income and transfers remain separate from investment P&L.
Loan principal and interest stay separate. Existing loans can be recorded
without moving cash again. Linked repayments update the selected cash account.
Total asset value excludes loan principal; net worth adds money owed to you and
subtracts loans you owe. All currency conversion and valuations remain manual.
The profile badge is decorative, not identity verification.

## Files

- `vault-money-and-loans.html`: self-contained website.
- `index.html`, `app.js`, `styles.css`, `logo.svg`: equivalent modular source.
- `test-report.json`: test scope and results without personal financial records.

## Verification notes

The interface was rendered and exercised in headless Chromium at widths 320,
360, 390, 430, 540, 768, 1024 and 1440 pixels. Seven pages were checked at each
width, with no document-level horizontal overflow. Tests covered restore and
export of the supplied backup, required/optional dates, leap-day selection,
month selection, mobile loan entry, repayments, cash spending, trading results,
invalid imports, a storage-write failure, and pre-restore recovery.

The execution environment blocks browser navigation to files and local web
servers. Accordingly the tests rendered the application directly in the browser
and used in-memory storage and captured-download test doubles for transport.
They verify the application logic and rendered layouts, not actual device
storage quotas, operating-system save dialogs, hosted deployment, or physical
Safari/Android device behavior. No claim of testing those environments is made.
