"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const router = useRouter();

  const switchLocale = () => {
    // Toggle between en and id by reading the current cookie
    const current = document.cookie
      .split("; ")
      .find((row) => row.startsWith("locale="))
      ?.split("=")[1] ?? "en";

    const next = current === "en" ? "id" : "en";
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  };

  return (
    <button
      onClick={switchLocale}
      className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
      title="Switch language"
    >
      {t("switch")}
    </button>
  );
}
