'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type ReactQuillType from 'react-quill-new';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/formatters';
import { Modal } from '@/components/Modal';
import { SlideOver } from '@/components/SlideOver';

// react-quill ne supporte pas SSR et a besoin de forwardRef pour exposer l'instance
const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill-new');
    const Wrapped = forwardRef<ReactQuillType, React.ComponentProps<typeof RQ>>((props, ref) => (
      <RQ ref={ref as any} {...props} />
    ));
    Wrapped.displayName = 'ReactQuillWrapped';
    return Wrapped;
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-64 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
        Chargement de l'editeur...
      </div>
    ),
  },
);

type Tab = 'rules' | 'templates' | 'logs';

interface Rule {
  id: string;
  name: string;
  delayDays: number;
  sendHour: number;
  templateName: string;
  templateSubject: string | null;
  templateVersion: number | null;
  isActive: boolean;
  excludeCompleted: boolean;
  excludeExpired: boolean;
  excludeUnenrolled: boolean;
  archivedAt: string | null;
}

interface Template {
  id: string;
  name: string;
  version: number;
  subject: string;
  htmlContent: string;
  isActive: boolean;
  updatedAt: string;
}

interface ReminderLog {
  id: string;
  ruleName: string;
  ruleDelayDays: number;
  templateName: string;
  templateVersion: string | null;
  formationId: string;
  formationTitle: string;
  recipientName: string;
  recipientEmail: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

interface Formation {
  id: string;
  title: string;
}

const statusStyles: Record<string, string> = {
  sent: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  skipped: 'bg-gray-100 text-gray-600',
};

export default function AdminRelancesPage() {
  const [tab, setTab] = useState<Tab>('rules');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Relances email</h1>
      <p className="text-sm text-gray-500 mb-6">Regles d'envoi, templates et journal des relances automatiques</p>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabButton active={tab === 'rules'} onClick={() => setTab('rules')}>Regles</TabButton>
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>Templates</TabButton>
        <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>Journal</TabButton>
      </div>

      {tab === 'rules' && <RulesTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'logs' && <LogsTab />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Onglet 1 : Regles ────────────────────────────────────────────────────────

function RulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  async function reload() {
    setRefreshing(true);
    const rulesQs = showArchived ? '?includeArchived=1' : '';
    const [r, t] = await Promise.all([
      api.get<{ data: Rule[] }>(`/admin/relances/rules${rulesQs}`),
      api.get<{ data: Template[] }>('/admin/relances/templates'),
    ]);
    setRules(r.data);
    setTemplates(t.data);
    setRefreshing(false);
    setInitialLoading(false);
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showArchived]);

  async function toggleActive(rule: Rule) {
    await api.put(`/admin/relances/rules/${rule.id}`, { isActive: !rule.isActive });
    reload();
  }

  async function archive(rule: Rule) {
    if (!confirm(`Archiver la regle "${rule.name}" ? Elle sera desactivee et masquee, les logs sont conserves.`)) return;
    await api.post(`/admin/relances/rules/${rule.id}/archive`);
    reload();
  }

  async function unarchive(rule: Rule) {
    await api.post(`/admin/relances/rules/${rule.id}/unarchive`);
    reload();
  }

  if (initialLoading) return <Loading />;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les regles archivees
        </label>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
        >
          + Nouvelle regle
        </button>
      </div>

      {rules.length === 0 ? (
        <Empty text="Aucune regle definie" />
      ) : (
        <div className={`transition-opacity duration-150 ${refreshing ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {/* ─── Vue cartes (mobile) ─────────────────────────────── */}
          <ul className="md:hidden space-y-3">
            {rules.map((r) => {
              const isArchived = !!r.archivedAt;
              return (
                <li
                  key={r.id}
                  className={`bg-white rounded-lg border border-gray-200 p-4 space-y-3 ${isArchived ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 break-words">{r.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.delayDays} j — envoi à {String(r.sendHour).padStart(2, '0')}:00
                      </p>
                    </div>
                    {isArchived ? (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0">
                        Archivee
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Toggle checked={r.isActive} onChange={() => toggleActive(r)} />
                        <span className="text-xs text-gray-500">Actif</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-600">
                    <span className="text-gray-400">Template : </span>
                    <span className="font-mono">{r.templateName}</span>
                    {r.templateVersion && <span className="text-gray-400 ml-1">v{r.templateVersion}</span>}
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
                    {isArchived ? (
                      <button onClick={() => unarchive(r)} className="text-xs text-green-600 hover:text-green-700 px-2 py-1">
                        Desarchiver
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setEditing(r)} className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1">Editer</button>
                        <button onClick={() => archive(r)} className="text-xs text-red-500 hover:text-red-600 px-2 py-1">Archiver</button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ─── Vue tableau (desktop) ───────────────────────────── */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Nom</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Delai</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Heure envoi</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Template</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actif</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((r) => {
                  const isArchived = !!r.archivedAt;
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 ${isArchived ? 'opacity-60 bg-gray-50/50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {r.name}
                        {isArchived && <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 align-middle">Archivee</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.delayDays} j</td>
                      <td className="px-4 py-3 text-gray-600">{String(r.sendHour).padStart(2, '0')}:00</td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="text-xs">{r.templateName}</span>
                        {r.templateVersion && <span className="text-xs text-gray-400 ml-1">v{r.templateVersion}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isArchived ? <span className="text-xs text-gray-400">—</span> : <Toggle checked={r.isActive} onChange={() => toggleActive(r)} />}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {isArchived ? (
                          <button onClick={() => unarchive(r)} className="text-xs text-green-600 hover:text-green-700 px-2">Desarchiver</button>
                        ) : (
                          <>
                            <button onClick={() => setEditing(r)} className="text-xs text-brand-600 hover:text-brand-700 px-2">Editer</button>
                            <button onClick={() => archive(r)} className="text-xs text-red-500 hover:text-red-600 px-2">Archiver</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <RuleModal
          rule={editing}
          templates={templates}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}
    </>
  );
}

function RuleModal({ rule, templates, onClose, onSaved }: { rule: Rule | null; templates: Template[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(rule?.name ?? '');
  const [delayDays, setDelayDays] = useState(rule?.delayDays ?? 7);
  const [sendHour, setSendHour] = useState(rule?.sendHour ?? 9);
  const [templateName, setTemplateName] = useState(rule?.templateName ?? templates[0]?.name ?? '');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [excludeCompleted, setExcludeCompleted] = useState(rule?.excludeCompleted ?? true);
  const [excludeExpired, setExcludeExpired] = useState(rule?.excludeExpired ?? true);
  const [excludeUnenrolled, setExcludeUnenrolled] = useState(rule?.excludeUnenrolled ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setSaving(true);
    try {
      const body = { name, delayDays, sendHour, templateName, isActive, excludeCompleted, excludeExpired, excludeUnenrolled };
      if (rule) await api.put(`/admin/relances/rules/${rule.id}`, body);
      else await api.post('/admin/relances/rules', body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={rule ? 'Modifier la regle' : 'Nouvelle regle'}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={submit} disabled={saving || !name || !templateName} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Delai (jours)">
            <input type="number" min={1} max={365} value={delayDays} onChange={(e) => setDelayDays(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </Field>
          <Field label="Heure d'envoi">
            <select value={sendHour} onChange={(e) => setSendHour(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Template">
          <select value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
            {templates.map((t) => <option key={t.name} value={t.name}>{t.name} (v{t.version})</option>)}
          </select>
        </Field>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-700 mb-2">Exclusions</p>
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={excludeCompleted} onChange={(e) => setExcludeCompleted(e.target.checked)} className="mt-0.5" />
              <span>Exclure les apprenants dont la formation est deja terminee</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={excludeExpired} onChange={(e) => setExcludeExpired(e.target.checked)} className="mt-0.5" />
              <span>Exclure les apprenants dont l'acces est cloture (end_date depassee)</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={excludeUnenrolled} onChange={(e) => setExcludeUnenrolled(e.target.checked)} className="mt-0.5" />
              <span>Exclure les apprenants desinscrits (enrollment cloture)</span>
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 border-t border-gray-100 pt-4">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Regle active
        </label>
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
    </Modal>
  );
}

// ─── Onglet 2 : Templates ─────────────────────────────────────────────────────

const VARIABLES = ['{{prenom}}', '{{nom}}', '{{formation}}', '{{modules_en_retard}}', '{{lien_formation}}'];

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);

  async function reload() {
    setLoading(true);
    const { data } = await api.get<{ data: Template[] }>('/admin/relances/templates');
    setTemplates(data);
    setLoading(false);
  }

  async function duplicate(t: Template) {
    try {
      const { data } = await api.post<{ data: Template }>(`/admin/relances/templates/${t.name}/duplicate`);
      await reload();
      setEditing(data);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function remove(t: Template) {
    if (!confirm(`Supprimer le template "${t.name}" et toutes ses versions ? Les logs de relances envoyees sont conserves.`)) return;
    try {
      await api.delete(`/admin/relances/templates/${t.name}`);
      await reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  useEffect(() => { reload(); }, []);

  if (loading) return <Loading />;

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
        >
          + Nouveau template
        </button>
      </div>

      {templates.length === 0 ? (
        <Empty text="Aucun template defini" />
      ) : (
        <>
          {/* ─── Vue cartes (mobile) ─────────────────────────────── */}
          <ul className="md:hidden space-y-3">
            {templates.map((t) => (
              <li key={t.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 font-mono text-xs break-all">{t.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Maj {formatDate(t.updatedAt)}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                    v{t.version}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Sujet</p>
                  <p className="text-sm text-gray-700 line-clamp-2">{t.subject}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-gray-100">
                  <button onClick={() => setPreview(t)} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">Previsualiser</button>
                  <button onClick={() => duplicate(t)} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">Dupliquer</button>
                  <button onClick={() => setEditing(t)} className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1">Editer</button>
                  <button onClick={() => remove(t)} className="text-xs text-red-500 hover:text-red-600 px-2 py-1">Supprimer</button>
                </div>
              </li>
            ))}
          </ul>

          {/* ─── Vue tableau (desktop) ───────────────────────────── */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Nom</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Version</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Sujet</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Maj</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">v{t.version}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-md truncate">{t.subject}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(t.updatedAt)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setPreview(t)} className="text-xs text-gray-600 hover:text-gray-900 px-2">Previsualiser</button>
                      <button onClick={() => duplicate(t)} className="text-xs text-gray-600 hover:text-gray-900 px-2">Dupliquer</button>
                      <button onClick={() => setEditing(t)} className="text-xs text-brand-600 hover:text-brand-700 px-2">Editer</button>
                      <button onClick={() => remove(t)} className="text-xs text-red-500 hover:text-red-600 px-2">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(creating || editing) && (
        <TemplateEditor
          template={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}

      {preview && <TemplatePreview template={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

const NAME_PATTERN = /^[a-z0-9_]+$/;

const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ color: [] }],
    [{ list: 'bullet' }],
    [{ align: [] }],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = ['bold', 'italic', 'underline', 'color', 'list', 'align', 'link'];

const SAMPLE_VARS: Record<string, string> = {
  '{{prenom}}': 'Marie',
  '{{nom}}': 'Dupont',
  '{{formation}}': 'Nom de la formation',
  '{{modules_en_retard}}': '<ul><li>Module 1 : Introduction</li><li>Module 2 : Notions avancees</li></ul>',
  '{{lien_formation}}': '#',
};

function renderPreview(html: string): string {
  let out = html;
  for (const [k, v] of Object.entries(SAMPLE_VARS)) {
    out = out.replaceAll(k, v);
  }
  return out;
}

function TemplateEditor({ template, onClose, onSaved }: { template: Template | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [htmlContent, setHtmlContent] = useState(template?.htmlContent ?? '');
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuillType | null>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const nameInvalid = !template && name.length > 0 && !NAME_PATTERN.test(name);
  const canSubmit = subject && htmlContent && (template || (name && !nameInvalid));

  const previewHtml = useMemo(() => renderPreview(htmlContent), [htmlContent]);

  // Highlight {{var}} pour le mode HTML brut
  const highlightedSource = useMemo(() => {
    const escaped = htmlContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const withVars = escaped.replace(
      /\{\{[a-z0-9_]+\}\}/g,
      (m) => `<span class="var-hl">${m}</span>`,
    );
    // Ajoute un espace insécable en fin pour que la dernière ligne vide reste visible
    return withVars + '\u200B';
  }, [htmlContent]);

  function syncHighlightScroll() {
    const ta = htmlRef.current;
    const hl = highlightRef.current;
    if (!ta || !hl) return;
    hl.scrollTop = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
  }

  async function submit() {
    setErr(null);
    setSaving(true);
    try {
      if (template) {
        await api.put(`/admin/relances/templates/${template.name}`, { subject, htmlContent });
      } else {
        await api.post('/admin/relances/templates', { name, subject, htmlContent });
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  function insertIntoSubject(v: string) {
    const el = subjectRef.current;
    if (!el) { setSubject((s) => s + v); return; }
    const start = el.selectionStart ?? subject.length;
    const end = el.selectionEnd ?? subject.length;
    const next = subject.slice(0, start) + v + subject.slice(end);
    setSubject(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + v.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function insertIntoQuill(v: string) {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      setHtmlContent((s) => s + v);
      return;
    }
    const range = editor.getSelection(true);
    const pos = range?.index ?? editor.getLength();
    editor.insertText(pos, v, 'user');
    editor.setSelection(pos + v.length, 0);
  }

  function insertIntoHtmlTextarea(v: string) {
    const el = htmlRef.current;
    if (!el) { setHtmlContent((s) => s + v); return; }
    const start = el.selectionStart ?? htmlContent.length;
    const end = el.selectionEnd ?? htmlContent.length;
    setHtmlContent(htmlContent.slice(0, start) + v + htmlContent.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + v.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <SlideOver
      title={template ? `Editer ${template.name} (nouvelle v${template.version + 1})` : 'Nouveau template'}
      onClose={onClose}
      maxWidth={820}
      footer={
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {template ? 'La modification cree une nouvelle version' : 'Le nom sert de reference stable, non modifiable'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button onClick={submit} disabled={saving || !canSubmit} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {!template && (
          <div>
            <label className="block">
              <span className="text-xs text-gray-500 block mb-1">
                Nom technique (sans espaces ni majuscules, ex: relance_7j)
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="relance_7j"
                className={`w-full px-3 py-2 text-sm border rounded-lg font-mono ${nameInvalid ? 'border-red-400' : 'border-gray-200'}`}
              />
            </label>
            {nameInvalid && (
              <p className="text-xs text-red-500 mt-1">
                Le nom ne doit contenir que des lettres minuscules, chiffres et _ (pas d'espaces ni de majuscules)
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block">
            <span className="text-xs text-gray-500 block mb-1">Sujet</span>
            <input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <VariableChips onInsert={insertIntoSubject} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Contenu</p>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setEditorMode('visual')}
                className={`px-3 py-1 rounded-md transition-colors ${editorMode === 'visual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Visuel
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('html')}
                className={`px-3 py-1 rounded-md transition-colors ${editorMode === 'html' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                HTML
              </button>
            </div>
          </div>

          {editorMode === 'visual' ? (
            <>
              <div className="quill-taa rounded-lg border border-gray-200 overflow-hidden">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={htmlContent}
                  onChange={setHtmlContent}
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                />
              </div>
              <VariableChips onInsert={insertIntoQuill} />
            </>
          ) : (
            <>
              <div className="html-editor relative border border-gray-200 rounded-lg overflow-hidden" style={{ height: 300 }}>
                <div
                  ref={highlightRef}
                  aria-hidden="true"
                  className="html-editor-hl"
                  dangerouslySetInnerHTML={{ __html: highlightedSource }}
                />
                <textarea
                  ref={htmlRef}
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  onScroll={syncHighlightScroll}
                  spellCheck={false}
                  className="html-editor-ta"
                />
              </div>
              <VariableChips onInsert={insertIntoHtmlTextarea} />
            </>
          )}
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Apercu avec variables d'exemple</p>
          <div
            className="preview-pane border border-gray-200 rounded-lg p-4 bg-white text-sm"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>

        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>

      <style jsx global>{`
        .quill-taa .ql-editor { min-height: 240px; font-size: 14px; }
        .quill-taa .ql-toolbar { border: none; border-bottom: 1px solid #e5e7eb; }
        .quill-taa .ql-container { border: none; }
        .preview-pane ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .preview-pane ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .preview-pane strong { font-weight: 700; }
        .preview-pane em { font-style: italic; }
        .preview-pane u { text-decoration: underline; }
        .preview-pane a { color: #B5294E; text-decoration: underline; }

        /* ─── HTML editor avec highlight des variables {{...}} ─── */
        .html-editor { background: #fff; }
        .html-editor-hl,
        .html-editor-ta {
          position: absolute;
          inset: 0;
          margin: 0;
          padding: 10px 12px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: break-word;
          overflow: auto;
          tab-size: 2;
          border: 0;
        }
        .html-editor-hl {
          pointer-events: none;
          color: #1f2937;
          background: transparent;
          z-index: 1;
        }
        .html-editor-hl .var-hl {
          background: #FFE4EC;
          color: #B5294E;
          font-weight: 700;
          border-radius: 3px;
          padding: 0 2px;
        }
        .html-editor-ta {
          z-index: 2;
          background: transparent;
          color: transparent;
          caret-color: #111827;
          resize: none;
          outline: none;
        }
        .html-editor-ta::selection { background: rgba(181, 41, 78, 0.25); }
      `}</style>
    </SlideOver>
  );
}

function VariableChips({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {VARIABLES.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="text-[11px] px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-mono text-gray-600"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function TemplatePreview({ template, onClose }: { template: Template; onClose: () => void }) {
  return (
    <SlideOver title={`${template.name} v${template.version}`} onClose={onClose} maxWidth={720}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Sujet</p>
        <p className="text-sm text-gray-900 font-medium border border-gray-200 rounded p-2">{template.subject}</p>
        <p className="text-xs text-gray-500 mt-3">Rendu HTML</p>
        <iframe
          title="preview"
          sandbox=""
          srcDoc={template.htmlContent}
          className="w-full border border-gray-200 rounded"
          style={{ height: 500 }}
        />
      </div>
    </SlideOver>
  );
}

// ─── Onglet 3 : Journal ───────────────────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [formationFilter, setFormationFilter] = useState('');

  useEffect(() => {
    api.get<{ data: { formations: Formation[] } }>('/admin/dashboard/sessions')
      .then((res) => setFormations(res.data.formations))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    if (formationFilter) qs.set('formationId', formationFilter);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    setLoading(true);
    api.get<{ data: ReminderLog[] }>(`/admin/relances${q}`).then((r) => setLogs(r.data)).finally(() => setLoading(false));
  }, [statusFilter, formationFilter]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 bg-white p-4 rounded-lg border border-gray-200">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Statut
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg bg-white min-w-[160px]">
            <option value="">Tous</option>
            <option value="sent">Envoye</option>
            <option value="failed">Echec</option>
            <option value="skipped">Ignore</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Formation
          <select value={formationFilter} onChange={(e) => setFormationFilter(e.target.value)} className="text-sm text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg bg-white min-w-[220px]">
            <option value="">Toutes</option>
            {formations.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
        </label>
      </div>

      {loading ? <Loading /> : logs.length === 0 ? (
        <Empty text="Aucune relance pour ces filtres" />
      ) : (
        <>
          {/* ─── Vue cartes (mobile) ─────────────────────────────── */}
          <ul className="md:hidden space-y-3">
            {logs.map((l) => (
              <li key={l.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{l.recipientName}</p>
                    <p className="text-xs text-gray-400 truncate">{l.recipientEmail}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusStyles[l.status] || statusStyles.skipped}`}>
                    {l.status === 'sent' ? 'Envoye' : l.status === 'failed' ? 'Echec' : 'Ignore'}
                  </span>
                </div>

                <p className="text-xs text-gray-700 line-clamp-2">{l.formationTitle}</p>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                  <span>{formatDate(l.sentAt)}</span>
                  <span>
                    <span className="text-gray-400">Regle : </span>
                    {l.ruleName} <span className="text-gray-400">({l.ruleDelayDays}j)</span>
                  </span>
                  <span>
                    <span className="text-gray-400">Template : </span>
                    <span className="font-mono">{l.templateName}</span>
                    {l.templateVersion && <span className="text-gray-400 ml-0.5">v{l.templateVersion}</span>}
                  </span>
                </div>

                {l.errorMessage && (
                  <p className="text-xs text-red-500 line-clamp-2">{l.errorMessage}</p>
                )}
              </li>
            ))}
          </ul>

          {/* ─── Vue tableau (desktop) ───────────────────────────── */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Destinataire</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Formation</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Regle</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Template</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 hidden xl:table-cell">Erreur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(l.sentAt)}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{l.recipientName}</p>
                        <p className="text-xs text-gray-400">{l.recipientEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{l.formationTitle}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{l.ruleName} <span className="text-gray-400">({l.ruleDelayDays}j)</span></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{l.templateName}{l.templateVersion && <span className="text-gray-400 ml-1">v{l.templateVersion}</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[l.status] || statusStyles.skipped}`}>
                          {l.status === 'sent' ? 'Envoye' : l.status === 'failed' ? 'Echec' : 'Ignore'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-red-500 hidden xl:table-cell">{l.errorMessage || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="flex items-center gap-3 text-gray-500 py-12">
      <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      Chargement...
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <p className="text-gray-400 text-sm">{text}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}
      aria-pressed={checked}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}
