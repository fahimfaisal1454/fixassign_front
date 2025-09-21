import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

const EMPTY_ROW = { id: null, min_score: "", max_score: "", letter: "", gpa: "", _deleted: false };

export default function GradeScaleManager() {
  const [scales, setScales] = useState([]);
  const [name, setName] = useState("");
  const [bands, setBands] = useState([{ ...EMPTY_ROW }]);
  const [busy, setBusy] = useState(false);

  // edit state (per scale)
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editBands, setEditBands] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // Data loading
  // ───────────────────────────────────────────────────────────────────────────
  const load = async () => {
    try {
      const { data } = await AxiosInstance.get("grade-scales/");
      setScales(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load grade scales");
    }
  };
  useEffect(() => { load(); }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // CREATE (new scale)
  // ───────────────────────────────────────────────────────────────────────────
  const addBand = () => setBands((b) => [...b, { ...EMPTY_ROW }]);
  const rmBand  = (i) => setBands((b) => b.filter((_, idx) => idx !== i));
  const setBand = (i, k, v) => setBands((b) => b.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const normalized = useMemo(() => {
    const rows = bands
      .map(r => ({
        min_score: r.min_score === "" ? "" : Number(r.min_score),
        max_score: r.max_score === "" ? "" : Number(r.max_score),
        letter: (r.letter || "").toUpperCase().trim(),
        gpa: r.gpa === "" ? "" : Number(r.gpa),
      }))
      .filter(r =>
        !(r.min_score === "" && r.max_score === "" && r.letter === "" && r.gpa === "")
      );
    return rows;
  }, [bands]);

  const createErrors = useMemo(() => {
    const errs = [];
    const isNum = (x) => typeof x === "number" && !Number.isNaN(x);
    const rows = normalized;

    // base per-row validation
    rows.forEach((r, i) => {
      const e = {};
      if (!isNum(r.min_score) || r.min_score < 0 || r.min_score > 100) e.min = 1;
      if (!isNum(r.max_score) || r.max_score < 0 || r.max_score > 100) e.max = 1;
      if (isNum(r.min_score) && isNum(r.max_score) && r.min_score > r.max_score) e.range = 1;
      if (!r.letter) e.letter = 1;
      if (!(typeof r.gpa === "number" && !Number.isNaN(r.gpa))) e.gpa = 1;
      errs[i] = e;
    });

    // duplicates: letter + exact range
    const byLetter = new Map();
    const byRange = new Map();
    rows.forEach((r, i) => {
      if (r.letter) {
        const list = byLetter.get(r.letter) || [];
        byLetter.set(r.letter, [...list, i]);
      }
      if (Number.isFinite(r.min_score) && Number.isFinite(r.max_score)) {
        const key = `${r.min_score}-${r.max_score}`;
        const list = byRange.get(key) || [];
        byRange.set(key, [...list, i]);
      }
    });
    for (const [, idxs] of byLetter) {
      if (idxs.length > 1) idxs.forEach(i => (errs[i].dupLetter = 1));
    }
    for (const [, idxs] of byRange) {
      if (idxs.length > 1) idxs.forEach(i => (errs[i].dupRange = 1));
    }

    // overlap (same mark covered by different bands) → warning, not crash
    const sorted = rows
      .map((r, i) => ({ ...r, __i: i }))
      .filter(r => Number.isFinite(r.min_score) && Number.isFinite(r.max_score))
      .sort((a,b)=>a.min_score-b.min_score);

    for (let k=1; k<sorted.length; k++){
      const a = sorted[k-1], b = sorted[k];
      if (a.max_score >= b.min_score) {
        errs[a.__i].overlap = 1; errs[b.__i].overlap = 1;
      }
    }

    return errs;
  }, [normalized]);

  const hasCreateWarnings = useMemo(
    () => createErrors.some(e => e.overlap || e.dupLetter || e.dupRange),
    [createErrors]
  );

  const canCreate = useMemo(
    () =>
      !!name.trim() &&
      normalized.length > 0 &&
      createErrors.every(e => {
        const { min, max, range, letter, gpa } = e;
        // warnings (overlap/dups) don't block saving; hard errors do
        return !(min || max || range || letter || gpa);
      }),
    [name, normalized, createErrors]
  );

  const save = async () => {
    if (!canCreate) {
      toast.error("Fix the red errors first.");
      return;
    }
    if (hasCreateWarnings) {
      toast((t) => (
        <div>
          <div className="font-semibold mb-1">Warning</div>
          <div className="text-sm">Some bands overlap or duplicate. Continue?</div>
          <div className="mt-2 flex gap-2">
            <button
              className="px-2 py-1 rounded bg-rose-600 text-white"
              onClick={() => toast.dismiss(t.id)}
            >
              Review
            </button>
            <button
              className="px-2 py-1 rounded bg-emerald-600 text-white"
              onClick={async () => {
                toast.dismiss(t.id);
                await doSaveCreate();
              }}
            >
              Save anyway
            </button>
          </div>
        </div>
      ), { duration: 6000 });
      return;
    }
    await doSaveCreate();
  };

  const doSaveCreate = async () => {
    setBusy(true);
    try {
      const { data: scale } = await AxiosInstance.post("grade-scales/", {
        name: name.trim(), is_active: false
      });
      for (const b of normalized) {
        await AxiosInstance.post("grade-bands/", {
          scale: scale.id,
          min_score: b.min_score,
          max_score: b.max_score,
          letter: b.letter,
          gpa: b.gpa,
        });
      }
      toast.success("Scale saved");
      setName(""); setBands([{ ...EMPTY_ROW }]);
      await load();
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.name ||
        (typeof e?.response?.data === "string" ? e.response.data : "Save failed");
      toast.error(String(msg));
    } finally { setBusy(false); }
  };

  const activate = async (id) => {
    try {
      await AxiosInstance.patch(`grade-scales/${id}/`, { is_active: true });
      toast.success("Activated");
      await load();
    } catch { toast.error("Activation failed"); }
  };

  const delScale = async (id) => {
    if (!window.confirm("Delete this scale and all its bands?")) return;
    try {
      await AxiosInstance.delete(`grade-scales/${id}/`);
      toast.success("Deleted");
      if (editingId === id) { setEditingId(null); }
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // EDIT (existing scale)
  // ───────────────────────────────────────────────────────────────────────────
  const beginEdit = (scale) => {
    setEditingId(scale.id);
    setEditName(scale.name || "");
    const rows = (scale.bands || []).map(b => ({
      id: b.id,
      min_score: String(b.min_score ?? ""),
      max_score: String(b.max_score ?? ""),
      letter: String(b.letter ?? ""),
      gpa: String(b.gpa ?? ""),
      _deleted: false,
    }));
    setEditBands(rows.length ? rows : [{ ...EMPTY_ROW }]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditBands([]);
  };

  const addEditRow = () => setEditBands(b => [...b, { ...EMPTY_ROW }]);
  const markDeleteEditRow = (idx) =>
    setEditBands(b => b.map((r,i)=> i===idx ? { ...r, _deleted: !r._deleted } : r));
  const setEditRow = (idx, k, v) =>
    setEditBands(b => b.map((r,i)=> i===idx ? { ...r, [k]: v } : r));

  // ⚠️ safe, index-stable error calc (no indexOf on copies)
  const editErrors = useMemo(() => {
    const errs = editBands.map(() => ({}));
    const isNum = (x) => typeof x === "number" && !Number.isNaN(x);

    // Active (non-deleted) with original index i
    const active = editBands
      .map((r, i) => ({
        i,
        _deleted: !!r._deleted,
        min_score: r.min_score === "" ? "" : Number(r.min_score),
        max_score: r.max_score === "" ? "" : Number(r.max_score),
        letter: (r.letter || "").toUpperCase().trim(),
        gpa: r.gpa === "" ? "" : Number(r.gpa),
      }))
      .filter(r => !r._deleted);

    // Field-level checks
    for (const row of active) {
      const e = {};
      if (!isNum(row.min_score) || row.min_score < 0 || row.min_score > 100) e.min = 1;
      if (!isNum(row.max_score) || row.max_score < 0 || row.max_score > 100) e.max = 1;
      if (isNum(row.min_score) && isNum(row.max_score) && row.min_score > row.max_score) e.range = 1;
      if (!row.letter) e.letter = 1;
      if (!(typeof row.gpa === "number" && !Number.isNaN(row.gpa))) e.gpa = 1;
      errs[row.i] = e;
    }

    // duplicates (letter + exact range)
    const byLetter = new Map();
    const byRange = new Map();
    active.forEach((r) => {
      if (r.letter) {
        const list = byLetter.get(r.letter) || [];
        byLetter.set(r.letter, [...list, r.i]);
      }
      if (Number.isFinite(r.min_score) && Number.isFinite(r.max_score)) {
        const key = `${r.min_score}-${r.max_score}`;
        const list = byRange.get(key) || [];
        byRange.set(key, [...list, r.i]);
      }
    });
    for (const [, idxs] of byLetter) {
      if (idxs.length > 1) idxs.forEach(i => (errs[i].dupLetter = 1));
    }
    for (const [, idxs] of byRange) {
      if (idxs.length > 1) idxs.forEach(i => (errs[i].dupRange = 1));
    }

    // overlap (any shared marks between bands)
    const sorted = [...active]
      .filter(r => Number.isFinite(r.min_score) && Number.isFinite(r.max_score))
      .sort((a,b)=>a.min_score-b.min_score);
    for (let k=1; k<sorted.length; k++){
      const a = sorted[k-1], b = sorted[k];
      if (a.max_score >= b.min_score) {
        (errs[a.i] ||= {}).overlap = 1;
        (errs[b.i] ||= {}).overlap = 1;
      }
    }
    return errs;
  }, [editBands]);

  const hasEditWarnings = useMemo(
    () => editErrors.some(e => e.overlap || e.dupLetter || e.dupRange),
    [editErrors]
  );

  const canSaveEdit = useMemo(() => {
    if (!editingId) return false;
    const activeRows = editBands.filter(r => !r._deleted);
    // hard errors block save; warnings don’t
    const okRows = activeRows.length > 0 && editErrors.every(e => {
      const { min, max, range, letter, gpa } = e;
      return !(min || max || range || letter || gpa);
    });
    return !!editName.trim() && okRows;
  }, [editingId, editName, editBands, editErrors]);

  const saveEdit = async () => {
    if (!canSaveEdit) {
      toast.error("Fix the red errors first.");
      return;
    }
    if (hasEditWarnings) {
      toast((t) => (
        <div>
          <div className="font-semibold mb-1">Warning</div>
          <div className="text-sm">Some bands overlap or duplicate. Continue?</div>
          <div className="mt-2 flex gap-2">
            <button
              className="px-2 py-1 rounded bg-rose-600 text-white"
              onClick={() => toast.dismiss(t.id)}
            >
              Review
            </button>
            <button
              className="px-2 py-1 rounded bg-emerald-600 text-white"
              onClick={async () => {
                toast.dismiss(t.id);
                await doSaveEdit();
              }}
            >
              Save anyway
            </button>
          </div>
        </div>
      ), { duration: 6000 });
      return;
    }
    await doSaveEdit();
  };

  const doSaveEdit = async () => {
    setSavingEdit(true);
    try {
      // 1) update scale name (keep is_active as is)
      await AxiosInstance.patch(`grade-scales/${editingId}/`, { name: editName.trim() });

      // 2) upsert/delete bands
      for (let i = 0; i < editBands.length; i++) {
        const r = editBands[i];
        if (r._deleted && r.id) {
          await AxiosInstance.delete(`grade-bands/${r.id}/`);
          continue;
        }
        if (r._deleted && !r.id) continue; // brand new row marked delete

        // normalize values for persist
        const min = r.min_score === "" ? null : Number(r.min_score);
        const max = r.max_score === "" ? null : Number(r.max_score);
        const gpa = r.gpa === "" ? null : Number(r.gpa);
        const letter = (r.letter || "").toUpperCase().trim();

        if (r.id) {
          await AxiosInstance.patch(`grade-bands/${r.id}/`, {
            min_score: min,
            max_score: max,
            letter,
            gpa,
          });
        } else {
          await AxiosInstance.post("grade-bands/", {
            scale: editingId,
            min_score: min,
            max_score: max,
            letter,
            gpa,
          });
        }
      }

      toast.success("Updated");
      cancelEdit();
      await load();
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "Update failed");
      toast.error(String(msg));
    } finally {
      setSavingEdit(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // UI helpers
  // ───────────────────────────────────────────────────────────────────────────
  const rowErrText = (e) =>
    [
      e.min && "Min 0–100",
      e.max && "Max 0–100",
      e.range && "Min ≤ Max",
      e.overlap && "Overlaps another band",
      e.dupLetter && "Duplicate letter",
      e.dupRange && "Duplicate exact range",
      e.letter && "Letter required",
      e.gpa && "GPA must be a number",
    ].filter(Boolean).join(" • ");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Grade Scale</h1>

      {/* Create */}
      <div className="bg-white border p-4 rounded-md space-y-3">
        <div>
          <label className="text-sm font-semibold">Scale name</label>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Default 5.0"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="overflow-auto">
          <table className="min-w-[680px] text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-3 w-28">Min</th>
                <th className="py-1 pr-3 w-28">Max</th>
                <th className="py-1 pr-3 w-24">Letter</th>
                <th className="py-1 pr-3 w-24">GPA</th>
                <th className="py-1 pr-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b, i) => {
                const err = createErrors[i] || {};
                return (
                  <tr key={i} className="border-b align-top">
                    <td className="py-1 pr-3">
                      <input
                        className={`border rounded px-2 py-1 w-24 ${err.min || err.range || err.overlap ? "border-red-400" : ""}`}
                        value={b.min_score}
                        onChange={(e)=>setBand(i,"min_score",e.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <input
                        className={`border rounded px-2 py-1 w-24 ${err.max || err.range || err.overlap ? "border-red-400" : ""}`}
                        value={b.max_score}
                        onChange={(e)=>setBand(i,"max_score",e.target.value)}
                        inputMode="numeric"
                        placeholder="100"
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <input
                        className={`border rounded px-2 py-1 w-20 ${err.letter ? "border-red-400" : ""}`}
                        value={b.letter}
                        onChange={(e)=>setBand(i,"letter",e.target.value.toUpperCase())}
                        placeholder="A+"
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <input
                        className={`border rounded px-2 py-1 w-20 ${err.gpa ? "border-red-400" : ""}`}
                        value={b.gpa}
                        onChange={(e)=>setBand(i,"gpa",e.target.value)}
                        inputMode="decimal"
                        placeholder="5.00"
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <button className="text-xs text-red-600" onClick={()=>rmBand(i)}>Remove</button>
                      {Object.keys(err).length>0 && (
                        <div className="text-[11px] text-red-600 mt-1">{rowErrText(err)}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={addBand} className="px-3 py-1 border rounded">Add band</button>
          <button
            onClick={save}
            disabled={busy || !canCreate}
            className="px-3 py-1 rounded bg-[#2c8e3f] text-white disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save scale"}
          </button>
        </div>
      </div>

      {/* Existing */}
      <div className="bg-white border p-4 rounded-md">
        <h2 className="font-semibold">Existing</h2>
        {!scales.length ? (
          <p className="text-sm text-gray-600 mt-2">No scales yet.</p>
        ) : (
          <ul className="divide-y mt-2">
            {scales.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <li key={s.id} className="py-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1"
                          value={editName}
                          onChange={(e)=>setEditName(e.target.value)}
                        />
                      ) : (
                        <div className="font-medium">{s.name}</div>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${s.is_active ? "bg-green-100 text-green-700":"bg-gray-100 text-gray-600"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs text-gray-500">ID: {s.id}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!s.is_active && !isEditing && (
                        <button className="text-xs bg-black text-white rounded px-2 py-1" onClick={()=>activate(s.id)}>
                          Make Active
                        </button>
                      )}
                      {!isEditing ? (
                        <>
                          <button className="text-xs border rounded px-2 py-1" onClick={()=>beginEdit(s)}>Edit</button>
                          <button className="text-xs bg-rose-600 text-white rounded px-2 py-1" onClick={()=>delScale(s.id)}>Delete</button>
                        </>
                      ) : (
                        <>
                          <button
                            className="text-xs rounded px-2 py-1 bg-emerald-600 text-white disabled:opacity-60"
                            disabled={!canSaveEdit || savingEdit}
                            onClick={saveEdit}
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button className="text-xs border rounded px-2 py-1" onClick={cancelEdit}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bands table */}
                  {!isEditing ? (
                    Array.isArray(s.bands) && s.bands.length > 0 && (
                      <div className="overflow-auto mt-2">
                        <table className="min-w-[420px] text-xs">
                          <thead>
                            <tr className="text-left border-b">
                              <th className="py-1 pr-3">Range</th>
                              <th className="py-1 pr-3">Letter</th>
                              <th className="py-1 pr-3">GPA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.bands.map((b)=>(
                              <tr key={b.id} className="border-b">
                                <td className="py-1 pr-3">{b.min_score}–{b.max_score}</td>
                                <td className="py-1 pr-3">{b.letter}</td>
                                <td className="py-1 pr-3">{b.gpa}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    <div className="overflow-auto mt-3">
                      <table className="min-w-[680px] text-xs">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="py-1 pr-3 w-28">Min</th>
                            <th className="py-1 pr-3 w-28">Max</th>
                            <th className="py-1 pr-3 w-24">Letter</th>
                            <th className="py-1 pr-3 w-24">GPA</th>
                            <th className="py-1 pr-3 w-32"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {editBands.map((r, i) => {
                            const e = editErrors[i] || {};
                            const strike = r._deleted ? "line-through opacity-50" : "";
                            return (
                              <tr key={i} className="border-b align-top">
                                <td className="py-1 pr-3">
                                  <input
                                    className={`border rounded px-2 py-1 w-24 ${strike} ${e.min || e.range || e.overlap ? "border-red-400" : ""}`}
                                    value={r.min_score}
                                    onChange={(ev)=>setEditRow(i,"min_score",ev.target.value)}
                                    inputMode="numeric"
                                    disabled={r._deleted}
                                  />
                                </td>
                                <td className="py-1 pr-3">
                                  <input
                                    className={`border rounded px-2 py-1 w-24 ${strike} ${e.max || e.range || e.overlap ? "border-red-400" : ""}`}
                                    value={r.max_score}
                                    onChange={(ev)=>setEditRow(i,"max_score",ev.target.value)}
                                    inputMode="numeric"
                                    disabled={r._deleted}
                                  />
                                </td>
                                <td className="py-1 pr-3">
                                  <input
                                    className={`border rounded px-2 py-1 w-20 ${strike} ${e.letter ? "border-red-400" : ""}`}
                                    value={r.letter}
                                    onChange={(ev)=>setEditRow(i,"letter",ev.target.value.toUpperCase())}
                                    disabled={r._deleted}
                                  />
                                </td>
                                <td className="py-1 pr-3">
                                  <input
                                    className={`border rounded px-2 py-1 w-20 ${strike} ${e.gpa ? "border-red-400" : ""}`}
                                    value={r.gpa}
                                    onChange={(ev)=>setEditRow(i,"gpa",ev.target.value)}
                                    inputMode="decimal"
                                    disabled={r._deleted}
                                  />
                                </td>
                                <td className="py-1 pr-3">
                                  <button
                                    className={`text-xs px-2 py-0.5 rounded border ${r._deleted ? "bg-gray-100" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                                    onClick={()=>markDeleteEditRow(i)}
                                  >
                                    {r._deleted ? "Undo" : (r.id ? "Delete" : "Remove")}
                                  </button>
                                  {Object.keys(e).length>0 && !r._deleted && (
                                    <div className="text-[11px] text-red-600 mt-1">{rowErrText(e)}</div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="mt-2">
                        <button onClick={addEditRow} className="px-3 py-1 border rounded text-xs">Add band</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
