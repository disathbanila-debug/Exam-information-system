-- Exam Information System Manager - MySQL schema
-- Logical design derived from the EER diagram (only HOD, Lecturer and AR Office log in).

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS final_marksheets;
DROP TABLE IF EXISTS detail_marksheets;
DROP TABLE IF EXISTS second_marker_reports;
DROP TABLE IF EXISTS courier_dispatches;
DROP TABLE IF EXISTS script_collections;
DROP TABLE IF EXISTS exam_papers;
DROP TABLE IF EXISTS examinations;
DROP TABLE IF EXISTS second_examiners;
DROP TABLE IF EXISTS external_examiners;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS user_contact_numbers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS faculties;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE faculties (
  faculty_id    INT AUTO_INCREMENT PRIMARY KEY,
  faculty_name  VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE departments (
  dept_id     INT AUTO_INCREMENT PRIMARY KEY,
  dept_name   VARCHAR(120) NOT NULL,
  faculty_id  INT NOT NULL,
  UNIQUE KEY uq_dept (faculty_id, dept_name),
  CONSTRAINT fk_dept_faculty FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id)
) ENGINE=InnoDB;

-- SYSTEM_USER (role = HOD / LECTURER / AR). HOD is also a lecturer of the university.
CREATE TABLE users (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,
  title          VARCHAR(20)  NOT NULL,
  initials       VARCHAR(30)  NOT NULL,
  surname        VARCHAR(80)  NOT NULL,
  designation    VARCHAR(80)  NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('HOD','LECTURER','AR') NOT NULL,
  grade_level    TINYINT NULL COMMENT '1 Lecturer (Prob) .. 5 Professor; used for the 2nd examiner rule',
  dept_id        INT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
  CONSTRAINT chk_user_grade CHECK (grade_level IS NULL OR grade_level BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- Multivalued attribute Contact_No
CREATE TABLE user_contact_numbers (
  user_id     INT NOT NULL,
  contact_no  VARCHAR(20) NOT NULL,
  PRIMARY KEY (user_id, contact_no),
  CONSTRAINT fk_contact_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE subjects (
  subject_code   VARCHAR(20)  PRIMARY KEY,
  subject_name   VARCHAR(150) NOT NULL,
  credits        TINYINT NOT NULL,
  year_of_study  TINYINT NOT NULL,
  semester       TINYINT NOT NULL,
  dept_id        INT NOT NULL,
  lecturer_id    INT NULL COMMENT 'TEACHES: one lecturer per subject',
  CONSTRAINT fk_subject_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
  CONSTRAINT fk_subject_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(user_id),
  CONSTRAINT chk_subject CHECK (credits BETWEEN 1 AND 6 AND year_of_study BETWEEN 1 AND 4 AND semester IN (1, 2))
) ENGINE=InnoDB;

CREATE TABLE external_examiners (
  ext_id              INT AUTO_INCREMENT PRIMARY KEY,
  title               VARCHAR(20)  NOT NULL,
  designation         VARCHAR(80)  NOT NULL,
  name_with_initials  VARCHAR(120) NOT NULL,
  university          VARCHAR(150) NOT NULL,
  department          VARCHAR(150) NOT NULL,
  address             VARCHAR(255) NOT NULL,
  email               VARCHAR(120) NOT NULL,
  contact_no          VARCHAR(20)  NOT NULL
) ENGINE=InnoDB;

-- SECOND_EXAMINER category: either an internal lecturer or an external examiner
CREATE TABLE second_examiners (
  examiner_id    INT AUTO_INCREMENT PRIMARY KEY,
  examiner_type  ENUM('INTERNAL','EXTERNAL') NOT NULL,
  lecturer_id    INT NULL UNIQUE,
  ext_id         INT NULL UNIQUE,
  CONSTRAINT fk_se_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(user_id),
  CONSTRAINT fk_se_external FOREIGN KEY (ext_id) REFERENCES external_examiners(ext_id),
  CONSTRAINT chk_se_type CHECK (
    (examiner_type = 'INTERNAL' AND lecturer_id IS NOT NULL AND ext_id IS NULL) OR
    (examiner_type = 'EXTERNAL' AND ext_id IS NOT NULL AND lecturer_id IS NULL))
) ENGINE=InnoDB;

-- EXAMINATION (timetable prepared by the HOD)
CREATE TABLE examinations (
  exam_id        INT AUTO_INCREMENT PRIMARY KEY,
  exam_name      VARCHAR(150) NOT NULL,
  academic_year  VARCHAR(20)  NOT NULL,
  year_of_study  TINYINT NOT NULL,
  semester       TINYINT NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  prepared_by    INT NOT NULL,
  prepared_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exam_hod FOREIGN KEY (prepared_by) REFERENCES users(user_id),
  CONSTRAINT chk_exam_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB;

-- EXAM_PAPER (one subject's paper in one examination) + APPOINTED_TO second examiner
CREATE TABLE exam_papers (
  paper_id             INT AUTO_INCREMENT PRIMARY KEY,
  exam_id              INT NOT NULL,
  subject_code         VARCHAR(20) NOT NULL,
  exam_date            DATE NOT NULL,
  start_time           TIME NOT NULL,
  end_time             TIME NOT NULL,
  venue                VARCHAR(100) NOT NULL,
  no_of_scripts        INT NULL,
  scripts_received_at  DATETIME NULL COMMENT 'answer scripts received by the AR office',
  second_examiner_id   INT NULL,
  appointed_at         DATE NULL,
  appointed_by         INT NULL,
  UNIQUE KEY uq_paper (exam_id, subject_code),
  CONSTRAINT fk_paper_exam FOREIGN KEY (exam_id) REFERENCES examinations(exam_id) ON DELETE CASCADE,
  CONSTRAINT fk_paper_subject FOREIGN KEY (subject_code) REFERENCES subjects(subject_code),
  CONSTRAINT fk_paper_examiner FOREIGN KEY (second_examiner_id) REFERENCES second_examiners(examiner_id),
  CONSTRAINT fk_paper_appointed_by FOREIGN KEY (appointed_by) REFERENCES users(user_id),
  CONSTRAINT chk_paper_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

-- COLLECTS: lecturer collects scripts from the AR office; must return them within 3 months
CREATE TABLE script_collections (
  paper_id           INT PRIMARY KEY,
  lecturer_id        INT NOT NULL,
  collected_by_name  VARCHAR(120) NOT NULL,
  collected_at       DATETIME NOT NULL,
  due_date           DATE GENERATED ALWAYS AS (DATE_ADD(DATE(collected_at), INTERVAL 3 MONTH)) STORED,
  returned_at        DATE NULL,
  recorded_by        INT NOT NULL,
  CONSTRAINT fk_sc_paper FOREIGN KEY (paper_id) REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
  CONSTRAINT fk_sc_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(user_id),
  CONSTRAINT fk_sc_recorder FOREIGN KEY (recorded_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- COURIERS: AR office sends marked scripts to the 2nd examiner; 1 month to return
CREATE TABLE courier_dispatches (
  paper_id                INT PRIMARY KEY,
  second_examiner_id      INT NOT NULL,
  ar_officer_id           INT NOT NULL,
  courier_ref             VARCHAR(60) NOT NULL,
  no_of_scripts           INT NOT NULL,
  dispatched_date         DATE NOT NULL,
  examiner_notified_at    DATETIME NOT NULL,
  examiner_received_date  DATE NULL,
  due_date                DATE GENERATED ALWAYS AS (DATE_ADD(examiner_received_date, INTERVAL 1 MONTH)) STORED,
  returned_date           DATE NULL COMMENT 'date the 2nd examiner sent scripts back',
  ar_received_date        DATE NULL,
  CONSTRAINT fk_cd_paper FOREIGN KEY (paper_id) REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
  CONSTRAINT fk_cd_examiner FOREIGN KEY (second_examiner_id) REFERENCES second_examiners(examiner_id),
  CONSTRAINT fk_cd_ar FOREIGN KEY (ar_officer_id) REFERENCES users(user_id),
  CONSTRAINT chk_cd_scripts CHECK (no_of_scripts > 0)
) ENGINE=InnoDB;

CREATE TABLE second_marker_reports (
  report_id           INT AUTO_INCREMENT PRIMARY KEY,
  paper_id            INT NOT NULL UNIQUE,
  second_examiner_id  INT NOT NULL,
  report_pdf          VARCHAR(255) NOT NULL,
  report_date         DATE NOT NULL,
  uploaded_by         INT NOT NULL,
  sent_to_hod_at      DATETIME NULL,
  CONSTRAINT fk_smr_paper FOREIGN KEY (paper_id) REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
  CONSTRAINT fk_smr_examiner FOREIGN KEY (second_examiner_id) REFERENCES second_examiners(examiner_id),
  CONSTRAINT fk_smr_uploader FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- Weak entity: identified by (paper_id, version_no)
CREATE TABLE detail_marksheets (
  paper_id        INT NOT NULL,
  version_no      INT NOT NULL,
  marksheet_pdf   VARCHAR(255) NOT NULL,
  paper_mark_pct  DECIMAL(5,2) NOT NULL,
  ca_mark_pct     DECIMAL(5,2) NOT NULL,
  remarks         VARCHAR(255) NULL,
  submitted_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (paper_id, version_no),
  CONSTRAINT fk_dm_paper FOREIGN KEY (paper_id) REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
  CONSTRAINT chk_dm_pct CHECK (paper_mark_pct >= 0 AND ca_mark_pct >= 0 AND paper_mark_pct + ca_mark_pct = 100)
) ENGINE=InnoDB;

CREATE TABLE final_marksheets (
  final_id                INT AUTO_INCREMENT PRIMARY KEY,
  paper_id                INT NOT NULL UNIQUE,
  final_pdf               VARCHAR(255) NOT NULL,
  finalized_at            DATETIME NOT NULL,
  approval_status         ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_by             INT NULL,
  approved_at             DATETIME NULL,
  hod_comment             VARCHAR(255) NULL,
  sent_to_exam_branch_at  DATETIME NULL,
  CONSTRAINT fk_fm_paper FOREIGN KEY (paper_id) REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
  CONSTRAINT fk_fm_hod FOREIGN KEY (approved_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  notification_id  INT AUTO_INCREMENT PRIMARY KEY,
  sender_id        INT NULL,
  receiver_id      INT NOT NULL,
  paper_id         INT NULL,
  notif_type       VARCHAR(40)  NOT NULL,
  message          VARCHAR(500) NOT NULL,
  sent_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read          TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_notif_receiver (receiver_id, is_read),
  CONSTRAINT fk_notif_sender FOREIGN KEY (sender_id) REFERENCES users(user_id),
  CONSTRAINT fk_notif_receiver FOREIGN KEY (receiver_id) REFERENCES users(user_id),
  CONSTRAINT fk_notif_paper FOREIGN KEY (paper_id) REFERENCES exam_papers(paper_id) ON DELETE SET NULL
) ENGINE=InnoDB;
