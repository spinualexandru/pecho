import React from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import NavigationMenu from "@/components/template/NavigationMenu";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <DragWindowRegion title="pecho" />
      <NavigationMenu />
      <main className="app-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {children}
      </main>
    </div>
  );
}
