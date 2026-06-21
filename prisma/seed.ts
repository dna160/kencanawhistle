/**
 * Seed the database with default reportable-matters categories.
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { key: "fraud",        labelEn: "Fraud / Financial Irregularity",  labelId: "Penipuan / Penyimpangan Keuangan",  sortOrder: 1 },
  { key: "bribery",      labelEn: "Bribery & Corruption",            labelId: "Suap & Korupsi",                   sortOrder: 2 },
  { key: "theft",        labelEn: "Theft / Asset Misuse",            labelId: "Pencurian / Penyalahgunaan Aset",  sortOrder: 3 },
  { key: "safety",       labelEn: "Safety & Environmental Violations",labelId: "Pelanggaran K3 & Lingkungan",     sortOrder: 4 },
  { key: "harassment",   labelEn: "Harassment / Discrimination",     labelId: "Pelecehan / Diskriminasi",         sortOrder: 5 },
  { key: "abuse",        labelEn: "Abuse of Authority",              labelId: "Penyalahgunaan Wewenang",          sortOrder: 6 },
  { key: "conflict",     labelEn: "Conflict of Interest",            labelId: "Konflik Kepentingan",              sortOrder: 7 },
  { key: "data_breach",  labelEn: "Data / Privacy Breach",           labelId: "Pelanggaran Data / Privasi",      sortOrder: 8 },
  { key: "other",        labelEn: "Other",                           labelId: "Lainnya",                          sortOrder: 9 },
];

async function main() {
  console.log("Seeding categories...");
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { key: cat.key },
      update: { labelEn: cat.labelEn, labelId: cat.labelId, sortOrder: cat.sortOrder },
      create: cat,
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
