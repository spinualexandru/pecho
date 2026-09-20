import React from "react";
import BaseLayout from "@/layouts/BaseLayout";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { MeetingProvider } from "@/providers/MeetingProvider";
/* import { TanStackRouterDevtools } from '@tanstack/react-router-devtools' */

function Root() {
  return (
    <MeetingProvider>
      <BaseLayout>
        <Outlet />
        {/* Uncomment the following line to enable the router devtools */}
        {/* <TanStackRouterDevtools /> */}
      </BaseLayout>
    </MeetingProvider>
  );
}

export const Route = createRootRoute({
  component: Root,
});
