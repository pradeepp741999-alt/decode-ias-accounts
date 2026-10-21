CREATE DATABASE IF NOT EXISTS decode_fees CHARACTER SET utf8mb4;
USE decode_fees;

CREATE TABLE users(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash, never plain text
  role ENUM('super_admin','fees','reports','both') NOT NULL DEFAULT 'fees',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  fee DECIMAL(10,2) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE students(
  id INT AUTO_INCREMENT PRIMARY KEY,
  joined_on DATE NOT NULL,
  name VARCHAR(100) NOT NULL,
  father_name VARCHAR(100),
  mobile VARCHAR(15) NOT NULL,
  course_id INT NOT NULL,
  course_fee DECIMAL(10,2) NOT NULL,
  discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  net_fee DECIMAL(10,2) NOT NULL,
  total_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance DECIMAL(10,2) NOT NULL,
  next_due_date DATE NULL,
  remarks VARCHAR(500),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(course_id) REFERENCES courses(id),
  FOREIGN KEY(created_by) REFERENCES users(id),
  INDEX(next_due_date), INDEX(mobile)
);

CREATE TABLE payments(
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  paid_on DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK(amount>0),
  mode ENUM('cash','online') NOT NULL,
  trans_id VARCHAR(60) NULL,
  next_due_date DATE NULL,
  remarks VARCHAR(500),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(student_id) REFERENCES students(id),
  FOREIGN KEY(created_by) REFERENCES users(id),
  CHECK(mode='cash' OR (trans_id IS NOT NULL AND trans_id<>'')),   -- online needs transaction id
  INDEX(paid_on)
);

CREATE VIEW v_course_summary AS
SELECT c.name course, COUNT(s.id) students, SUM(s.net_fee) total_fee,
       SUM(s.total_paid) collected, SUM(s.balance) pending
FROM courses c LEFT JOIN students s ON s.course_id=c.id GROUP BY c.id;

CREATE VIEW v_overdue AS
SELECT s.*, DATEDIFF(CURDATE(), s.next_due_date) days_overdue
FROM students s WHERE s.balance>0 AND s.next_due_date<CURDATE();

CREATE VIEW v_mode_summary AS
SELECT mode, SUM(amount) amount, COUNT(*) receipts FROM payments GROUP BY mode;

INSERT INTO courses(name,fee) VALUES('UPSC Prelims + Mains',80000),('TNPSC Group 4',8000),('TNPSC Group 1',25000);
