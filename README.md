# Exam Information System Manager

Web application for the **Computing Department, Faculty of Applied Sciences, Rajarata University of Sri Lanka**.
It tracks every exam paper from the timetable to the Exam Information Branch: answer-script collection,
the 3-month marking limit, second marking by courier (1-month limit), the second marker report,
detail / final marksheets and HOD approval.

Stack: **MySQL + Express + React + Node.js** (the MERN pattern, with MySQL instead of MongoDB).

```
exam-information-system/
├── backend/            Express REST API (Node.js, mysql2, JWT, multer)
│   ├── db/schema.sql         tables (from the EER diagram)
│   ├── db/init.js            creates tables + demo data
│   ├── db/create_db_user.sql one-time MySQL database/user setup
│   ├── src/routes/           auth, common, hod, lecturer, ar
│   └── uploads/              uploaded PDFs
└── frontend/           React (Vite) app with three separate portals
    └── src/pages/{hod,lecturer,ar}
```

## Three users, three interfaces

| Role | Portal | What they do |
|---|---|---|
| **HOD** | `/hod` (indigo) | Create examinations and timetables, manage subjects and lecturers, monitor who has the scripts, see overdue scripts (3 months / 1 month), view forwarded marksheets and 2nd marker reports, approve or return final marksheets, send them to the Exam Information Branch |
| **Lecturer** | `/lecturer` (teal) | See own exam papers and their stage, nominate the second examiner (internal of a higher grade, or external), upload the marking report (paper % + CA %), view the 2nd marker report, upload corrected versions, submit the final marksheet |
| **AR Office** | `/ar` (amber) | Record scripts received after an exam (lecturer is notified), record who collected them and when, record the return, courier scripts to the second examiner (examiner informed of subject code and count), record the examiner's receipt, upload the 2nd marker report (lecturer is notified), forward documents to the HOD |

There is no admin account. The demo HOD and AR accounts come from the seed script; the HOD adds lecturer accounts.
Second examiners do not log in: the AR office records their receipt and return.

## Setup

Requirements: Node.js 18+ and MySQL 8+ (running).

**1. Create the database and app user** (once, as MySQL root). Run from the `backend` folder:

```bash
/usr/local/mysql/bin/mysql -u root -p < db/create_db_user.sql
```

(If `mysql` is on your PATH you can just use `mysql -u root -p < db/create_db_user.sql`.)

Alternative: skip this step and put your own MySQL login in `backend/.env` (for example `DB_USER=root` and
`DB_PASSWORD=<your root password>`). `npm run db:init` creates the database if it does not exist.

**2. Backend** (`backend/.env` already holds the matching database password and a JWT secret; on a new machine copy `.env.example` to `.env` and fill it in):

```bash
cd backend
npm install
npm run db:init      # creates all tables and loads demo data (resets existing data)
npm run dev          # API on http://localhost:5050
```

**3. Frontend** (in a second terminal):

```bash
cd frontend
npm install
npm run dev          # open http://localhost:5173
```

## Demo accounts

All demo accounts use the password **`Exam@1234`** (change `SEED_PASSWORD` in `.env` before `npm run db:init` to use another).

| Role | Email | Notes |
|---|---|---|
| HOD | `hod@exam.test` | Dr. A.B. Perera, Senior Lecturer Grade I |
| AR Office | `ar@exam.test` | Mrs. K.M. Silva |
| Lecturer | `lecturer1@exam.test` | Mr. S. Jayasinghe – ICT1407 scripts are **overdue** (3 months) |
| Lecturer | `lecturer2@exam.test` | Ms. N. Fernando – ICT1402 is with a 2nd examiner, **overdue** (1 month) |
| Lecturer | `lecturer3@exam.test` | Dr. R. Wickramasinghe – ICT1403 final marksheet **awaiting HOD approval** |
| Lecturer | `gunasekara@exam.test`, `bandara@exam.test` | Senior staff from other departments/faculties (internal 2nd examiners) |

Demo dates are relative to the day you run `npm run db:init`, so overdue items always show up.

## Process stages (EXAM_PAPER.Status, derived)

1. Scheduled → 2. Scripts at AR office → 3. With lecturer (due in 3 months) → 4. Returned to AR →
5. Couriered to 2nd examiner → 6. With 2nd examiner (due in 1 month) → 7. 2nd marker report received →
8. Forwarded to HOD → 9. Final marksheet awaiting approval (or returned for correction) →
10. Approved by HOD → 11. Sent to Exam Branch

## Business rules enforced

- An internal second examiner must hold a **higher grade** than the subject lecturer (can be from any department/faculty).
- Collection due date = collected date + **3 months**; examiner due date = received date + **1 month** (MySQL generated columns).
- Paper % + CA % must equal 100; each corrected detail marksheet is a new version (weak entity `paper_id + version_no`).
- Each step can only happen in order (e.g. scripts cannot be couriered before the lecturer returns them).
- Lecturers can only see their own papers and files.

## Main API endpoints

| Method | Path | Role |
|---|---|---|
| POST | `/api/auth/login` | all |
| GET | `/api/notifications`, `/api/papers/:id`, `/api/files/:name` | all |
| GET/POST | `/api/hod/examinations`, `/api/hod/examinations/:id/papers` | HOD |
| GET/POST/PUT | `/api/hod/subjects`, `/api/hod/lecturers` | HOD |
| POST | `/api/hod/papers/:id/approve` · `/reject` · `/send-to-branch` | HOD |
| GET | `/api/lecturer/papers`, `/api/lecturer/examiner-options` | Lecturer |
| POST | `/api/lecturer/papers/:id/second-examiner` · `/marksheets` · `/final` | Lecturer |
| POST | `/api/ar/papers/:id/scripts-received` · `/collection` · `/return` | AR |
| POST | `/api/ar/papers/:id/dispatch` · `/examiner-received` · `/second-report` · `/forward-to-hod` | AR |
