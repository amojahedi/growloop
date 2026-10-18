import type { Metadata } from "next";
import { GUIDE } from "@/content/help/guide";
import { GuideView } from "@/features/help/guide-view";

export const metadata: Metadata = { title: GUIDE.title, description: GUIDE.intro };

export default function GuidePage() {
  return <GuideView guide={GUIDE} />;
}
