-- Seed: reportable-matters categories (8 groups + Other)
-- Idempotent: ON CONFLICT DO UPDATE so safe to re-run.

INSERT INTO categories (id, key, "labelEn", "labelId", "isActive", "sortOrder")
VALUES
  (gen_random_uuid(), 'financial_fraud',        'Financial & Fraud',                            'Keuangan & Penipuan',                       true, 1),
  (gen_random_uuid(), 'corruption_conflict',    'Corruption-adjacent & Conflicts of Interest',  'Korupsi & Konflik Kepentingan',             true, 2),
  (gen_random_uuid(), 'health_safety_env',      'Health, Safety & Environment',                 'Kesehatan, Keselamatan & Lingkungan',       true, 3),
  (gen_random_uuid(), 'workplace_conduct',      'Workplace Conduct',                            'Perilaku di Tempat Kerja',                  true, 4),
  (gen_random_uuid(), 'labor_human_rights',     'Labor & Human Rights',                         'Ketenagakerjaan & Hak Asasi Manusia',       true, 5),
  (gen_random_uuid(), 'legal_regulatory',       'Legal & Regulatory Compliance',                'Kepatuhan Hukum & Regulasi',                true, 6),
  (gen_random_uuid(), 'data_it_confidentiality','Data, IT & Confidentiality',                   'Data, IT & Kerahasiaan Informasi',          true, 7),
  (gen_random_uuid(), 'records_governance',     'Integrity of Records & Governance',            'Integritas Catatan & Tata Kelola',          true, 8),
  (gen_random_uuid(), 'other',                  'Other',                                        'Lainnya',                                   true, 9)
ON CONFLICT (key) DO UPDATE SET
  "labelEn"   = EXCLUDED."labelEn",
  "labelId"   = EXCLUDED."labelId",
  "isActive"  = true,
  "sortOrder" = EXCLUDED."sortOrder";
