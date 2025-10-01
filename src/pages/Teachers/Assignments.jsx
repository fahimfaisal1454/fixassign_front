// src/pages/Teachers/Assignments.jsx
import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function TeacherAssignments() {
  const [timetable, setTimetable] = useState([]);
  const [list, setList] = useState([]);
  const [saving, setSaving] = useState(false);

  // Create form
  const [file, setFile] = useState(null);
  const [selected, setSelected] = useState({
    classKey: "",
    sectionKey: "",
    subjectKey: "",
    title: "",
    instructions: "",
    due_date: "",
  });

  // Edit form
  const [editing, setEditing] = useState(null);     // { id, title, instructions, due_date, fileUrl, _orig: {...} } | null
  const [editFile, setEditFile] = useState(null);   // File | null

  // ---------------- Load data ----------------
  useEffect(() => {
    (async () => {
      try {
        let r = await AxiosInstance.get("timetable/", { params: { user: "me" } });
        let rows = Array.isArray(r.data) ? r.data : (r.data?.results || []);
        if (!rows.length) {
          r = await AxiosInstance.get("timetable/", { params: { teacher: "me" } });
          rows = Array.isArray(r.data) ? r.data : (r.data?.results || []);
        }
        setTimetable(rows || []);
      } catch (e) {
        console.error("Timetable load failed:", e?.response?.data || e);
        toast.error("Failed to load your timetable");
      }
    })();
  }, []);

  const loadMine = async () => {
    try {
      const r = await AxiosInstance.get("assignments/", { params: { teacher: "me" } });
      setList(Array.isArray(r.data) ? r.data : (r.data?.results || []));
    } catch (e) {
      console.error("Assignments load failed:", e?.response?.data || e);
    }
  };
  useEffect(() => { loadMine(); }, []);

  // ---------------- Helpers ----------------
  const toStr = (v) => (v === 0 ? "0" : v == null ? "" : String(v));
  const isNum = (v) => /^\d+$/.test(toStr(v));

  const getId = (o, keys) => {
    for (const k of keys) {
      const v = o?.[k];
      if (v && typeof v === "object" && isNum(v.id)) return toStr(v.id);
      if (isNum(v)) return toStr(v);
    }
    return "";
  };

  const getLabel = (o, keys, fallbackId = "") => {
    for (const k of keys) {
      const v = o?.[k];
      if (v == null) continue;
      if (typeof v === "object") {
        const lbl = v.name ?? v.label ?? v.title ?? v.code ?? v.short_name;
        if (lbl) return toStr(lbl);
      } else if (String(v).trim() !== "") {
        return toStr(v);
      }
    }
    return fallbackId ? toStr(fallbackId) : "";
  };

  const rows = useMemo(() => {
    const raw = Array.isArray(timetable) ? timetable : (timetable?.results || []);
    return (raw || []).map((t) => {
      const classId    = getId(t, ["class_id", "class_name_id", "class_name", "class"]);
      const classLabel = getLabel(t, ["class_label", "class_name", "class"], classId);

      const sectionId    = getId(t, ["section_id", "section"]);
      const sectionLabel = getLabel(t, ["section_label", "section_name", "section"], sectionId);

      const subjectId    = getId(t, ["subject_id", "subject"]);
      const subjectLabel = getLabel(t, ["subject_label", "subject_name", "subject"], subjectId);

      return {
        classId, classLabel, classKey: classId || classLabel,
        sectionId, sectionLabel, sectionKey: sectionId || sectionLabel,
        subjectId, subjectLabel, subjectKey: subjectId || subjectLabel,
      };
    })
    .filter(r => r.classKey && r.sectionKey && r.subjectKey);
  }, [timetable]);

  const classOptions = useMemo(() => {
    const m = new Map();
    rows.forEach(r => { if (!m.has(r.classKey)) m.set(r.classKey, { key: r.classKey, id: r.classId, label: r.classLabel }); });
    return [...m.values()];
  }, [rows]);

  const sectionOptions = useMemo(() => {
    if (!selected.classKey) return [];
    const m = new Map();
    rows.filter(r => r.classKey === selected.classKey)
        .forEach(r => { if (!m.has(r.sectionKey)) m.set(r.sectionKey, { key: r.sectionKey, id: r.sectionId, label: r.sectionLabel }); });
    return [...m.values()];
  }, [rows, selected.classKey]);

  const subjectOptions = useMemo(() => {
    if (!selected.classKey || !selected.sectionKey) return [];
    const m = new Map();
    rows.filter(r => r.classKey === selected.classKey && r.sectionKey === selected.sectionKey)
        .forEach(r => { if (!m.has(r.subjectKey)) m.set(r.subjectKey, { key: r.subjectKey, id: r.subjectId, label: r.subjectLabel }); });
    return [...m.values()];
  }, [rows, selected.classKey, selected.sectionKey]);

  const resolveSelection = () =>
    rows.find(r =>
      r.classKey === selected.classKey &&
      r.sectionKey === selected.sectionKey &&
      r.subjectKey === selected.subjectKey
    ) || null;

  // ---------------- Create ----------------
  const submit = async (e) => {
    e.preventDefault();

    if (!selected.classKey || !selected.sectionKey || !selected.subjectKey) {
      toast.error("Pick Class, Section and Subject.");
      return;
    }
    if (!selected.title) {
      toast.error("Set a title.");
      return;
    }

    const resolved = resolveSelection();
    if (!resolved || !resolved.classId || !resolved.sectionId || !resolved.subjectId) {
      toast.error("Invalid selection. Pick options again.");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("class_name", resolved.classId);   // numeric IDs only
      fd.append("section",    resolved.sectionId);
      fd.append("subject",    resolved.subjectId);
      fd.append("title", selected.title);
      // instructions is optional but we send it when present (can be empty string too)
      fd.append("instructions", selected.instructions || "");
      if (selected.due_date) fd.append("due_date", selected.due_date);
      // file is optional (PDF or image)
      if (file) fd.append("file", file);

      await AxiosInstance.post("assignments/", fd);
      toast.success("Assignment created");

      setSelected({ classKey: "", sectionKey: "", subjectKey: "", title: "", instructions: "", due_date: "" });
      setFile(null);
      await loadMine();
    } catch (e) {
      console.error("Create failed:", e?.response?.data || e);
      const msg = e?.response?.data?.detail || "Create failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Delete ----------------
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this assignment?")) return;
    try {
      await AxiosInstance.delete(`assignments/${id}/`);
      toast.success("Deleted");
      await loadMine();
    } catch (e) {
      console.error("Delete failed:", e?.response?.data || e);
      const msg = e?.response?.data?.detail || "Delete failed";
      toast.error(msg);
    }
  };

  // ---------------- Edit ----------------
  const openEdit = (a) => {
    // Make sure we keep the original so we can avoid sending unchanged fields if you want.
    const orig = {
      title: a.title || "",
      instructions: a.instructions ?? "",   // ensure we capture it even if empty
      due_date: a.due_date || "",
      fileUrl: a.file || "",
    };
    setEditing({ id: a.id, ...orig, _orig: orig });
    setEditFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    try {
      // PATCH multipart
      const fd = new FormData();

      // Always send these three fields (they're safe to update)
      fd.append("title", editing.title || "");
      // instructions can be empty string – we still send it to persist clearing
      fd.append("instructions", editing.instructions ?? "");
      if (editing.due_date) fd.append("due_date", editing.due_date);
      else fd.append("due_date", ""); // clear due date if user erased it

      // Replace file only if a new one was chosen
      if (editFile) fd.append("file", editFile);

      await AxiosInstance.patch(`assignments/${editing.id}/`, fd);
      toast.success("Updated");
      setEditing(null);
      setEditFile(null);
      await loadMine();
    } catch (e2) {
      console.error("Update failed:", e2?.response?.data || e2);
      const msg = e2?.response?.data?.detail || "Update failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditFile(null);
  };

  // ---------------- Pretty labels for list ----------------
  const labelMaps = useMemo(() => {
    // Build from all rows to ensure labels exist even when selects change
    const classes = new Map();
    const sections = new Map();
    const subjects = new Map();
    rows.forEach(r => {
      if (!classes.has(r.classId)) classes.set(r.classId, r.classLabel);
      if (!sections.has(r.sectionId)) sections.set(r.sectionId, r.sectionLabel);
      if (!subjects.has(r.subjectId)) subjects.set(r.subjectId, r.subjectLabel);
    });
    return { classes, sections, subjects };
  }, [rows]);

  const human = (a) => {
    const classKey = toStr(a.class_name ?? a.class_name_id ?? "");
    const sectionKey = toStr(a.section ?? a.section_id ?? "");
    const subjectKey = toStr(a.subject ?? a.subject_id ?? "");
    const cls = labelMaps.classes.get(classKey) ?? classKey;
    const sec = labelMaps.sections.get(sectionKey) ?? sectionKey;
    const sub = labelMaps.subjects.get(subjectKey) ?? subjectKey;
    return { cls, sec, sub };
  };

  // ---------------- UI ----------------
  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold">Assignments</h2>

      {/* Create / Edit form */}
      <form onSubmit={editing ? saveEdit : submit} className="bg-white rounded-xl border p-4 grid gap-3">
        {!editing && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="select select-bordered"
                value={selected.classKey}
                onChange={(e) => setSelected(s => ({ ...s, classKey: e.target.value, sectionKey: "", subjectKey: "" }))}
              >
                <option value="">Class</option>
                {classOptions.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>

              <select
                className="select select-bordered"
                value={selected.sectionKey}
                disabled={!selected.classKey}
                onChange={(e) => setSelected(s => ({ ...s, sectionKey: e.target.value, subjectKey: "" }))}
              >
                <option value="">Section</option>
                {sectionOptions.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>

              <select
                className="select select-bordered"
                value={selected.subjectKey}
                disabled={!selected.classKey || !selected.sectionKey}
                onChange={(e) => setSelected(s => ({ ...s, subjectKey: e.target.value }))}
              >
                <option value="">Subject</option>
                {subjectOptions.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>

            <input
              className="input input-bordered"
              placeholder="Title"
              value={selected.title}
              onChange={(e) => setSelected(s => ({ ...s, title: e.target.value }))}
            />

            <textarea
              className="textarea textarea-bordered"
              placeholder="Instructions (optional)"
              value={selected.instructions}
              onChange={(e) => setSelected(s => ({ ...s, instructions: e.target.value }))}
            />

            <input
              type="date"
              className="input input-bordered"
              value={selected.due_date}
              onChange={(e) => setSelected(s => ({ ...s, due_date: e.target.value }))}
            />

            <input
              type="file"
              accept="application/pdf,image/*"
              className="file-input file-input-bordered"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Upload"}
            </button>
          </>
        )}

        {editing && (
          <>
            <div className="alert">
              <span>Editing: <strong>{editing.title || "(untitled)"}</strong></span>
            </div>

            <input
              className="input input-bordered"
              placeholder="Title"
              value={editing.title}
              onChange={(e) => setEditing(s => ({ ...s, title: e.target.value }))}
            />

            <textarea
              className="textarea textarea-bordered"
              placeholder="Instructions (optional)"
              value={editing.instructions}
              onChange={(e) => setEditing(s => ({ ...s, instructions: e.target.value }))}
            />

            <input
              type="date"
              className="input input-bordered"
              value={editing.due_date || ""}
              onChange={(e) => setEditing(s => ({ ...s, due_date: e.target.value }))}
            />

            <div className="flex items-center gap-3">
              {editing.fileUrl ? (
                <a className="link" href={editing.fileUrl} target="_blank" rel="noreferrer">Current file</a>
              ) : (
                <span className="opacity-60 text-sm">No file uploaded</span>
              )}
            </div>

            <input
              type="file"
              accept="application/pdf,image/*"
              className="file-input file-input-bordered"
              onChange={(e) => setEditFile(e.target.files?.[0] || null)}
            />

            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn" onClick={cancelEdit}>Cancel</button>
            </div>
          </>
        )}
      </form>

      {/* My uploads */}
      <div className="bg-white rounded-xl border p-4">
        <div className="font-medium mb-2">My uploaded assignments</div>
        {list.length ? (
          <ul className="space-y-2">
            {list.map((a) => {
              const labels = human(a);
              const isImage = a.file && /\.(png|jpe?g|gif|webp)$/i.test(a.file);
              return (
                <li key={a.id} className="flex items-center justify-between border rounded p-2">
                  <div className="flex items-center gap-3">
                    {isImage && (
                      <img
                        src={a.file}
                        alt={a.title}
                        style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }}
                      />
                    )}
                    <div>
                      <div className="font-semibold">{a.title}</div>
                      <div className="text-sm opacity-70">
                        {labels.cls} • {labels.sec} • {labels.sub}
                        {a.due_date ? ` • Due: ${a.due_date}` : ""}
                      </div>
                      {a.instructions ? (
                        <div className="text-sm mt-1 line-clamp-2">{a.instructions}</div>
                      ) : null}
                      {a.file && !isImage && (
                        <a className="link text-sm" href={a.file} target="_blank" rel="noreferrer">Open file</a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="btn btn-sm" onClick={() => openEdit(a)}>Edit</button>
                    <button className="btn btn-sm btn-error" onClick={() => handleDelete(a.id)}>Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="opacity-70">No uploads yet.</div>
        )}
      </div>
    </div>
  );
}
