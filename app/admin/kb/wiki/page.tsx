'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pin, PinOff, Pencil, Trash2, Eye, EyeOff, FileText, X } from 'lucide-react';
import { marked } from 'marked';

interface WikiArticle {
  id: string; title: string; content: string; category: string;
  isPinned: boolean; createdBy: string; updatedBy: string | null;
  createdAt: string; updatedAt: string;
}

const CATEGORIES = ['SOP', 'Reminder', 'Policy', 'How-To', 'Other', 'General'];

const SUGGESTED = [
  { title: 'How to use this portal', category: 'How-To' },
  { title: 'Category reference', category: 'SOP' },
  { title: 'What is a TUG code', category: 'Policy' },
];

function renderMarkdown(md: string): string {
  try {
    return String(marked.parse(md));
  } catch {
    return md;
  }
}

function groupByCategory(articles: WikiArticle[]): Record<string, WikiArticle[]> {
  const groups: Record<string, WikiArticle[]> = {};
  for (const a of articles) {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  }
  return groups;
}

interface EditorProps {
  article: Partial<WikiArticle> | null;
  onSave: (data: Partial<WikiArticle>) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  deleting: boolean;
}

function ArticleEditor({ article, onSave, onCancel, onDelete, saving, deleting }: EditorProps) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [content, setContent] = useState(article?.content ?? '');
  const [category, setCategory] = useState(article?.category ?? 'General');
  const [isPinned, setIsPinned] = useState(article?.isPinned ?? false);
  const [preview, setPreview] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [titleError, setTitleError] = useState('');

  async function handleSave() {
    if (!title.trim()) { setTitleError('Title is required.'); return; }
    setTitleError('');
    await onSave({ title: title.trim(), content, category, isPinned });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          {article?.id ? 'Edit Article' : 'New Article'}
        </h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <input
          value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(''); }}
          placeholder="Article title"
          style={{ width: '100%', height: '38px', padding: '0 0.75rem', borderRadius: '5px', border: `1px solid ${titleError ? '#E0604B' : 'var(--input-border)'}`, background: 'var(--bg-cream)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
        />
        {titleError && <div style={{ fontSize: '0.75rem', color: '#E0604B', marginTop: '0.25rem' }}>{titleError}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          style={{ height: '34px', borderRadius: '5px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', padding: '0 0.5rem', fontSize: '0.8rem', flex: 1, outline: 'none' }}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <button onClick={() => setIsPinned((p) => !p)}
          title={isPinned ? 'Unpin' : 'Pin to top'}
          style={{ height: '34px', padding: '0 0.625rem', borderRadius: '5px', border: `1px solid ${isPinned ? 'rgba(201,168,76,0.4)' : 'var(--input-border)'}`, background: isPinned ? 'rgba(201,168,76,0.1)' : 'transparent', color: isPinned ? '#C9A84C' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
          {isPinned ? <Pin size={13} /> : <PinOff size={13} />}
          {isPinned ? 'Pinned' : 'Pin'}
        </button>

        <button onClick={() => setPreview((p) => !p)}
          style={{ height: '34px', padding: '0 0.625rem', borderRadius: '5px', border: '1px solid var(--input-border)', background: preview ? 'rgba(201,168,76,0.06)' : 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
          {preview ? <EyeOff size={13} /> : <Eye size={13} />}
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '0.75rem', minHeight: 0, marginBottom: '0.75rem' }}>
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="Write article content in Markdown…"
          style={{ flex: 1, resize: 'none', padding: '0.75rem', borderRadius: '5px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', fontFamily: 'monospace', minHeight: '200px', display: preview ? 'none' : 'block' }}
        />
        {preview && (
          <div
            className="markdown-body"
            style={{ flex: 1, padding: '0.75rem', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-card)', overflowY: 'auto', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) || '<em style="color:var(--text-secondary)">Nothing to preview</em>' }}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '0.45rem 1rem', background: 'var(--accent-gold)', color: '#1A1008', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '0.45rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        {article?.id && onDelete && (
          <div style={{ marginLeft: 'auto' }}>
            {deleteConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#7A2E1F' }}>Delete this article? This cannot be undone.</span>
                <button onClick={onDelete} disabled={deleting}
                  style={{ padding: '0.3rem 0.5rem', background: '#7A2E1F', color: 'white', border: 'none', borderRadius: '3px', fontSize: '0.7rem', cursor: 'pointer' }}>
                  {deleting ? '…' : 'Delete'}
                </button>
                <button onClick={() => setDeleteConfirm(false)}
                  style={{ padding: '0.3rem 0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  No
                </button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)}
                style={{ padding: '0.3rem 0.5rem', background: 'transparent', border: '1px solid rgba(122,46,31,0.25)', borderRadius: '3px', cursor: 'pointer', color: '#7A2E1F', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WikiPage() {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WikiArticle | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/kb/wiki');
      setArticles(await res.json());
    } catch {
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const filtered = articles.filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase())
  );
  const pinned = filtered.filter((a) => a.isPinned);
  const byCategory = groupByCategory(filtered.filter((a) => !a.isPinned));

  async function handleSave(data: Partial<WikiArticle>) {
    setSaving(true);
    try {
      let res: Response;
      if (editing && selected?.id) {
        res = await fetch(`/api/admin/kb/wiki/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      } else {
        res = await fetch('/api/admin/kb/wiki', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      }
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Something went wrong'); return; }
      const saved: WikiArticle = await res.json();
      toast.success('Article saved');
      await fetchArticles();
      setSelected(saved);
      setEditing(false);
      setCreating(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/kb/wiki/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      toast.success('Article deleted');
      setSelected(null);
      setEditing(false);
      await fetchArticles();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setDeleting(false);
    }
  }

  const isEditorOpen = editing || creating;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Wiki</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Internal SOPs, reminders, and reference articles.</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(false); setSelected(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'var(--accent-gold)', color: '#1A1008', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
          <Plus size={14} /> New Article
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', minHeight: '500px' }}>
        {/* Article list sidebar */}
        <div className="card" style={{ width: '260px', flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles…"
              style={{ width: '100%', height: '32px', padding: '0 0.625rem', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {loading ? (
              <div style={{ padding: '0.5rem' }}>
                {[1,2,3,4].map((i) => <div key={i} className="skeleton" style={{ height: '38px', marginBottom: '4px', borderRadius: '4px' }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {articles.length === 0 ? 'No articles yet. Create your first one!' : 'No articles match your search.'}
              </div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <>
                    <div className="label-caps" style={{ padding: '0.375rem 0.5rem', fontSize: '0.58rem' }}>Pinned</div>
                    {pinned.map((a) => (
                      <ArticleListItem key={a.id} article={a} active={selected?.id === a.id}
                        onClick={() => { setSelected(a); setEditing(false); setCreating(false); }} />
                    ))}
                  </>
                )}
                {Object.entries(byCategory).map(([cat, arts]) => (
                  <div key={cat}>
                    <div className="label-caps" style={{ padding: '0.375rem 0.5rem', fontSize: '0.58rem' }}>{cat}</div>
                    {arts.map((a) => (
                      <ArticleListItem key={a.id} article={a} active={selected?.id === a.id}
                        onClick={() => { setSelected(a); setEditing(false); setCreating(false); }} />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isEditorOpen ? (
            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <ArticleEditor
                article={editing ? selected : null}
                onSave={handleSave}
                onCancel={() => { setCreating(false); setEditing(false); }}
                onDelete={editing ? handleDelete : undefined}
                saving={saving}
                deleting={deleting}
              />
            </div>
          ) : selected ? (
            <ArticleView article={selected} onEdit={() => setEditing(true)} />
          ) : (
            <WelcomePanel onNew={() => setCreating(true)} onSelect={(title, cat) => { setCreating(true); }} />
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleListItem({ article, active, onClick }: { article: WikiArticle; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '0.5rem 0.5rem',
      borderRadius: '4px', border: 'none', background: active ? 'rgba(201,168,76,0.1)' : 'transparent',
      cursor: 'pointer', textAlign: 'left', marginBottom: '1px',
    }}>
      {article.isPinned && <Pin size={10} style={{ color: '#C9A84C', flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: '0.8rem', color: active ? 'var(--text-primary)' : 'rgba(var(--text-primary-rgb,30,20,10),0.7)', fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {article.title}
      </span>
    </button>
  );
}

function ArticleView({ article, onEdit }: { article: WikiArticle; onEdit: () => void }) {
  return (
    <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            {article.isPinned && <Pin size={13} style={{ color: '#C9A84C' }} />}
            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: 'var(--bg-cream)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{article.category}</span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>{article.title}</h2>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Updated {new Date(article.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <button onClick={onEdit}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
          <Pencil size={12} /> Edit
        </button>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        {article.content ? (
          <div
            className="markdown-body"
            style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
          />
        ) : (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>This article has no content yet. Click Edit to add some.</div>
        )}
      </div>
    </div>
  );
}

function WelcomePanel({ onNew, onSelect }: { onNew: () => void; onSelect: (title: string, cat: string) => void }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <FileText size={36} style={{ color: 'var(--border)', marginBottom: '0.875rem' }} />
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Select an article or create a new one</h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '320px' }}>
        The wiki is your team&apos;s internal knowledge base for SOPs, policies, and how-to guides.
      </p>
      <button onClick={onNew}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#1A1008', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', marginBottom: '1.25rem' }}>
        <Plus size={14} /> Create New Article
      </button>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Suggested starting articles:</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {SUGGESTED.map(({ title, category }) => (
          <button key={title} onClick={() => { onNew(); }}
            style={{ padding: '0.3rem 0.625rem', background: 'var(--bg-cream)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            {title}
          </button>
        ))}
      </div>
    </div>
  );
}
