"use client";
import { useCommand, CommandError } from "@/lib/use-command";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { categoryInput, type Category } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { Empty, ErrorState, Loading } from "@/components/ui/feedback";
function CategoryForm({
  item,
  onSaved,
}: {
  item?: Category;
  onSaved: () => void;
}) {
  const form = useZodForm(
    categoryInput,
    item ?? { name: "", color: null, icon: null },
  );
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        if (item) await api.updateCategory(item.id, v, item.version, key);
        else await api.createCategory(v, key);
        await cache.invalidateQueries({ queryKey: ["categories"] });
        await cache.invalidateQueries({ queryKey: ["week"] });
        await cache.invalidateQueries({ queryKey: ["dashboard"] });
        onSaved();
      }}
    >
      <Field name="name" label="Category name" />
      <Field
        name="color"
        label="Color (optional hex)"
        optional
        help="For example #196b57. Names always appear alongside colors."
      />
      <Submit>{item ? "Save category" : "Create category"}</Submit>
    </Form>
  );
}
export function CategoriesPanel() {
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
  const cache = useQueryClient();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const archive = useCommand({
    mutationFn: (item: { id: string; version: number }, key: string) =>
      api.archiveCategory(item.id, item.version, key),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["categories"] }),
  });
  return (
    <section className="panel">
      <div className="row between">
        <div>
          <h2>Life categories</h2>
          <p className="muted text-small">
            Give the different parts of your week a name.
          </p>
        </div>
        <button className="button" onClick={() => setEditing("new")}>
          Add category
        </button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <Empty>
          Start with Work, Exercise, Learning, or anything that matters to you.
        </Empty>
      ) : (
        <ul className="record-list">
          {query.data.map((c) => (
            <li key={c.id}>
              <span className="category-label">
                <span
                  className="dot"
                  style={{ background: c.color ?? "var(--primary)" }}
                />
                {c.name}
                {c.archivedAt && <small>Archived</small>}
              </span>
              <div className="row">
                <button className="button" onClick={() => setEditing(c)}>
                  Edit
                </button>
                {!c.archivedAt && (
                  <button
                    className="button"
                    disabled={archive.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          "Archive this category? Existing records will keep their category.",
                        )
                      )
                        archive.mutate(c);
                    }}
                  >
                    Archive
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <CommandError command={archive} />
      {editing && (
        <Dialog
          title={editing === "new" ? "Add category" : "Edit category"}
          onClose={() => setEditing(null)}
        >
          <CategoryForm
            item={editing === "new" ? undefined : editing}
            onSaved={() => setEditing(null)}
          />
        </Dialog>
      )}
    </section>
  );
}
