"use client";

import { useEffect, useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

type Scope = "category" | "forum";
type Principal = "everyone" | "authenticated" | "account" | "faction" | "clan" | "staff" | "admin" | "helper";
type Rule = {
  principal_type: Principal;
  principal_id: string;
  effect: "allow" | "deny";
  minimum_rank: number | null;
  minimum_staff_level: number | null;
  can_view: boolean;
  can_create_topic: boolean;
  can_reply: boolean;
  can_edit_own: boolean;
  can_delete_own: boolean;
  can_moderate: boolean;
  can_manage: boolean;
};
type AdminData = {
  categories: Array<Record<string, unknown> & { id: number; name_en: string; name_ro: string }>;
  forums: Array<
    Record<string, unknown> & {
      id: number;
      name: string;
      category_id: number;
      access_type: string;
      is_locked: number | boolean;
    }
  >;
  factions: Array<{ id: string; label: string }>;
  clans: Array<{ id: number; name: string; tag: string }>;
  rules: Array<Rule & { scope_type: Scope; scope_id: number }>;
};

const emptyRule = (): Rule => ({
  principal_type: "everyone",
  principal_id: "",
  effect: "allow",
  minimum_rank: null,
  minimum_staff_level: null,
  can_view: true,
  can_create_topic: true,
  can_reply: true,
  can_edit_own: true,
  can_delete_own: true,
  can_moderate: false,
  can_manage: false,
});

export function ForumStaffAdmin({ locale = "en" }: { locale?: Locale }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [scope, setScope] = useState<Scope>("forum");
  const [scopeId, setScopeId] = useState(0);
  const [rules, setRules] = useState<Rule[]>([]);
  const [message, setMessage] = useState("");
  const [newCategory, setNewCategory] = useState({ name_en: "", name_ro: "", slug: "" });
  const [newForum, setNewForum] = useState({ name: "", slug: "", categoryId: 0, access_type: "public" });

  async function load() {
    const response = await fetch("/api/forum/admin/access", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }
  useEffect(() => {
    void load();
  }, []);

  const scopes = scope === "forum" ? data?.forums ?? [] : data?.categories ?? [];
  useEffect(() => {
    if (!scopeId && scopes[0]) setScopeId(scopes[0].id);
  }, [scopeId, scopes]);
  useEffect(() => {
    setRules(
      (data?.rules ?? [])
        .filter((rule) => rule.scope_type === scope && Number(rule.scope_id) === scopeId)
        .map((rule) => ({
          ...rule,
          can_view: Boolean(rule.can_view),
          can_create_topic: Boolean(rule.can_create_topic),
          can_reply: Boolean(rule.can_reply),
          can_edit_own: Boolean(rule.can_edit_own),
          can_delete_own: Boolean(rule.can_delete_own),
          can_moderate: Boolean(rule.can_moderate),
          can_manage: Boolean(rule.can_manage),
        }))
    );
  }, [data, scope, scopeId]);

  const selected = useMemo(() => scopes.find((item) => item.id === scopeId), [scopes, scopeId]);
  const updateRule = (index: number, patch: Partial<Rule>) =>
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));

  async function saveRules() {
    setMessage(t(locale, "cmsUi.saving"));
    const response = await fetch("/api/forum/admin/access", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope_type: scope, scope_id: scopeId, rules }),
    });
    setMessage(response.ok ? t(locale, "cmsUi.saved") : t(locale, "cmsUi.save_failed"));
    if (response.ok) await load();
  }

  async function patchForum(field: string, value: unknown) {
    if (scope !== "forum" || !scopeId) return;
    const response = await fetch(`/api/forum/admin/forums/${scopeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setMessage(response.ok ? t(locale, "cmsUi.saved") : t(locale, "cmsUi.save_failed"));
    if (response.ok) await load();
  }

  async function patchCategory(field: string, value: unknown) {
    if (scope !== "category" || !scopeId) return;
    const response = await fetch(`/api/forum/admin/categories/${scopeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setMessage(response.ok ? t(locale, "cmsUi.saved") : t(locale, "cmsUi.save_failed"));
    if (response.ok) await load();
  }

  async function deleteScope() {
    if (!scopeId) return;
    if (!window.confirm(t(locale, "cmsUi.confirm_delete"))) return;
    const url =
      scope === "category"
        ? `/api/forum/admin/categories/${scopeId}`
        : `/api/forum/admin/forums/${scopeId}`;
    const response = await fetch(url, { method: "DELETE" });
    setMessage(response.ok ? t(locale, "cmsUi.deleted") : t(locale, "cmsUi.save_failed"));
    if (response.ok) {
      setScopeId(0);
      await load();
    }
  }

  async function createCategory() {
    const response = await fetch("/api/forum/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name_en: newCategory.name_en,
        name_ro: newCategory.name_ro,
        slug: newCategory.slug,
      }),
    });
    setMessage(response.ok ? t(locale, "cmsUi.created") : t(locale, "cmsUi.save_failed"));
    if (response.ok) {
      setNewCategory({ name_en: "", name_ro: "", slug: "" });
      await load();
    }
  }

  async function createForum() {
    const categoryId = newForum.categoryId || data?.categories[0]?.id;
    const response = await fetch("/api/forum/admin/forums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: categoryId,
        name: newForum.name,
        slug: newForum.slug,
        access_type: newForum.access_type,
      }),
    });
    setMessage(response.ok ? t(locale, "cmsUi.created") : t(locale, "cmsUi.save_failed"));
    if (response.ok) {
      setNewForum({ name: "", slug: "", categoryId: 0, access_type: "public" });
      await load();
    }
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-100 p-4 text-xs text-[#8F8B83]">
        {t(locale, "cmsUi.loading")}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 border-b border-surface-border pb-4 lg:grid-cols-2">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <input
            value={newCategory.name_en}
            onChange={(e) => setNewCategory((v) => ({ ...v, name_en: e.target.value }))}
            placeholder={t(locale, "cmsUi.category_name_en")}
            className="rounded-lg border border-surface-border bg-surface-200 px-2 py-2 text-xs"
          />
          <input
            value={newCategory.name_ro}
            onChange={(e) => setNewCategory((v) => ({ ...v, name_ro: e.target.value }))}
            placeholder={t(locale, "cmsUi.category_name_ro")}
            className="rounded-lg border border-surface-border bg-surface-200 px-2 py-2 text-xs"
          />
          <input
            value={newCategory.slug}
            onChange={(e) => setNewCategory((v) => ({ ...v, slug: e.target.value }))}
            placeholder={t(locale, "cmsUi.slug_placeholder")}
            className="rounded-lg border border-surface-border bg-surface-200 px-2 py-2 text-xs"
          />
          <button type="button" onClick={() => void createCategory()} className="rounded-lg bg-surface-200 px-3 text-xs font-bold">
            {t(locale, "cmsUi.create_category")}
          </button>
        </div>
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <select
            value={newForum.categoryId}
            onChange={(e) => setNewForum((v) => ({ ...v, categoryId: Number(e.target.value) }))}
            className="rounded-lg border border-surface-border bg-surface-200 px-2 py-2 text-xs"
          >
            <option value={0}>{t(locale, "cmsUi.field_category")}</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_en}
              </option>
            ))}
          </select>
          <input
            value={newForum.name}
            onChange={(e) => setNewForum((v) => ({ ...v, name: e.target.value }))}
            placeholder={t(locale, "cmsUi.forum_name")}
            className="rounded-lg border border-surface-border bg-surface-200 px-2 py-2 text-xs"
          />
          <input
            value={newForum.slug}
            onChange={(e) => setNewForum((v) => ({ ...v, slug: e.target.value }))}
            placeholder={t(locale, "cmsUi.slug_placeholder")}
            className="rounded-lg border border-surface-border bg-surface-200 px-2 py-2 text-xs"
          />
          <button type="button" onClick={() => void createForum()} className="rounded-lg bg-surface-200 px-3 text-xs font-bold">
            {t(locale, "cmsUi.create_forum")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[#8F8B83]">
          {t(locale, "cmsUi.scope")}
          <select
            value={scope}
            onChange={(event) => {
              setScope(event.target.value as Scope);
              setScopeId(0);
            }}
            className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-3 py-2 text-[#F2EFE8]"
          >
            <option value="category">{t(locale, "cmsUi.scope_category")}</option>
            <option value="forum">{t(locale, "cmsUi.scope_forum")}</option>
          </select>
        </label>
        <label className="text-xs text-[#8F8B83]">
          {t(locale, "cmsUi.target")}
          <select
            value={scopeId}
            onChange={(event) => setScopeId(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-3 py-2 text-[#F2EFE8]"
          >
            {scopes.map((item) => (
              <option key={item.id} value={item.id}>
                {"name" in item ? String(item.name) : String(item.name_en)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {scope === "forum" && selected && (
        <div className="grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-4">
          <label className="text-xs text-[#8F8B83]">
            {t(locale, "cmsUi.forum_name")}
            <input
              key={`${scopeId}-name`}
              defaultValue={String(selected.name)}
              onBlur={(e) => void patchForum("name", e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-2"
            />
          </label>
          <label className="text-xs text-[#8F8B83]">
            {t(locale, "cmsUi.access_type")}
            <select
              defaultValue={String(selected.access_type ?? "public")}
              onChange={(e) => void patchForum("access_type", e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-2"
            >
              {(["public", "registered", "staff", "faction", "clan", "custom"] as const).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs text-[#F2EFE8]">
            <input
              type="checkbox"
              checked={Boolean(selected.is_locked)}
              onChange={(e) => void patchForum("is_locked", e.target.checked)}
            />
            {t(locale, "cmsUi.locked")}
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs text-[#F2EFE8]">
            <input
              type="checkbox"
              checked={Boolean(selected.is_visible)}
              onChange={(e) => void patchForum("is_visible", e.target.checked)}
            />
            {t(locale, "cmsUi.visible")}
          </label>
        </div>
      )}

      {scope === "category" && selected && (
        <div className="grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-4">
          <label className="text-xs text-[#8F8B83]">
            EN
            <input
              key={`${scopeId}-en`}
              defaultValue={String(selected.name_en)}
              onBlur={(e) => void patchCategory("name_en", e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-2"
            />
          </label>
          <label className="text-xs text-[#8F8B83]">
            RO
            <input
              key={`${scopeId}-ro`}
              defaultValue={String(selected.name_ro)}
              onBlur={(e) => void patchCategory("name_ro", e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-2"
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs text-[#F2EFE8]">
            <input
              type="checkbox"
              checked={Boolean(selected.is_visible)}
              onChange={(e) => void patchCategory("is_visible", e.target.checked)}
            />
            {t(locale, "cmsUi.visible")}
          </label>
          <div className="flex items-end">
            <button type="button" onClick={() => void deleteScope()} className="text-xs text-red-400 font-bold">
              {t(locale, "cmsUi.delete")} {t(locale, "cmsUi.scope_category")}
            </button>
          </div>
        </div>
      )}

      {scope === "forum" && scopeId ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => void deleteScope()} className="text-xs text-red-400 font-bold">
            {t(locale, "cmsUi.delete")} {t(locale, "cmsUi.scope_forum")}
          </button>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-surface-border pt-4">
        {rules.map((rule, index) => (
          <div key={index} className="rounded-lg border border-surface-border bg-surface-100 p-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <select
                value={rule.effect}
                onChange={(e) => updateRule(index, { effect: e.target.value as Rule["effect"] })}
                className="rounded-lg border border-surface-border bg-surface-200 px-2 py-2 text-xs"
              >
                <option value="allow">{t(locale, "cmsUi.acl_allow")}</option>
                <option value="deny">{t(locale, "cmsUi.acl_deny")}</option>
              </select>
              <select
                value={rule.principal_type}
                onChange={(e) => updateRule(index, { principal_type: e.target.value as Principal, principal_id: "" })}
                className="rounded-lg border border-surface-border bg-surface-200 px-2 py-2 text-xs"
              >
                {(["everyone", "authenticated", "faction", "clan", "staff", "admin", "helper", "account"] as Principal[]).map(
                  (type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {(
                [
                  "can_view",
                  "can_create_topic",
                  "can_reply",
                  "can_edit_own",
                  "can_delete_own",
                  "can_moderate",
                  "can_manage",
                ] as const
              ).map((capability) => (
                <label key={capability} className="flex items-center gap-1.5 text-xs text-[#F2EFE8]">
                  <input
                    type="checkbox"
                    checked={rule[capability]}
                    onChange={(e) => updateRule(index, { [capability]: e.target.checked })}
                  />
                  {capability.replace("can_", "")}
                </label>
              ))}
              <button
                type="button"
                onClick={() => setRules((current) => current.filter((_, i) => i !== index))}
                className="ml-auto text-xs text-red-400 hover:underline"
              >
                {t(locale, "cmsUi.remove")}
              </button>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRules((current) => [...current, emptyRule()])}
            className="rounded-lg bg-surface-200 px-3 py-2 text-xs font-bold"
          >
            {t(locale, "cmsUi.add_rule")}
          </button>
          <button
            type="button"
            disabled={!scopeId}
            onClick={() => void saveRules()}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-extrabold text-[#08080A] disabled:opacity-50"
          >
            {t(locale, "cmsUi.save_permissions")}
          </button>
          <span className="text-xs text-[#8F8B83]" role="status">
            {message}
          </span>
        </div>
      </div>
    </section>
  );
}
