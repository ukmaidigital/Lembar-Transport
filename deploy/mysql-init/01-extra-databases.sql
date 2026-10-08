-- Extra databases for automated tests; runs once when the MySQL volume is first created.
CREATE DATABASE IF NOT EXISTS lembar_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS lembar_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON lembar_test.* TO 'lembar'@'%';
GRANT ALL PRIVILEGES ON lembar_e2e.* TO 'lembar'@'%';
FLUSH PRIVILEGES;
