-- =============================================================
-- Super Admin Seed
-- Run this SQL to create a super admin with full module access.
-- Username: admin
-- Password: admin123
-- =============================================================

INSERT INTO staff (id, full_name, username, password, role, active, temp_password, temp_expires_at, permissions, created_at)
VALUES (
  gen_random_uuid(),
  'Jack Daniels',
  'autocare@admin',
  '$2b$10$phwayyWyZaHzKHYwzU.mtuOMg3hsDTSQ1Ub6Ag.MkL3OHvKssKklu',
  'Admin',
  true,
  true,
  null,
  '["Appointments","Service Tracking","Invoices","Customers","Vehicles","Service Types","Staff"]',
  NOW()
)
ON CONFLICT (username) DO NOTHING;