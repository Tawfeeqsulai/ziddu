-- Additive migration: creates the walkins table used by /api/walkins.
-- Run manually against the shared database after review. Do NOT use
-- `prisma db push --schema prisma/schema.shared.prisma`; that schema only
-- models a subset of the tables and push could try to drop the rest.

CREATE TABLE IF NOT EXISTS `walkins` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vendor_id` INT NOT NULL,
  `end_user_id` INT NULL,
  `app_user_id` VARCHAR(64) NOT NULL,
  `latitude` DECIMAL(10, 7) NOT NULL,
  `longitude` DECIMAL(10, 7) NOT NULL,
  `distance_meters` INT NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `walkins_vendor_id_created_at_idx` (`vendor_id`, `created_at`),
  INDEX `walkins_app_user_id_vendor_id_created_at_idx` (`app_user_id`, `vendor_id`, `created_at`),
  INDEX `walkins_end_user_id_idx` (`end_user_id`),
  CONSTRAINT `walkins_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `walkins_end_user_id_fkey` FOREIGN KEY (`end_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Vendor-side example: walk-ins per day for one vendor.
-- SELECT DATE(created_at) AS day, COUNT(*) AS walkins
-- FROM walkins WHERE vendor_id = ? GROUP BY DATE(created_at) ORDER BY day DESC;
