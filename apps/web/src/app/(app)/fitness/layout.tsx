import { FitnessExerciseWorkspace } from "@/features/fitness/fitness-exercise-workspace";
import { FitnessNavigationProvider } from "@/features/fitness/fitness-navigation";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FitnessNavigationProvider>
      <FitnessExerciseWorkspace>{children}</FitnessExerciseWorkspace>
    </FitnessNavigationProvider>
  );
}
