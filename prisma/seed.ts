/**
 * Seed the database with reportable-matters categories.
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    key: "fraud_penggelapan",
    labelEn: "Fraud dan Penggelapan",
    labelId: "Fraud dan Penggelapan",
    sortOrder: 1,
  },
  {
    key: "suap_gratifikasi_korupsi",
    labelEn: "Suap, Gratifikasi, dan Korupsi",
    labelId: "Suap, Gratifikasi, dan Korupsi",
    sortOrder: 2,
  },
  {
    key: "konflik_kepentingan",
    labelEn: "Konflik Kepentingan",
    labelId: "Konflik Kepentingan",
    sortOrder: 3,
  },
  {
    key: "pencurian_material_aset",
    labelEn: "Pencurian Material dan Aset Perusahaan",
    labelId: "Pencurian Material dan Aset Perusahaan",
    sortOrder: 4,
  },
  {
    key: "penyalahgunaan_wewenang",
    labelEn: "Penyalahgunaan Wewenang",
    labelId: "Penyalahgunaan Wewenang",
    sortOrder: 5,
  },
  {
    key: "pelanggaran_kode_etik",
    labelEn: "Pelanggaran Kode Etik",
    labelId: "Pelanggaran Kode Etik",
    sortOrder: 6,
  },
  {
    key: "pelecehan_perundungan_diskriminasi",
    labelEn: "Pelecehan, Perundungan, dan Diskriminasi",
    labelId: "Pelecehan, Perundungan, dan Diskriminasi",
    sortOrder: 7,
  },
  {
    key: "pelanggaran_k3_keselamatan",
    labelEn: "Pelanggaran K3 dan Keselamatan Proyek",
    labelId: "Pelanggaran K3 dan Keselamatan Proyek",
    sortOrder: 8,
  },
  {
    key: "pelanggaran_lingkungan",
    labelEn: "Pelanggaran Lingkungan",
    labelId: "Pelanggaran Lingkungan",
    sortOrder: 9,
  },
  {
    key: "kebocoran_informasi",
    labelEn: "Kebocoran Informasi Perusahaan",
    labelId: "Kebocoran Informasi Perusahaan",
    sortOrder: 10,
  },
  {
    key: "pelanggaran_hukum_kepatuhan",
    labelEn: "Pelanggaran Hukum dan Kepatuhan",
    labelId: "Pelanggaran Hukum dan Kepatuhan",
    sortOrder: 11,
  },
  {
    key: "other",
    labelEn: "Lain-lain yang Berpotensi Merugikan Perusahaan",
    labelId: "Lain-lain yang Berpotensi Merugikan Perusahaan",
    sortOrder: 12,
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
