# D'code IAS Fees Manager – Project Rules (read before coding)

## What this system does
1. **Fees Entry person**: enrol new student + first payment, collect later instalments, print receipts, work the "Due" dashboard.
2. **Report person**: read-only reports (collection, pending, overdue, cash vs online) with Excel download.
3. **Super Admin**: creates staff accounts (name, password, role), changes role, disables users, manages courses.

Roles: `super_admin` | `fees` (fees entry) | `reports` | `both`.

## DO
- Keep money logic in `src/util.js` (`calcNet`, `calcBalance`). Never duplicate it in pages.
- Every rupee received = one document in `payments`. Student `totalPaid` and `balance` are derived and updated in the SAME batch write.
- Online payment => `transId` is mandatory. Cash => transId empty.
- If balance remains after a payment => `nextDueDate` is mandatory.
- Courses come from the `courses` collection/table only. No hard-coded course names.
- Receipt layout lives only in `src/receiptTemplate.js` – edit there to change the format.
- Apply Firestore rules from `db/firestore.rules` before going live.
- Take regular Firestore exports / MySQL dumps as backup.

## DO NOT
- Do NOT delete payments or students. Mistakes are corrected with a new entry + remark (audit trail).
- Do NOT let report users write anything (rules enforce it).
- Do NOT commit `.env` or `serviceAccountKey.json`.
- Do NOT store plain passwords anywhere. Firebase Auth handles passwords.
- Do NOT edit `totalPaid` / `balance` by hand in the database.
- Do NOT exceed the course fee: paid amount can never be more than net fee.

## Data model (same in Firestore and MySQL)
users, courses, students, payments – see `db/mysql_schema.sql` and `db/firestore.rules`.
net fee = course fee − (course fee × discount% / 100); balance = net fee − total paid.

## Setup
1. Create Firebase project → enable **Authentication (Email/Password)** and **Firestore**.
2. `cp .env.example .env` and fill values. `npm install`.
3. Download a service-account key as `serviceAccountKey.json` (project root) → `npm run seed`
   (creates first super admin `admin` / `ChangeMe@123` and sample courses). Change the password after first login.
4. Paste `db/firestore.rules` into Firestore → Rules → Publish.
5. `npm run dev`. Build for hosting: `npm run build` (upload `dist/`).

## Login note
Staff log in with *username + password*. Internally username becomes `username@decodeias.app` in Firebase Auth.

## MySQL
`db/mysql_schema.sql` is the relational version (for a future PHP/Node API). The current React app talks to Firebase directly.
