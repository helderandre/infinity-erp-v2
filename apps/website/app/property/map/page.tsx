"use client";

import dynamic from "next/dynamic";

// maplibre-gl touches window/document at import time — load client-only.
const PropertyMapPage = dynamic(
  () => import("@/app/pages/PropertyMapPage").then((m) => m.PropertyMapPage),
  { ssr: false },
);

export default function Page() {
  return <PropertyMapPage />;
}
