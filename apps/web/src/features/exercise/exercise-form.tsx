"use client";
import { useQueryClient } from "@tanstack/react-query";
import { exerciseInput, type Exercise } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
export function ExerciseForm({
  exercise,
  onSaved,
}: {
  exercise?: Exercise;
  onSaved: () => void;
}) {
  const form = useZodForm(exerciseInput, exercise ?? { name: "", notes: null });
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        const saved = exercise
          ? await api.updateExercise(exercise.id, v, exercise.version, key)
          : await api.createExercise(v, key);
        await cache.invalidateQueries({ queryKey: ["exercises"] });
        await cache.invalidateQueries({ queryKey: ["progress", saved.id] });
        onSaved();
      }}
    >
      <Field name="name" label="Exercise name" />
      <Field name="notes" label="Notes (optional)" type="textarea" optional />
      <Submit>{exercise ? "Save exercise" : "Create exercise"}</Submit>
    </Form>
  );
}
