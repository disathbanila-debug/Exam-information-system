-- Run ONCE as the MySQL root user:
--   /usr/local/mysql/bin/mysql -u root -p < db/create_db_user.sql
-- Creates the database and the application user used in backend/.env
CREATE DATABASE IF NOT EXISTS exam_info_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'exam_app'@'localhost' IDENTIFIED BY 'App3ac668517efe09cc92ce';
ALTER USER 'exam_app'@'localhost' IDENTIFIED BY 'App3ac668517efe09cc92ce';
GRANT ALL PRIVILEGES ON exam_info_system.* TO 'exam_app'@'localhost';
FLUSH PRIVILEGES;
