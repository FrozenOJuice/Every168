import { ChangePasswordForm } from "@/features/identity/account-security-forms";
import { CategoriesPanel } from "@/features/categories/categories-panel";
import { PageHeading } from "@/components/ui/feedback";
import { PreferencesForm } from "@/features/identity/preferences-form";
export default function Settings() {
  return (
    <>
      <PageHeading
        title="Settings"
        description="Your timezone, units, and planning categories."
      />
      <div className="two-column">
        <PreferencesForm />
        <CategoriesPanel />
        <ChangePasswordForm />
      </div>
    </>
  );
}
