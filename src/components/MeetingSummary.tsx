import { useTranslation } from "react-i18next";
import type { MeetingSummary as Result } from "@/helpers/summary-contract";
export function MeetingSummary({ result }: { result: Result }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4" data-testid="structured-summary">
      <p className="whitespace-pre-wrap">{result.summary}</p>
      <h3 className="font-semibold">{t("Decisions")}</h3>
      {result.decisions.length ? (
        <ul className="list-disc space-y-2 pl-5">
          {result.decisions.map((decision, index) => (
            <li key={index}>{decision}</li>
          ))}
        </ul>
      ) : (
        <p>{t("No decisions recorded")}</p>
      )}
      <h3 className="font-semibold">{t("Action items")}</h3>
      {result.actionItems.length ? (
        <ul className="list-disc space-y-2 pl-5">
          {result.actionItems.map((item, index) => (
            <li key={index}>
              <p>{item.task}</p>
              <p className="text-sm text-muted-foreground">
                {t("Owner")}: {item.owner || t("Not specified")} ·{" "}
                {t("Due date")}: {item.dueDate || t("Not specified")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("No action items recorded")}</p>
      )}
    </div>
  );
}
