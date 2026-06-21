/**
 * Seed the database with reportable-matters categories.
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    key: "financial_fraud",
    labelEn: "Financial & Fraud",
    labelId: "Keuangan & Penipuan",
    sortOrder: 1,
  },
  {
    key: "corruption_conflict",
    labelEn: "Corruption-adjacent & Conflicts of Interest",
    labelId: "Korupsi & Konflik Kepentingan",
    sortOrder: 2,
  },
  {
    key: "health_safety_env",
    labelEn: "Health, Safety & Environment",
    labelId: "Kesehatan, Keselamatan & Lingkungan",
    sortOrder: 3,
  },
  {
    key: "workplace_conduct",
    labelEn: "Workplace Conduct",
    labelId: "Perilaku di Tempat Kerja",
    sortOrder: 4,
  },
  {
    key: "labor_human_rights",
    labelEn: "Labor & Human Rights",
    labelId: "Ketenagakerjaan & Hak Asasi Manusia",
    sortOrder: 5,
  },
  {
    key: "legal_regulatory",
    labelEn: "Legal & Regulatory Compliance",
    labelId: "Kepatuhan Hukum & Regulasi",
    sortOrder: 6,
  },
  {
    key: "data_it_confidentiality",
    labelEn: "Data, IT & Confidentiality",
    labelId: "Data, IT & Kerahasiaan Informasi",
    sortOrder: 7,
  },
  {
    key: "records_governance",
    labelEn: "Integrity of Records & Governance",
    labelId: "Integritas Catatan & Tata Kelola",
    sortOrder: 8,
  },
  {
    key: "other",
    labelEn: "Other",
    labelId: "Lainnya",
    sortOrder: 9,
  },
];

async function main() {
  console.log("Seeding categories...");

  // Deactivate any old categories not in the new list
  const newKeys = CATEGORIES.map((c) => c.key);
  await prisma.category.updateMany({
    where: { key: { notIn: newKeys } },
    data: { isActive: false },
  });

  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { key: cat.key },
      update: { labelEn: cat.labelEn, labelId: cat.labelId, sortOrder: cat.sortOrder, isActive: true },
      create: { ...cat, isActive: true },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
