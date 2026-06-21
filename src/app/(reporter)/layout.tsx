/**
 * Reporter route group layout.
 *
 * CRITICAL anonymity constraints enforced here:
 * - No analytics scripts loaded
 * - No tracking pixels
 * - Kiosk mode: clear session storage on unload
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Speak Up | Bicara",
  robots: { index: false, follow: false },
};

export default function ReporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Kiosk-mode cleanup: clear sessionStorage when the page unloads */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener('pagehide', function() { sessionStorage.clear(); });`,
        }}
      />
      {children}
    </div>
  );
}
