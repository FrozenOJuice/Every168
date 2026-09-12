"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { preferencesInput } from "@168hours/contracts";
import { useMe } from "./me";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
export function PreferencesForm() {
  const me = useMe();
  const form = useZodForm(preferencesInput, me.preferences);
  const cache = useQueryClient();
  const [saved, setSaved] = useState(false);
  return (
    <section className="panel">
      <h2>Your preferences</h2>
      <Form
        form={form}
        onSubmit={async (input) => {
          await api.savePreferences(input);
          await cache.invalidateQueries();
          setSaved(true);
        }}
      >
        <Field
          name="timezone"
          label="Timezone"
          help="IANA name, for example America/Edmonton or Europe/London."
        />
        <button
          type="button"
          className="button"
          onClick={() =>
            form.setValue(
              "timezone",
              Intl.DateTimeFormat().resolvedOptions().timeZone,
              { shouldValidate: true },
            )
          }
        >
          Use this device’s timezone
        </button>
        <Field name="weekStartsOn" label="Week starts on" type="number">
          <option value="1">Monday</option>
          <option value="0">Sunday</option>
        </Field>
        <div className="form-grid">
          <Field name="weightUnit" label="Weight & strength load">
            <option value="kg">Kilograms (kg)</option>
            <option value="lb">Pounds (lb)</option>
          </Field>
          <Field name="distanceUnit" label="Distance">
            <option value="km">Kilometres (km)</option>
            <option value="mi">Miles (mi)</option>
          </Field>
        </div>
        <Submit>Save preferences</Submit>
        {saved && (
          <p role="status" className="success">
            Preferences saved.
          </p>
        )}
      </Form>
    </section>
  );
}
