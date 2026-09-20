import { useTranslation } from "react-i18next";
import type { TranslationKey } from "@/localization/i18n";

// Service and OS diagnostics retain their original technical wording; the
// explanation and recovery action remain readable in the chosen UI language.
export function LocalizedError({
  message,
  detail,
}: {
  message: TranslationKey;
  detail?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="text-sm text-destructive">
      <p>{t(message)}</p>
      {detail && (
        <details>
          <summary>{t("Technical details")}</summary>
          <p className="break-words">{detail}</p>
        </details>
      )}
    </div>
  );
}
