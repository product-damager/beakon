import { ExternalRoadmap } from "@/components/ExternalRoadmap";

// Read-only, external-only projection. In production this route would read the
// `external_roadmap` Supabase view (see supabase/schema.sql), which excludes
// internal notes, scores, owners, and internal-only initiatives at the data layer.
export default function SharePage() {
  return <ExternalRoadmap />;
}
