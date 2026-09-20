import { useTranslation } from "react-i18next";
import { Moon } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { toggleTheme } from "@/helpers/theme_helpers";

export default function ToggleTheme() {
  const { t } = useTranslation();
  return (
    <Button
      aria-label={t("Toggle theme")}
      onClick={() => {
        toggleTheme().catch((error) =>
          console.error("Could not toggle theme", error),
        );
      }}
      size="icon"
    >
      <Moon size={16} />
    </Button>
  );
}
