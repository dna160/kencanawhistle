"use client";

import { useState, useRef, FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { clsx } from "clsx";

type Category = { id: string; key: string; labelEn: string; labelId: string };

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) return [];
  return res.json();
}

export default function ReportPage() {
  const t = useTranslations("reporter");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tac = useTranslations("accessCode");
  const locale = useLocale();

  // Pick the right label column based on active locale
  const catLabel = (c: { labelEn: string; labelId: string }) =>
    locale === "id" ? c.labelId : c.labelEn;

  const [mode, setMode] = useState<"anonymous" | "named">("anonymous");
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoaded, setCatLoaded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    accessCode: string;
    referenceCode: string;
  } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const ensureCatsLoaded = async () => {
    if (!catLoaded) {
      const cats = await fetchCategories();
      setCategories(cats);
      setCatLoaded(true);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const data = new FormData(e.currentTarget);
    data.set("mode", mode);

    try {
      const res = await fetch("/api/reports", { method: "POST", body: data });
      if (res.status === 429) { setError(te("tooManyRequests")); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? te("generic"));
        return;
      }
      const result = await res.json();
      setSubmitted({ accessCode: result.accessCode, referenceCode: result.referenceCode });
    } catch {
      setError(te("generic"));
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    if (!submitted) return;
    navigator.clipboard.writeText(submitted.accessCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  // ── Access code confirmation screen ──────────────────────────────
  if (submitted) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-6">
          <div className="text-4xl">✓</div>
          <h1 className="text-2xl font-bold text-green-800">{tac("title")}</h1>
          <p className="text-green-700 text-sm">{tac("instruction")}</p>
          <div className="bg-white border border-green-300 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              {tac("referenceLabel")}
            </p>
            <p className="font-mono text-lg font-semibold">{submitted.referenceCode}</p>
          </div>
          <div className="bg-white border-2 border-brand-500 rounded-xl p-6">
            <p className="font-mono text-2xl font-bold tracking-widest text-brand-700 break-all">
              {submitted.accessCode}
            </p>
          </div>
          <button
            onClick={copyCode}
            className="w-full bg-brand-600 text-white rounded-xl py-3 font-semibold hover:bg-brand-700 transition-colors"
          >
            {codeCopied ? tac("codeCopied") : tac("copy")}
          </button>
          <a href="/follow-up" className="block text-sm text-brand-600 underline">
            {tac("followUpButton")}
          </a>
        </div>
      </main>
    );
  }

  // ── Report submission form ────────────────────────────────────────
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("headline")}</h1>
        <LocaleSwitcher />
      </div>

      <p className="text-gray-600 mb-8 text-sm leading-relaxed">{t("subheadline")}</p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
        {t("hrNote")}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">

        {/* Mode toggle */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-700 mb-3">{t("modeLabel")}</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["anonymous", "named"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={clsx(
                  "rounded-xl border-2 p-4 text-left transition-all",
                  mode === m
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                )}
              >
                <div className="font-semibold mb-1">
                  {m === "anonymous" ? tc("anonymous") : tc("named")}
                </div>
                <div className="text-xs leading-relaxed">
                  {m === "anonymous" ? t("anonymousHint") : t("namedHint")}
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Named: consent + identity */}
        {mode === "named" && (
          <div className="space-y-4 bg-blue-50 rounded-xl p-4 border border-blue-200">
            <label className="flex gap-3 items-start cursor-pointer">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-1 min-h-0 h-5 w-5 rounded border-gray-300"
              />
              <span className="text-sm text-blue-800">{t("consentLabel")}</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="reporterName"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact (email or phone)
              </label>
              <input
                type="text"
                name="reporterContact"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="Email or phone number"
              />
            </div>
          </div>
        )}

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
            {t("categoryLabel")} *
          </label>
          <select
            id="category"
            name="categoryKey"
            required
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            onFocus={ensureCatsLoaded}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
          >
            <option value="">{t("categoryPlaceholder")}</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>{catLabel(c)}</option>
            ))}
          </select>

          {/* Show description hint for selected category */}
          {selectedCategory && selectedCategory !== "other" && (
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              {(locale === "id" ? {
                financial_fraud:        "Penyalahgunaan dana, faktur palsu, pencurian aset, penipuan biaya, pelaporan keuangan palsu",
                corruption_conflict:    "Suap, kickback, kepentingan pribadi yang tidak diungkapkan, pengaruh tidak wajar, pengaturan penawaran",
                health_safety_env:      "Kondisi kerja tidak aman, kecelakaan tidak dilaporkan, pelanggaran lingkungan, pelanggaran bahan berbahaya",
                workplace_conduct:      "Pelecehan, diskriminasi, intimidasi, penyalahgunaan wewenang, pembalasan terhadap karyawan",
                labor_human_rights:     "Kerja paksa/anak, pencurian upah, jam kerja ilegal, pelanggaran kebebasan berserikat",
                legal_regulatory:       "Pelanggaran regulasi, praktik ilegal, pelanggaran izin, ketidakpatuhan sanksi",
                data_it_confidentiality:"Akses data tidak sah, pelanggaran privasi, penyalahgunaan rahasia dagang, insiden keamanan IT",
                records_governance:     "Pemalsuan dokumen, manipulasi audit, penghilangan bukti, pengungkapan yang menyesatkan",
              } : {
                financial_fraud:        "Misappropriation of funds, false invoicing, asset theft, expense fraud, financial misreporting",
                corruption_conflict:    "Bribery, kickbacks, undisclosed personal interests, undue influence, bid-rigging",
                health_safety_env:      "Unsafe working conditions, unreported accidents, environmental violations, hazardous material breaches",
                workplace_conduct:      "Harassment, discrimination, bullying, abuse of authority, retaliation against employees",
                labor_human_rights:     "Forced/child labor, wage theft, illegal working hours, freedom-of-association violations",
                legal_regulatory:       "Regulatory breaches, illegal practices, permit violations, sanctions non-compliance",
                data_it_confidentiality:"Unauthorized data access, privacy breaches, trade-secret misuse, IT security incidents",
                records_governance:     "Document falsification, audit manipulation, suppression of evidence, misleading disclosures",
              } as Record<string, string>)[selectedCategory]}
            </p>
          )}

          {/* "Other" — reveal custom description field */}
          {selectedCategory === "other" && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("categoryOtherLabel")} *
              </label>
              <input
                type="text"
                name="categoryOther"
                required
                placeholder={t("categoryOtherPlaceholder")}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
              />
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
            {t("descriptionLabel")} *
          </label>
          <textarea
            id="description"
            name="description"
            required
            minLength={20}
            rows={6}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base resize-y min-h-[8rem]"
            placeholder={t("descriptionPlaceholder")}
          />
        </div>

        {/* Department / subject — full width to avoid alignment issues */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("subjectLabel")}
          </label>
          <input
            type="text"
            name="subject"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
            placeholder="e.g. Finance department, Warehouse 3"
          />
        </div>

        {/* Date — own row, no longer misaligned next to the long department label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("dateLabel")}
          </label>
          <input
            type="text"
            name="incidentDate"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
            placeholder="e.g. March 2025, last week, around mid-April"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("locationLabel")}
          </label>
          <input
            type="text"
            name="location"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
            placeholder="e.g. Factory floor B, Head office"
          />
        </div>

        {/* Commissioner flag */}
        <div className="space-y-3">
          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="checkbox"
              name="subjectIsCommissioner"
              className="mt-1 min-h-0 h-5 w-5 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">{t("commissionerFlag")}</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("commissionerName")}
            </label>
            <input
              type="text"
              name="commissionerName"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
            />
          </div>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t("attachmentsLabel")}
          </label>
          <p className="text-xs text-gray-500 mb-2">{t("attachmentsHint")}</p>
          <input
            type="file"
            name="attachments"
            multiple
            accept="image/*,application/pdf,text/plain,.docx,video/mp4"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white rounded-xl py-4 text-lg font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {submitting ? t("submitting") : t("submitButton")}
        </button>
      </form>
    </main>
  );
}
