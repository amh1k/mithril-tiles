"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  wordPackMutationSchema,
  type WordPackMutation,
} from "@/features/admin/word-pack-management";
import type { WordPack } from "@/features/rooms/word-pack";
import { frontendApiErrorSchema } from "@/lib/api/errors";

type WordPackDashboardProps = {
  initialWordPacks: WordPack[];
};

type FormMode = "create" | "edit" | null;

const emptyForm: WordPackMutation = {
  name: "",
  slug: "",
  description: "",
  is_active: true,
};

export function WordPackDashboard({
  initialWordPacks,
}: WordPackDashboardProps) {
  const [wordPacks, setWordPacks] = useState(initialWordPacks);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingPackID, setEditingPackID] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<WordPackMutation>(emptyForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPackID, setDeletingPackID] = useState<string | null>(null);

  function openCreateForm() {
    setFormMode("create");
    setEditingPackID(null);
    setFormValues(emptyForm);
    setErrorMessage(null);
  }

  function openEditForm(wordPack: WordPack) {
    setFormMode("edit");
    setEditingPackID(wordPack.id);
    setFormValues({
      name: wordPack.name,
      slug: wordPack.slug,
      description: wordPack.description,
      is_active: wordPack.is_active,
    });
    setErrorMessage(null);
  }

  function closeForm() {
    if (!isSaving) {
      setFormMode(null);
      setEditingPackID(null);
      setErrorMessage(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedValues = wordPackMutationSchema.safeParse(formValues);
    if (!parsedValues.success) {
      setErrorMessage(
        parsedValues.error.issues[0]?.message ?? "Check the form values.",
      );
      return;
    }

    const isEditing = formMode === "edit" && editingPackID !== null;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        isEditing
          ? `/api/admin/word-packs/${editingPackID}`
          : "/api/admin/word-packs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(parsedValues.data),
        },
      );
      const responseBody = await response.json().catch(() => undefined);
      if (!response.ok) {
        setErrorMessage(readErrorMessage(responseBody));
        return;
      }

      const createdOrUpdatedPack = responseBody?.word_pack as
        WordPack | undefined;
      if (!createdOrUpdatedPack) {
        setErrorMessage("The archive returned an invalid word pack.");
        return;
      }

      setWordPacks((currentWordPacks) =>
        isEditing
          ? currentWordPacks.map((wordPack) =>
              wordPack.id === createdOrUpdatedPack.id
                ? createdOrUpdatedPack
                : wordPack,
            )
          : [createdOrUpdatedPack, ...currentWordPacks],
      );
      setFormMode(null);
      setEditingPackID(null);
      setFormValues(emptyForm);
    } catch {
      setErrorMessage("The word pack service is temporarily unavailable.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(wordPack: WordPack) {
    if (!window.confirm(`Delete “${wordPack.name}”? This cannot be undone.`)) {
      return;
    }

    setDeletingPackID(wordPack.id);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/admin/word-packs/${wordPack.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setErrorMessage(
          readErrorMessage(await response.json().catch(() => undefined)),
        );
        return;
      }
      setWordPacks((currentWordPacks) =>
        currentWordPacks.filter(
          (currentWordPack) => currentWordPack.id !== wordPack.id,
        ),
      );
    } catch {
      setErrorMessage("The word pack service is temporarily unavailable.");
    } finally {
      setDeletingPackID(null);
    }
  }

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button
          className="h-10 bg-[#2b1e12] px-4 text-[#bba88d] hover:bg-[#5d542b]"
          onClick={openCreateForm}
          type="button"
        >
          <Plus aria-hidden="true" />
          Create word pack
        </Button>
      </div>

      {errorMessage && (
        <p
          className="mb-4 rounded-lg border border-[#946440] bg-[#2b1e12]/90 px-4 py-3 text-sm text-[#f0d9b5]"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {formMode && (
        <Card className="mb-6 border border-[#946440]/70 bg-[#bba88d]/95 text-[#2b1e12] shadow-[0_12px_32px_rgba(43,30,18,0.2)]">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle>
              {formMode === "create" ? "Create word pack" : "Edit word pack"}
            </CardTitle>
            <Button
              className="text-[#5d542b] hover:bg-[#946440]/20"
              onClick={closeForm}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
              <span className="sr-only">Close form</span>
            </Button>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <Field
                label="Name"
                name="name"
                value={formValues.name}
                onChange={(name) =>
                  setFormValues((values) => ({ ...values, name }))
                }
              />
              <Field
                label="Slug"
                name="slug"
                value={formValues.slug}
                onChange={(slug) =>
                  setFormValues((values) => ({ ...values, slug }))
                }
              />
              <div className="grid gap-2">
                <Label htmlFor="word-pack-description">Description</Label>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-[#946440]/70 bg-[#f4e7c8]/65 px-3 py-2 text-sm text-[#2b1e12] outline-none placeholder:text-[#5d542b]/70 focus:border-[#5d542b] focus:ring-2 focus:ring-[#946440]/35"
                  id="word-pack-description"
                  maxLength={500}
                  onChange={(event) =>
                    setFormValues((values) => ({
                      ...values,
                      description: event.target.value,
                    }))
                  }
                  value={formValues.description}
                />
              </div>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  checked={formValues.is_active}
                  className="size-4 accent-[#5d542b]"
                  onChange={(event) =>
                    setFormValues((values) => ({
                      ...values,
                      is_active: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Make this word pack available in lobbies
              </label>
              <div className="flex justify-end gap-3">
                <Button
                  className="border-[#946440] text-[#5d542b] hover:bg-[#946440]/20"
                  onClick={closeForm}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#2b1e12] text-[#bba88d] hover:bg-[#5d542b]"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving && (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  )}
                  {formMode === "create" ? "Create pack" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {wordPacks.length === 0 ? (
        <Card className="border border-dashed border-[#946440]/70 bg-[#bba88d]/65 text-center text-[#5d542b]">
          <CardContent className="py-10">
            No word packs have been created yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wordPacks.map((wordPack) => (
            <WordPackCard
              deleting={deletingPackID === wordPack.id}
              key={wordPack.id}
              onDelete={() => void handleDelete(wordPack)}
              onEdit={() => openEditForm(wordPack)}
              wordPack={wordPack}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Field({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = `word-pack-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        className="border-[#946440]/70 bg-[#f4e7c8]/65 text-[#2b1e12] focus-visible:border-[#5d542b]"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

function WordPackCard({
  deleting,
  onDelete,
  onEdit,
  wordPack,
}: {
  deleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  wordPack: WordPack;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-t-[6rem] border border-[#946440]/75 bg-[linear-gradient(145deg,rgba(244,231,200,0.9),rgba(187,168,141,0.82)_45%,rgba(148,100,64,0.58)),url('/textures/parchment-background.png')] bg-cover text-[#2b1e12] shadow-[0_16px_32px_rgba(43,30,18,0.28)] transition duration-300 before:pointer-events-none before:absolute before:inset-2 before:rounded-t-[5.5rem] before:border before:border-[#5d542b]/30 after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_top_left,rgba(43,30,18,0.24),transparent_27%),radial-gradient(circle_at_bottom_right,rgba(43,30,18,0.2),transparent_29%)] hover:-translate-y-1 hover:shadow-[0_22px_42px_rgba(43,30,18,0.38)]">
      <CardHeader className="relative z-10 pt-7">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${wordPack.is_active ? "border-[#6e6c34]/60 bg-[#6e6c34]/15 text-[#394017]" : "border-[#946440]/60 bg-[#946440]/15 text-[#5d3c28]"}`}
          >
            {wordPack.is_active ? "Active" : "Inactive"}
          </span>
          <div className="flex gap-1">
            <Button
              aria-label={`Edit ${wordPack.name}`}
              className="text-[#5d542b] hover:bg-[#946440]/20"
              onClick={onEdit}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              aria-label={`Delete ${wordPack.name}`}
              className="text-[#763a2b] hover:bg-[#763a2b]/15"
              disabled={deleting}
              onClick={onDelete}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              {deleting ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        <CardTitle className="mt-3 text-xl">{wordPack.name}</CardTitle>
        <p className="font-mono text-xs text-[#5d542b]">/{wordPack.slug}</p>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="mb-4 flex items-center gap-2 text-[#946440]" aria-hidden="true">
          <span className="h-px flex-1 bg-current/50" />
          <span className="size-1.5 rotate-45 border border-current" />
          <span className="h-px flex-1 bg-current/50" />
        </div>
        <p className="min-h-12 text-sm leading-6 text-[#3b2818]">
          {wordPack.description || "No description has been recorded."}
        </p>
      </CardContent>
    </Card>
  );
}

function readErrorMessage(body: unknown): string {
  const parsedError = frontendApiErrorSchema.safeParse(body);
  return parsedError.success
    ? parsedError.data.message
    : "The request could not be completed.";
}
