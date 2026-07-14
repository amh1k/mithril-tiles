"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Bot, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  botProfileMutationSchema,
  botProfilesResponseSchema,
  type BotProfile,
  type BotProfileMutation,
} from "@/features/rooms/bot-profiles";
import { frontendApiErrorSchema } from "@/lib/api/errors";

type FormMode = "create" | "edit" | null;

type BotProfileForm = Omit<BotProfileMutation, "avatar_url"> & {
  avatar_url: string;
};

const emptyForm: BotProfileForm = {
  name: "",
  difficulty: "normal",
  behavior_style: "balanced",
  avatar_url: "",
  is_active: true,
};

export function BotProfileDashboard() {
  const [botProfiles, setBotProfiles] = useState<BotProfile[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingBotID, setEditingBotID] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<BotProfileForm>(emptyForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingBotID, setDeletingBotID] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBotProfiles() {
      try {
        const response = await fetch("/api/admin/bot-profiles", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const parsedResponse = botProfilesResponseSchema.safeParse(
          await response.json().catch(() => undefined),
        );
        if (!response.ok || !parsedResponse.success) {
          throw new Error("The bot profiles could not be loaded.");
        }
        setBotProfiles(parsedResponse.data.bot_profiles);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("failed");
        }
      }
    }

    void loadBotProfiles();
    return () => controller.abort();
  }, []);

  function openCreateForm() {
    setFormMode("create");
    setEditingBotID(null);
    setFormValues(emptyForm);
    setErrorMessage(null);
  }

  function openEditForm(botProfile: BotProfile) {
    setFormMode("edit");
    setEditingBotID(botProfile.id);
    setFormValues({
      name: botProfile.name,
      difficulty: botProfile.difficulty as BotProfileMutation["difficulty"],
      behavior_style: botProfile.behavior_style,
      avatar_url: botProfile.avatar_url ?? "",
      is_active: botProfile.is_active,
    });
    setErrorMessage(null);
  }

  function closeForm() {
    if (!isSaving) {
      setFormMode(null);
      setEditingBotID(null);
      setErrorMessage(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedValues = botProfileMutationSchema.safeParse({
      ...formValues,
      avatar_url: formValues.avatar_url.trim() || null,
    });
    if (!parsedValues.success) {
      setErrorMessage(parsedValues.error.issues[0]?.message ?? "Check the bot details.");
      return;
    }

    const isEditing = formMode === "edit" && editingBotID !== null;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        isEditing ? `/api/admin/bot-profiles/${editingBotID}` : "/api/admin/bot-profiles",
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
      const botProfile = responseBody?.bot_profile as BotProfile | undefined;
      if (!botProfile) {
        setErrorMessage("The archive returned an invalid bot profile.");
        return;
      }
      setBotProfiles((currentProfiles) =>
        isEditing
          ? currentProfiles.map((profile) => profile.id === botProfile.id ? botProfile : profile)
          : [...currentProfiles, botProfile].sort((left, right) => left.name.localeCompare(right.name)),
      );
      setFormMode(null);
      setEditingBotID(null);
      setFormValues(emptyForm);
    } catch {
      setErrorMessage("The bot profile service is temporarily unavailable.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(botProfile: BotProfile) {
    if (!window.confirm(`Delete “${botProfile.name}”? Game history will prevent removal if it uses this bot.`)) {
      return;
    }
    setDeletingBotID(botProfile.id);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/admin/bot-profiles/${botProfile.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setErrorMessage(readErrorMessage(await response.json().catch(() => undefined)));
        return;
      }
      setBotProfiles((currentProfiles) => currentProfiles.filter((profile) => profile.id !== botProfile.id));
    } catch {
      setErrorMessage("The bot profile service is temporarily unavailable.");
    } finally {
      setDeletingBotID(null);
    }
  }

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button className="h-10 bg-[#2b1e12] px-4 text-[#bba88d] hover:bg-[#5d542b]" onClick={openCreateForm} type="button">
          <Plus aria-hidden="true" />
          Create bot
        </Button>
      </div>

      {errorMessage && <p className="mb-4 rounded-lg border border-[#946440] bg-[#2b1e12]/90 px-4 py-3 text-sm text-[#f0d9b5]" role="alert">{errorMessage}</p>}

      {formMode && (
        <Card className="mb-6 border border-[#946440]/70 bg-[#bba88d]/95 text-[#2b1e12] shadow-[0_12px_32px_rgba(43,30,18,0.2)]">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle>{formMode === "create" ? "Create bot profile" : "Edit bot profile"}</CardTitle>
            <Button className="text-[#5d542b] hover:bg-[#946440]/20" onClick={closeForm} size="icon-sm" type="button" variant="ghost">
              <X aria-hidden="true" />
              <span className="sr-only">Close form</span>
            </Button>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <TextField label="Name" name="name" value={formValues.name} onChange={(name) => setFormValues((values) => ({ ...values, name }))} />
              <div className="grid gap-2">
                <Label htmlFor="bot-difficulty">Difficulty</Label>
                <select className="h-10 rounded-lg border border-[#946440]/70 bg-[#f4e7c8]/65 px-3 text-sm text-[#2b1e12] outline-none focus:border-[#5d542b] focus:ring-2 focus:ring-[#946440]/35" id="bot-difficulty" onChange={(event) => setFormValues((values) => ({ ...values, difficulty: event.target.value as BotProfileMutation["difficulty"] }))} value={formValues.difficulty}>
                  <option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option><option value="custom">Custom</option>
                </select>
              </div>
              <TextField label="Behavior style" name="behavior-style" value={formValues.behavior_style} onChange={(behavior_style) => setFormValues((values) => ({ ...values, behavior_style }))} />
              <TextField label="Avatar URL (optional)" name="avatar-url" type="url" value={formValues.avatar_url} onChange={(avatar_url) => setFormValues((values) => ({ ...values, avatar_url }))} />
              <label className="flex items-center gap-3 text-sm font-medium"><input checked={formValues.is_active} className="size-4 accent-[#5d542b]" onChange={(event) => setFormValues((values) => ({ ...values, is_active: event.target.checked }))} type="checkbox" />Make this bot available in room lobbies</label>
              <div className="flex justify-end gap-3">
                <Button className="border-[#946440] text-[#5d542b] hover:bg-[#946440]/20" onClick={closeForm} type="button" variant="outline">Cancel</Button>
                <Button className="bg-[#2b1e12] text-[#bba88d] hover:bg-[#5d542b]" disabled={isSaving} type="submit">
                  {isSaving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                  {formMode === "create" ? "Create bot" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {status === "loading" ? <p className="text-center text-sm text-[#f4e7c8]">Loading bot profiles…</p> : null}
      {status === "failed" ? <Card className="border border-[#946440]/55 bg-[#bba88d]/85 text-center text-[#5d542b]"><CardContent className="py-10">Bot profiles could not be loaded. Please try again shortly.</CardContent></Card> : null}
      {status === "ready" && botProfiles.length === 0 ? <Card className="border border-dashed border-[#946440]/70 bg-[#bba88d]/65 text-center text-[#5d542b]"><CardContent className="py-10">No bot profiles have been created yet.</CardContent></Card> : null}
      {status === "ready" && botProfiles.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{botProfiles.map((botProfile) => <BotProfileCard botProfile={botProfile} deleting={deletingBotID === botProfile.id} key={botProfile.id} onDelete={() => void handleDelete(botProfile)} onEdit={() => openEditForm(botProfile)} />)}</div> : null}
    </>
  );
}

function TextField({ label, name, onChange, type = "text", value }: { label: string; name: string; onChange: (value: string) => void; type?: string; value: string }) {
  const id = `bot-profile-${name}`;
  return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><Input className="border-[#946440]/70 bg-[#f4e7c8]/65 text-[#2b1e12] focus-visible:border-[#5d542b]" id={id} onChange={(event) => onChange(event.target.value)} type={type} value={value} /></div>;
}

function BotProfileCard({ botProfile, deleting, onDelete, onEdit }: { botProfile: BotProfile; deleting: boolean; onDelete: () => void; onEdit: () => void }) {
  return <Card className="relative overflow-hidden rounded-t-[6rem] border border-[#946440]/75 bg-[linear-gradient(145deg,rgba(244,231,200,0.9),rgba(187,168,141,0.82)_45%,rgba(148,100,64,0.58)),url('/textures/parchment-background.png')] bg-cover text-[#2b1e12] shadow-[0_16px_32px_rgba(43,30,18,0.28)]"><CardHeader className="pt-7"><div className="flex items-start justify-between gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${botProfile.is_active ? "border-[#6e6c34]/60 bg-[#6e6c34]/15 text-[#394017]" : "border-[#946440]/60 bg-[#946440]/15 text-[#5d3c28]"}`}>{botProfile.is_active ? "Active" : "Inactive"}</span><div className="flex gap-1"><Button aria-label={`Edit ${botProfile.name}`} className="text-[#5d542b] hover:bg-[#946440]/20" onClick={onEdit} size="icon-sm" type="button" variant="ghost"><Pencil aria-hidden="true" /></Button><Button aria-label={`Delete ${botProfile.name}`} className="text-[#763a2b] hover:bg-[#763a2b]/15" disabled={deleting} onClick={onDelete} size="icon-sm" type="button" variant="ghost">{deleting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}</Button></div></div><CardTitle className="mt-3 flex items-center gap-2 text-xl"><Bot className="size-5 text-[#5d542b]" aria-hidden="true" />{botProfile.name}</CardTitle></CardHeader><CardContent><dl className="grid gap-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-[#5d542b]">Difficulty</dt><dd className="font-medium capitalize">{botProfile.difficulty}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#5d542b]">Style</dt><dd className="font-medium">{botProfile.behavior_style}</dd></div></dl></CardContent></Card>;
}

function readErrorMessage(body: unknown): string {
  const parsedError = frontendApiErrorSchema.safeParse(body);
  return parsedError.success ? parsedError.data.message : "The request could not be completed.";
}
