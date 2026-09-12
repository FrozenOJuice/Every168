import { CategoriesPanel } from "@/features/categories/categories-panel";
import { PageHeading } from "@/components/ui/feedback";
import { PreferencesForm } from "@/features/identity/preferences-form";
export default function Settings() {
  return (
    <>
      <PageHeading
        title="Settings"
        description="Make this space work for you."
      />
      <div className="two-column">
        <PreferencesForm />
        <CategoriesPanel />
      </div>
    </>
  );
}
