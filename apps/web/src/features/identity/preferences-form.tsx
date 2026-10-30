"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { preferencesInput } from "@168hours/contracts";
import { useMe } from "./me";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
export function PreferencesForm() {
  const me = useMe();
  const version = useRef(me.preferences.version);
  const form = useZodForm(preferencesInput, me.preferences);
  const cache = useQueryClient();
  const [saved, setSaved] = useState(false);
  return (
    <section className="panel">
      <h2>Your preferences</h2>
      <Form
        form={form}
        onSubmit={async (input, key) => {
          const saved = await api.savePreferences(input, version.current, key);
          version.current = saved.version;
          form.reset(input);
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
          <Field name="weightUnit" label="Weight">
            <option value="kg">Kilograms (kg)</option>
            <option value="lb">Pounds (lb)</option>
          </Field>
          <Field name="distanceUnit" label="Distance">
            <option value="m">Metres (m)</option>
            <option value="km">Kilometres (km)</option>
            <option value="yd">Yards (yd)</option>
            <option value="mi">Miles (mi)</option>
          </Field>
        </div>
        <Field name="durationUnit" label="Fitness duration">
          <option value="min_sec">Minutes & seconds</option>
          <option value="s">Seconds (s)</option>
          <option value="min">Minutes (min)</option>
          <option value="h">Hours (h)</option>
        </Field>
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
