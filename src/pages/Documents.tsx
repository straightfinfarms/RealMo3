/* ============================================================================
 * Documents — the paper trail with AI summaries. In production this is the
 * Document Intelligence pipeline (OCR → extract → index → RAG); here the
 * registry + summaries demonstrate the UX.
 * ========================================================================== */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore, uid } from "@/store/store";
import { Badge, Modal, toast } from "@/components/ui";
import type { Doc } from "@/data/types";
import { todayISO } from "@/data/seed";

const KIND_META: Record<Doc["kind"], { icon: string; label: string }> = {
  purchase_agreement: { icon: "📝", label: "Purchase agreement" },
  mortgage: { icon: "🏦", label: "Mortgage" },
  insurance: { icon: "🛡", label: "Insurance" },
  lease: { icon: "📄", label: "Lease" },
  inspection: { icon: "🔍", label: "Inspection" },
  invoice: { icon: "🧾", label: "Invoice" },
  permit: { icon: "📋", label: "Permit" },
  photo: { icon: "🖼", label: "Photo" },
  other: { icon: "📁", label: "Other" },
};

export function Documents() {
  const docs = useStore((s) => s.docs);
  const properties = useStore((s) => s.properties);
  const addDoc = useStore((s) => s.addDoc);
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs
      .filter((d) => kindFilter === "all" || d.kind === kindFilter)
      .filter(
        (d) =>
          !needle ||
          d.name.toLowerCase().includes(needle) ||
          (d.aiSummary ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => b.addedDate.localeCompare(a.addedDate));
  }, [docs, q, kindFilter]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Documents</div>
          <div className="section-sub">
            Search across names <i>and</i> AI summaries — ask the Copilot about any document's contents
          </div>
        </div>
        <div className="spacer">
          <button className="btn" onClick={() => setAdding(true)}>+ Add document</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="⌕ Search documents and summaries…"
          value={q} onChange={(e) => setQ(e.target.value)}
          style={{
            flex: 1, minWidth: 240, background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "8px 14px", color: "var(--text)", fontSize: 13, outline: "none",
          }}
        />
        <select
          value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "8px 12px", color: "var(--text)", fontSize: 12.5,
          }}
        >
          <option value="all">All types</option>
          {Object.entries(KIND_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="grid g2">
        {filtered.length === 0 && (
          <div className="card empty" style={{ gridColumn: "1 / -1" }}>
            <div className="empty-icon">▤</div>
            <div>No documents match.</div>
          </div>
        )}
        {filtered.map((d) => {
          const p = properties.find((x) => x.id === d.propertyId);
          const meta = KIND_META[d.kind];
          return (
            <div className="card" key={d.id}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 22 }}>{meta.icon}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="strong" style={{ fontSize: 13 }}>{d.name}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge color="gray">{meta.label}</Badge>
                    {p && (
                      <Link to={`/properties/${p.id}`}>
                        <Badge color="blue">{p.name}</Badge>
                      </Link>
                    )}
                    <span className="faint" style={{ fontSize: 11 }}>{d.addedDate}</span>
                  </div>
                  {d.aiSummary && (
                    <div style={{
                      marginTop: 9, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55,
                      background: "var(--surface-2)", borderRadius: 8, padding: "8px 11px",
                      borderLeft: "2px solid var(--purple)",
                    }}>
                      <span style={{ color: "var(--purple)", fontWeight: 650, fontSize: 10.5 }}>✦ AI SUMMARY · </span>
                      {d.aiSummary}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <AddDocModal
          onClose={() => setAdding(false)}
          onAdd={(doc) => {
            addDoc(doc);
            setAdding(false);
            toast("Document registered");
          }}
        />
      )}
    </div>
  );
}

function AddDocModal(props: { onClose: () => void; onAdd: (d: Doc) => void }) {
  const properties = useStore((s) => s.properties);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Doc["kind"]>("other");
  const [propertyId, setPropertyId] = useState("");
  const [note, setNote] = useState("");

  return (
    <Modal title="Register document" onClose={props.onClose}>
      <p className="card-sub" style={{ marginBottom: 14 }}>
        Local-first build tracks document metadata; file storage + OCR ingestion arrive with the backend (see BLUEPRINT.md).
      </p>
      <div className="grid g2">
        <div className="field"><label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Insurance Renewal 2026" autoFocus /></div>
        <div className="field"><label>Type</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as Doc["kind"])}>
            {Object.entries(KIND_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label>Property</label>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Portfolio-level</option>
            {properties.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label>Note / summary</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={props.onClose}>Cancel</button>
        <button className="btn" disabled={!name.trim()} onClick={() =>
          props.onAdd({
            id: uid(), propertyId: propertyId || null, name: name.trim(), kind,
            addedDate: todayISO(), note: note.trim() || undefined,
          })
        }>Register</button>
      </div>
    </Modal>
  );
}
