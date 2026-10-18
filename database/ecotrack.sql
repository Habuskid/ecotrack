-- EcoTrack — Smart Waste Management System
-- Database Schema Script

CREATE DATABASE IF NOT EXISTS `ecotrack_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `ecotrack_db`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Waste Categories Table
CREATE TABLE IF NOT EXISTS `waste_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT,
  `disposal_method` TEXT,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Waste Reports Table
CREATE TABLE IF NOT EXISTS `waste_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `category_id` INT NOT NULL,
  `description` TEXT NOT NULL,
  `image_path` VARCHAR(255) NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `status` ENUM('Pending', 'Approved', 'In Progress', 'Collected', 'Rejected') NOT NULL DEFAULT 'Pending',
  `admin_note` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_waste_reports_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waste_reports_category` FOREIGN KEY (`category_id`) REFERENCES `waste_categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Recognition Results Table
CREATE TABLE IF NOT EXISTS `recognition_results` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `report_id` INT DEFAULT NULL,
  `predicted_category` VARCHAR(100) NOT NULL,
  `confidence_score` DECIMAL(5,2) DEFAULT NULL,
  `image_path` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_recognition_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recognition_report` FOREIGN KEY (`report_id`) REFERENCES `waste_reports` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Collection Records Table
CREATE TABLE IF NOT EXISTS `collection_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `report_id` INT NOT NULL,
  `scheduled_date` DATE NOT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_collection_report` FOREIGN KEY (`report_id`) REFERENCES `waste_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Report Status History Table
CREATE TABLE IF NOT EXISTS `report_status_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `report_id` INT NOT NULL,
  `old_status` VARCHAR(50) DEFAULT NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `changed_by` INT NOT NULL,
  `note` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_history_report` FOREIGN KEY (`report_id`) REFERENCES `waste_reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed initial categories only (no fake reports)
INSERT INTO `waste_categories` (`name`, `description`, `disposal_method`, `status`)
VALUES
  ('Plastic', 'Synthetic polymers such as bottles, food containers, wrappers, packaging, and jugs.', 'Clean and rinse containers, remove non-plastic caps if required, and place into the designated yellow/plastic recycling bin.', 'active'),
  ('Paper', 'Clean paper products including cardboard boxes, newspapers, office papers, magazines, and paper bags.', 'Keep dry and free from grease or food contamination. Flatten corrugated boxes to conserve space.', 'active'),
  ('Metal', 'Ferrous and non-ferrous metals such as aluminum beverage cans, tin food cans, foil, and small scrap metal items.', 'Rinse residue thoroughly from cans and containers before placing them in the metal recycling stream.', 'active'),
  ('Glass', 'Clear, amber, and green glass containers, bottles, and food jars.', 'Rinse thoroughly, remove bottle tops/corks, and handle carefully. Do not mix with ceramic or heat-resistant glass.', 'active'),
  ('Organic Waste', 'Biodegradable kitchen waste, food scraps, coffee grounds, eggshells, and garden trimmings.', 'Dispose of in designated compost bins or brown organic waste receptacles. Avoid plastic wrappers or non-compostable packaging.', 'active')
ON DUPLICATE KEY UPDATE `name`=`name`;
