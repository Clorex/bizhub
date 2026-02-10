// FILE: src/app/vendor/smartmatch/page.tsx
import { Suspense } from "react";
import ClientPage from "./page-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientPage />
    </Suspense>
  );
}