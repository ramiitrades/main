'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';

// ---------------------------------------------------------------
// Game plan page  (app/game-plan/page.js)
// - View mode: the daily read-through before you trade
// - Edit mode: write rules, entry models, and add reference pictures
// Pictures are stored in your existing "trade-photos" bucket.
// ---------------------------------------------------------------

const MAX_MODEL_PHOTOS = 4;
const MAX_GALLERY = 12;
const BUCKET = 'trade-photos';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const todayKey = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const EMPTY = { rules: [], models: [], gallery: [], last_read_on: null };
const hasContent = (p) => p.rules.length > 0 || p.models.length > 0 || p.gallery.length > 0;

const thumbStyle = {
  display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover',
  borderRadius: 8, border: '1px solid var(--border)', background: '#000',
};
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 };
const cardStyle = { border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--bg-alt)' };

// ---------- small shared pieces ----------
function Section({ title, hint, children }) {
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 21, margin: 0 }}>{title}</h2>
        {hint && <div style={{ color: 'var(--text-dim)', fontSize: 12.5, marginTop: 4 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function AddTile({ onFiles, disabled, label = '+' }) {
  return (
    <label style={{
      aspectRatio: '4 / 3', border: '1px dashed var(--border)', borderRadius: 8, display: 'flex',
      alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer',
      color: 'var(--text-dim)', fontSize: 13, opacity: disabled ? 0.5 : 1, textAlign: 'center', padding: 6,
    }}>
      {label}
      <input
        type="file" accept="image/*" multiple disabled={disabled} style={{ display: 'none' }}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
      />
    </label>
  );
}

function RemoveX({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Remove" style={{
      position: 'absolute', top: -6, right: -6, background: 'var(--red)', color: '#fff', border: 'none',
      borderRadius: '50%', width: 22, height: 22, fontSize: 13, cursor: 'pointer',
    }}>×</button>
  );
}

// ---------- VIEW MODE ----------
function PlanView({ plan, onOpen }) {
  return (
    <>
      <Section title="My rules" hint="Non-negotiable. If I break one, the trade doesn't count as following my plan.">
        {plan.rules.length === 0 ? (
          <div style={{ color: 'var(--text-dim)' }}>No rules yet. Tap Edit to add your first one.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.rules.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  flex: '0 0 28px', height: 28, borderRadius: '50%', background: 'rgba(62,207,142,.14)',
                  border: '1px solid rgba(62,207,142,.4)', color: 'var(--green, #3ecf8e)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                }}>{i + 1}</div>
                <div style={{ fontSize: 16, lineHeight: 1.5, paddingTop: 2, whiteSpace: 'pre-wrap' }}>{r.text}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Entry models" hint="The only setups I'm allowed to take.">
        {plan.models.length === 0 ? (
          <div style={{ color: 'var(--text-dim)' }}>No entry models yet. Tap Edit to add one.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {plan.models.map((m) => (
              <div key={m.id} style={cardStyle}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{m.name || 'Untitled model'}</div>
                {m.notes && <div style={{ color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: m.photos.length ? 14 : 0 }}>{m.notes}</div>}
                {m.photos.length > 0 && (
                  <div style={gridStyle}>
                    {m.photos.map((url, i) => (
                      <img key={i} src={url} alt="" style={{ ...thumbStyle, cursor: 'zoom-in' }} onClick={() => onOpen(url)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {plan.gallery.length > 0 && (
        <Section title="Reference pictures" hint="Charts and examples to keep in mind.">
          <div style={gridStyle}>
            {plan.gallery.map((g) => (
              <div key={g.id}>
                <img src={g.url} alt="" style={{ ...thumbStyle, cursor: 'zoom-in' }} onClick={() => onOpen(g.url)} />
                {g.caption && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>{g.caption}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ---------- EDIT MODE ----------
function PlanEditor({ plan, a, uploading }) {
  const inputStyle = {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--text)', padding: '10px 12px', fontSize: 14,
  };
  return (
    <>
      <Section title="My rules" hint="One rule per line. Order = priority. Keep them short and checkable.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.rules.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 22, color: 'var(--text-dim)', fontSize: 13 }}>{i + 1}.</div>
              <input
                type="text" style={inputStyle} value={r.text} placeholder="e.g. Max 3 trades per session"
                onChange={(e) => a.updateRule(r.id, e.target.value)}
              />
              <button type="button" className="del-btn" onClick={() => a.moveRule(r.id, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button type="button" className="del-btn" onClick={() => a.moveRule(r.id, 1)} disabled={i === plan.rules.length - 1} aria-label="Move down">↓</button>
              <button type="button" className="del-btn" onClick={() => a.deleteRule(r.id)} aria-label="Delete rule">×</button>
            </div>
          ))}
        </div>
        <button type="button" className="toggle-btn" style={{ marginTop: 14 }} onClick={a.addRule}>+ Add rule</button>
      </Section>

      <Section title="Entry models" hint="Name each model, write exactly what has to be true, and add pictures of what a good one looks like.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {plan.models.map((m) => (
            <div key={m.id} style={cardStyle}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <input
                  type="text" style={inputStyle} value={m.name} placeholder="Model name, e.g. LVN continuation"
                  onChange={(e) => a.updateModel(m.id, { name: e.target.value })}
                />
                <button type="button" className="del-btn" onClick={() => a.deleteModel(m.id)} aria-label="Delete model">Delete</button>
              </div>
              <textarea
                style={{ ...inputStyle, minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }}
                value={m.notes} placeholder="Criteria: what must be true to take it, where the stop goes, when to skip it..."
                onChange={(e) => a.updateModel(m.id, { notes: e.target.value })}
              />
              <div style={{ ...gridStyle, marginTop: 12 }}>
                {m.photos.map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={thumbStyle} />
                    <RemoveX onClick={() => a.removeModelPhoto(m.id, i)} />
                  </div>
                ))}
                {m.photos.length < MAX_MODEL_PHOTOS && (
                  <AddTile disabled={uploading} label={uploading ? 'Uploading…' : '+ Photo'} onFiles={(f) => a.addModelPhotos(m.id, f)} />
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="toggle-btn" style={{ marginTop: 14 }} onClick={a.addModel}>+ Add entry model</button>
      </Section>

      <Section title="Reference pictures" hint={`Any extra charts or examples you want in front of you. Up to ${MAX_GALLERY}.`}>
        <div style={gridStyle}>
          {plan.gallery.map((g) => (
            <div key={g.id}>
              <div style={{ position: 'relative' }}>
                <img src={g.url} alt="" style={thumbStyle} />
                <RemoveX onClick={() => a.removeGalleryItem(g.id)} />
              </div>
              <input
                type="text" style={{ ...inputStyle, marginTop: 6, padding: '7px 9px', fontSize: 12.5 }}
                value={g.caption} placeholder="Caption" onChange={(e) => a.updateCaption(g.id, e.target.value)}
              />
            </div>
          ))}
          {plan.gallery.length < MAX_GALLERY && (
            <AddTile disabled={uploading} label={uploading ? 'Uploading…' : '+ Add pictures'} onFiles={a.addGalleryPhotos} />
          )}
        </div>
      </Section>
    </>
  );
}

// ---------- PAGE ----------
export default function GamePlanPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    await load(user.id, true);
  }

  async function load(userId, firstLoad = false) {
    const { data, error } = await supabase.from('gameplans').select('*').eq('user_id', userId).maybeSingle();
    if (error) { setLoadError(error.message); setLoading(false); return; }
    const p = data
      ? { rules: data.rules || [], models: data.models || [], gallery: data.gallery || [], last_read_on: data.last_read_on || null }
      : EMPTY;
    setPlan(p);
    setDirty(false);
    if (firstLoad) setEditing(!hasContent(p)); // brand new plan? start in edit mode
    else setEditing(false);
    setLoading(false);
  }

  // ----- helpers that change the plan -----
  const change = (fn) => { setPlan((p) => fn(p)); setDirty(true); };

  async function uploadImage(file) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${user.id}/gameplan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file);
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function uploadMany(files, room) {
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (!picked.length) return [];
    setUploading(true);
    try {
      const urls = [];
      for (const f of picked) urls.push(await uploadImage(f));
      return urls;
    } catch (e) {
      alert('Photo upload failed: ' + e.message);
      return [];
    } finally {
      setUploading(false);
    }
  }

  const actions = {
    addRule: () => change((p) => ({ ...p, rules: [...p.rules, { id: uid(), text: '' }] })),
    updateRule: (id, text) => change((p) => ({ ...p, rules: p.rules.map((r) => (r.id === id ? { ...r, text } : r)) })),
    deleteRule: (id) => change((p) => ({ ...p, rules: p.rules.filter((r) => r.id !== id) })),
    moveRule: (id, dir) => change((p) => {
      const i = p.rules.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.rules.length) return p;
      const rules = [...p.rules];
      [rules[i], rules[j]] = [rules[j], rules[i]];
      return { ...p, rules };
    }),

    addModel: () => change((p) => ({ ...p, models: [...p.models, { id: uid(), name: '', notes: '', photos: [] }] })),
    updateModel: (id, patch) => change((p) => ({ ...p, models: p.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    deleteModel: (id) => {
      if (!confirm('Delete this entry model?')) return;
      change((p) => ({ ...p, models: p.models.filter((m) => m.id !== id) }));
    },
    addModelPhotos: async (id, files) => {
      const m = plan.models.find((x) => x.id === id);
      if (!m) return;
      const urls = await uploadMany(files, MAX_MODEL_PHOTOS - m.photos.length);
      if (urls.length) change((p) => ({ ...p, models: p.models.map((x) => (x.id === id ? { ...x, photos: [...x.photos, ...urls] } : x)) }));
    },
    removeModelPhoto: (id, idx) =>
      change((p) => ({ ...p, models: p.models.map((m) => (m.id === id ? { ...m, photos: m.photos.filter((_, i) => i !== idx) } : m)) })),

    addGalleryPhotos: async (files) => {
      const urls = await uploadMany(files, MAX_GALLERY - plan.gallery.length);
      if (urls.length) change((p) => ({ ...p, gallery: [...p.gallery, ...urls.map((url) => ({ id: uid(), url, caption: '' }))] }));
    },
    removeGalleryItem: (id) => change((p) => ({ ...p, gallery: p.gallery.filter((g) => g.id !== id) })),
    updateCaption: (id, caption) => change((p) => ({ ...p, gallery: p.gallery.map((g) => (g.id === id ? { ...g, caption } : g)) })),
  };

  async function save() {
    setSaving(true);
    const clean = {
      rules: plan.rules.filter((r) => r.text.trim()),
      models: plan.models.filter((m) => m.name.trim() || m.notes.trim() || m.photos.length),
      gallery: plan.gallery,
    };
    const { error } = await supabase
      .from('gameplans')
      .upsert({ user_id: user.id, ...clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setPlan((p) => ({ ...p, ...clean }));
    setDirty(false);
    setEditing(false);
  }

  function cancelEdit() {
    if (dirty && !confirm('Discard your unsaved changes?')) return;
    load(user.id);
  }

  async function markRead() {
    const today = todayKey();
    const { error } = await supabase.from('gameplans').upsert({ user_id: user.id, last_read_on: today }, { onConflict: 'user_id' });
    if (error) { alert(error.message); return; }
    setPlan((p) => ({ ...p, last_read_on: today }));
  }

  const readToday = plan.last_read_on === todayKey();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <div className="content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 28, margin: 0 }}>Game plan</h1>
              <p style={{ color: 'var(--text-dim)', margin: '6px 0 0' }}>
                {editing ? 'Write the plan you want to trade by.' : 'Read this before you trade. Trade the plan, not the mood.'}
              </p>
            </div>
            {!loading && !loadError && !editing && (
              <button type="button" className="toggle-btn" onClick={() => setEditing(true)}>Edit</button>
            )}
          </div>

          {loading && <div style={{ color: 'var(--text-dim)' }}>Loading your game plan…</div>}

          {loadError && (
            <div className="panel" style={{ color: 'var(--red)' }}>
              Couldn&apos;t load your game plan: {loadError}
              <div style={{ color: 'var(--text-dim)', marginTop: 8, fontSize: 13 }}>
                If this says the table doesn&apos;t exist, run the game plan SQL in Supabase first.
              </div>
            </div>
          )}

          {!loading && !loadError && !editing && (
            <>
              {hasContent(plan) && (
                <div className="panel" style={{
                  marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 12, flexWrap: 'wrap',
                }}>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {readToday ? '✓ You read your game plan today. Go trade it.' : 'Read your rules and models, then confirm before you take a trade.'}
                  </div>
                  {!readToday && <button type="button" className="add-btn" onClick={markRead}>I&apos;ve read my game plan</button>}
                </div>
              )}
              <PlanView plan={plan} onOpen={setLightbox} />
            </>
          )}

          {!loading && !loadError && editing && (
            <>
              <PlanEditor plan={plan} a={actions} uploading={uploading} />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 40 }}>
                <button type="button" className="add-btn" disabled={saving || uploading} onClick={save}>
                  {saving ? 'Saving…' : 'Save game plan'}
                </button>
                {hasContent(plan) || dirty ? (
                  <button type="button" className="del-btn" style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '10px 16px' }} onClick={cancelEdit}>
                    Cancel
                  </button>
                ) : null}
                {dirty && <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Unsaved changes</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.92)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out',
          }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
