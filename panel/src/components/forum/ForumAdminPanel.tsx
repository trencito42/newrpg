"use client";

import { useEffect, useMemo, useState } from "react";

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
  categories: Array<Record<string, unknown> & { id: number; name_en: string }>;
  forums: Array<Record<string, unknown> & { id: number; name: string; category_id: number }>;
  factions: Array<{ id: string; label: string }>;
  clans: Array<{ id: number; name: string; tag: string }>;
  rules: Array<Rule & { scope_type: Scope; scope_id: number }>;
};

const emptyRule = (): Rule => ({
  principal_type: "everyone", principal_id: "", effect: "allow", minimum_rank: null, minimum_staff_level: null,
  can_view: true, can_create_topic: true, can_reply: true, can_edit_own: true, can_delete_own: true,
  can_moderate: false, can_manage: false,
});

export function ForumAdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [scope, setScope] = useState<Scope>("forum");
  const [scopeId, setScopeId] = useState(0);
  const [rules, setRules] = useState<Rule[]>([]);
  const [message, setMessage] = useState("");
  const [newCategory, setNewCategory] = useState({ name: "", slug: "" });
  const [newForum, setNewForum] = useState({ name: "", slug: "", categoryId: 0 });

  async function load() {
    const response = await fetch("/api/forum/admin/access", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }
  useEffect(() => { void load(); }, []);

  const scopes = scope === "forum" ? data?.forums ?? [] : data?.categories ?? [];
  useEffect(() => {
    if (!scopeId && scopes[0]) setScopeId(scopes[0].id);
  }, [scopeId, scopes]);
  useEffect(() => {
    setRules((data?.rules ?? []).filter((rule) => rule.scope_type === scope && Number(rule.scope_id) === scopeId)
      .map((rule) => ({ ...rule, can_view: Boolean(rule.can_view), can_create_topic: Boolean(rule.can_create_topic), can_reply: Boolean(rule.can_reply), can_edit_own: Boolean(rule.can_edit_own), can_delete_own: Boolean(rule.can_delete_own), can_moderate: Boolean(rule.can_moderate), can_manage: Boolean(rule.can_manage) })));
  }, [data, scope, scopeId]);

  const selected = useMemo(() => scopes.find((item) => item.id === scopeId), [scopes, scopeId]);
  const updateRule = (index: number, patch: Partial<Rule>) => setRules((current) => current.map((rule, i) => i === index ? { ...rule, ...patch } : rule));

  async function saveRules() {
    setMessage("Saving…");
    const response = await fetch("/api/forum/admin/access", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope_type: scope, scope_id: scopeId, rules }),
    });
    setMessage(response.ok ? "Permissions saved" : `Could not save (${response.status})`);
    if (response.ok) await load();
  }

  async function patchForum(field: string, value: unknown) {
    if (scope !== "forum" || !scopeId) return;
    const response = await fetch(`/api/forum/admin/forums/${scopeId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }),
    });
    setMessage(response.ok ? "Forum updated" : `Could not update (${response.status})`);
    if (response.ok) await load();
  }

  async function patchCategory(field: string, value: unknown) {
    if (scope !== "category" || !scopeId) return;
    const response = await fetch(`/api/forum/admin/categories/${scopeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    setMessage(response.ok ? "Category updated" : `Could not update (${response.status})`);
    if (response.ok) await load();
  }

  async function createCategory() {
    const response = await fetch("/api/forum/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name_en: newCategory.name, name_ro: newCategory.name, slug: newCategory.slug }) });
    setMessage(response.ok ? "Category created" : `Could not create (${response.status})`);
    if (response.ok) { setNewCategory({ name: "", slug: "" }); await load(); }
  }

  async function createForum() {
    const categoryId = newForum.categoryId || data?.categories[0]?.id;
    const response = await fetch("/api/forum/admin/forums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category_id: categoryId, name: newForum.name, slug: newForum.slug, access_type: "public" }) });
    setMessage(response.ok ? "Forum created" : `Could not create (${response.status})`);
    if (response.ok) { setNewForum({ name: "", slug: "", categoryId: 0 }); await load(); }
  }

  if (!data) return <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">Loading forum management…</div>;

  return (
    <section className="space-y-4" aria-labelledby="forum-management-title">
      <div>
        <h2 id="forum-management-title" className="text-sm font-extrabold uppercase tracking-wider text-foreground">Forum management</h2>
        <p className="mt-1 text-xs text-muted-foreground">Configure structure, visibility and inherited category/forum access rules.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="grid gap-4 border-b border-border pb-4 lg:grid-cols-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input value={newCategory.name} onChange={(e) => setNewCategory((v) => ({ ...v, name: e.target.value }))} placeholder="Category name" className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground" />
            <input value={newCategory.slug} onChange={(e) => setNewCategory((v) => ({ ...v, slug: e.target.value }))} placeholder="category-slug" className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground" />
            <button type="button" onClick={() => void createCategory()} className="rounded-lg bg-surface-200 px-3 text-xs font-bold text-foreground">Create category</button>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <select value={newForum.categoryId} onChange={(e) => setNewForum((v) => ({ ...v, categoryId: Number(e.target.value) }))} className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground"><option value={0}>Category</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}</select>
            <input value={newForum.name} onChange={(e) => setNewForum((v) => ({ ...v, name: e.target.value }))} placeholder="Forum name" className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground" />
            <input value={newForum.slug} onChange={(e) => setNewForum((v) => ({ ...v, slug: e.target.value }))} placeholder="forum-slug" className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground" />
            <button type="button" onClick={() => void createForum()} className="rounded-lg bg-surface-200 px-3 text-xs font-bold text-foreground">Create forum</button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Scope
            <select value={scope} onChange={(event) => { setScope(event.target.value as Scope); setScopeId(0); }} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-3 py-2 text-foreground">
              <option value="category">Category</option><option value="forum">Forum</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Target
            <select value={scopeId} onChange={(event) => setScopeId(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-3 py-2 text-foreground">
              {scopes.map((item) => <option key={item.id} value={item.id}>{"name" in item ? String(item.name) : String(item.name_en)}</option>)}
            </select>
          </label>
        </div>

        {scope === "forum" && selected && (
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <label className="text-xs text-muted-foreground">Name
              <input key={`${scopeId}-name`} defaultValue={String(selected.name)} onBlur={(e) => void patchForum("name", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-2 py-2 text-foreground" />
            </label>
            <label className="text-xs text-muted-foreground">Description
              <input key={`${scopeId}-description`} defaultValue={String(selected.description ?? "")} onBlur={(e) => void patchForum("description", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-2 py-2 text-foreground" />
            </label>
            <label className="text-xs text-muted-foreground">Icon
              <input key={`${scopeId}-icon`} defaultValue={String(selected.icon ?? "MessageSquare")} onBlur={(e) => void patchForum("icon", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-2 py-2 text-foreground" />
            </label>
            <label className="text-xs text-muted-foreground">Category
              <select value={Number(selected.category_id)} onChange={(e) => void patchForum("category_id", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-2 py-2 text-foreground">
                {data.categories.map((category) => <option key={category.id} value={category.id}>{category.name_en}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Sort order
              <input type="number" defaultValue={Number(selected.sort_order)} onBlur={(e) => void patchForum("sort_order", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-2 py-2 text-foreground" />
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs text-foreground"><input type="checkbox" checked={Boolean(selected.is_visible)} onChange={(e) => void patchForum("is_visible", e.target.checked)} /> Visible</label>
            <label className="flex items-end gap-2 pb-2 text-xs text-foreground"><input type="checkbox" checked={Boolean(selected.inherit_category_permissions)} onChange={(e) => void patchForum("inherit_category_permissions", e.target.checked)} /> Inherit category ACL</label>
          </div>
        )}
        {scope === "category" && selected && (
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <label className="text-xs text-muted-foreground">English name<input key={`${scopeId}-en`} defaultValue={String(selected.name_en)} onBlur={(e) => void patchCategory("name_en", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-2 py-2 text-foreground" /></label>
            <label className="text-xs text-muted-foreground">Romanian name<input key={`${scopeId}-ro`} defaultValue={String(selected.name_ro)} onBlur={(e) => void patchCategory("name_ro", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-2 py-2 text-foreground" /></label>
            <label className="text-xs text-muted-foreground">Sort order<input type="number" key={`${scopeId}-sort`} defaultValue={Number(selected.sort_order)} onBlur={(e) => void patchCategory("sort_order", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-surface-200 px-2 py-2 text-foreground" /></label>
            <label className="flex items-end gap-2 pb-2 text-xs text-foreground"><input type="checkbox" checked={Boolean(selected.is_visible)} onChange={(e) => void patchCategory("is_visible", e.target.checked)} /> Visible</label>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          {rules.map((rule, index) => (
            <div key={index} className="rounded-lg border border-border bg-surface-100 p-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <select value={rule.effect} onChange={(e) => updateRule(index, { effect: e.target.value as Rule["effect"] })} className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground"><option value="allow">Allow</option><option value="deny">Deny</option></select>
                <select value={rule.principal_type} onChange={(e) => updateRule(index, { principal_type: e.target.value as Principal, principal_id: "" })} className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground">
                  {(["everyone", "authenticated", "faction", "clan", "staff", "admin", "helper", "account"] as Principal[]).map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                {rule.principal_type === "faction" ? <select value={rule.principal_id} onChange={(e) => updateRule(index, { principal_id: e.target.value })} className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground"><option value="">Select faction</option>{data.factions.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
                  : rule.principal_type === "clan" ? <select value={rule.principal_id} onChange={(e) => updateRule(index, { principal_id: e.target.value })} className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground"><option value="">Select clan</option>{data.clans.map((clan) => <option key={clan.id} value={clan.id}>{clan.tag} — {clan.name}</option>)}</select>
                  : rule.principal_type === "account" ? <input value={rule.principal_id} onChange={(e) => updateRule(index, { principal_id: e.target.value })} placeholder="Account ID" className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground" /> : <span />}
                {["staff", "admin", "helper"].includes(rule.principal_type)
                  ? <input type="number" min={1} value={rule.minimum_staff_level ?? ""} onChange={(e) => updateRule(index, { minimum_staff_level: e.target.value ? Number(e.target.value) : null })} placeholder="Minimum staff level" className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground" />
                  : <input type="number" min={0} value={rule.minimum_rank ?? ""} onChange={(e) => updateRule(index, { minimum_rank: e.target.value ? Number(e.target.value) : null })} placeholder="Minimum rank" className="rounded-lg border border-border bg-surface-200 px-2 py-2 text-xs text-foreground" />}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(["can_view", "can_create_topic", "can_reply", "can_edit_own", "can_delete_own", "can_moderate", "can_manage"] as const).map((capability) => <label key={capability} className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" checked={rule[capability]} onChange={(e) => updateRule(index, { [capability]: e.target.checked })} />{capability.replace("can_", "").replace("_", " ")}</label>)}
                <button type="button" onClick={() => setRules((current) => current.filter((_, i) => i !== index))} className="ml-auto text-xs text-red-400 hover:underline">Remove</button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setRules((current) => [...current, emptyRule()])} className="rounded-lg bg-surface-200 px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-300">Add rule</button>
            <button type="button" disabled={!scopeId} onClick={() => void saveRules()} className="rounded-lg bg-brand px-3 py-2 text-xs font-extrabold text-[#08080A] disabled:opacity-50">Save permissions</button>
            <span className="text-xs text-muted-foreground" role="status">{message}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
