/* ============================================================================
 * Pipeline — the BRRRR kanban. Every property flows Lead → … → Completed.
 * Stage moves are one click (◀ ▶) and are logged to the property timeline.
 * ========================================================================== */
import { useNavigate } from "react-router-dom";
import { useStore, dataSnapshot } from "@/store/store";
import { STAGES, STAGE_LABELS, type Stage } from "@/data/types";
import { underwrite, scoreDeal, fmtCompact, fmtMoney } from "@/engine/underwrite";
import { Badge, Cover, gradeColor, toast } from "@/components/ui";

/** Suggested actions per stage — the "what should I do next" layer. */
const STAGE_HINTS: Partial<Record<Stage, string>> = {
  lead: "Underwrite it. Kill fast or move fast.",
  offer: "Negotiate with the pricepoints from the Analyzer.",
  under_contract: "Run conditions: inspection, financing, insurance quote.",
  closing: "Confirm funds, lawyer, utilities transfer.",
  renovation: "Track budget weekly. Overruns compound.",
  ready_to_rent: "Photos, listing, screening criteria.",
  listed: "48h response time on applicants.",
  occupied: "Collect, maintain, season for refi.",
  refinancing: "Order appraisal, package rent roll + leases.",
  completed: "Capital recycled. Find the next one.",
};

export function Pipeline() {
  const nav = useNavigate();
  const properties = useStore((s) => s.properties);
  const moveStage = useStore((s) => s.moveStage);
  const todos = useStore((s) => s.todos);
  const data = dataSnapshot();

  const active = properties.filter((p) => !p.archived);

  const move = (id: string, dir: -1 | 1) => {
    const p = active.find((x) => x.id === id);
    if (!p) return;
    const idx = STAGES.indexOf(p.stage) + dir;
    if (idx < 0 || idx >= STAGES.length) return;
    moveStage(id, STAGES[idx]);
    toast(`${p.name} → ${STAGE_LABELS[STAGES[idx]]}`);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">BRRRR Pipeline</div>
          <div className="section-sub">
            {active.length} properties across {STAGES.length} stages — use ◀ ▶ to advance a deal
          </div>
        </div>
      </div>

      <div className="kanban">
        {STAGES.map((stage) => {
          const cards = active.filter((p) => p.stage === stage);
          return (
            <div className="kcol" key={stage}>
              <div className="kcol-head">
                <span className="kcol-title">{STAGE_LABELS[stage]}</span>
                <span className="kcol-count">{cards.length}</span>
              </div>
              {cards.map((p) => {
                const uw = underwrite(p.underwriting);
                const score = scoreDeal(uw);
                const openTasks = todos.filter((t) => t.propertyId === p.id && !t.done);
                const stageIdx = STAGES.indexOf(p.stage);
                return (
                  <div className="kcard" key={p.id} onClick={() => nav(`/properties/${p.id}`)}>
                    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                      <Cover hue={p.photoHue} name={p.name} size={30} radius={8} />
                      <div style={{ minWidth: 0 }}>
                        <div className="kcard-title">{p.name}</div>
                        <div className="kcard-sub">{p.city} · {uw.units} unit{uw.units > 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <div className="kcard-metrics">
                      <div><b>{fmtCompact(p.underwriting.price)}</b><span>Price</span></div>
                      <div><b>{fmtCompact(uw.arv)}</b><span>ARV</span></div>
                      <div>
                        <b className={uw.cfPerUnitMo < 0 ? "neg" : "pos"}>{fmtMoney(uw.cfPerUnitMo)}</b>
                        <span>CF/unit</span>
                      </div>
                    </div>
                    <div className="kcard-foot">
                      <Badge color={gradeColor(score.total)}>{score.total} · {score.grade}</Badge>
                      {openTasks.length > 0 && <Badge color="gray">☑ {openTasks.length}</Badge>}
                      <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}
                        onClick={(e) => e.stopPropagation()}>
                        <button className="iconbtn" style={{ width: 22, height: 22, fontSize: 11 }}
                          disabled={stageIdx === 0}
                          title="Previous stage"
                          onClick={() => move(p.id, -1)}>◀</button>
                        <button className="iconbtn" style={{ width: 22, height: 22, fontSize: 11 }}
                          disabled={stageIdx === STAGES.length - 1}
                          title="Next stage"
                          onClick={() => move(p.id, 1)}>▶</button>
                      </span>
                    </div>
                  </div>
                );
              })}
              {cards.length === 0 && (
                <div style={{
                  border: "1px dashed var(--border)", borderRadius: "var(--r-md)",
                  padding: "14px 12px", fontSize: 11, color: "var(--text-3)", lineHeight: 1.5,
                }}>
                  {STAGE_HINTS[stage] ?? "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
