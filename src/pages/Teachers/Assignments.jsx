// src/pages/Teachers/Assignments.jsx
import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function TeacherAssignments() {
  const [timetable, setTimetable] = useState([]);
  const [list, setList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);

  // We store selections by a stable "key" (prefer id, else label)
  const [selected, setSelected] = useState({
    classKey: "",
    sectionKey: "",
    subjectKey: "",
    title: "",
    instructions: "",
    due_date: "",
  });

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

  // ---------------- Normalization helpers ----------------
  const toStr = (v) => (v === 0 ? "0" : v == null ? "" : String(v));
  const isNum = (v) => /^\d+$/.test(toStr(v));

  const getId = (o, keys) => {
    for (const k of keys) {
      const v = o?.[k];
      if (v && typeof v === "object" && isNum(v.id)) return toStr(v.id);
      if (isNum(v)) return toStr(v);
    }
    return ""; // no numeric id
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

  // Build a flat set of rows with both ID and label for each dimension,
  // plus a "key" we can use in selects (prefer id, else label).
  const rows = useMemo(() => {
    const raw = Array.isArray(timetable) ? timetable : (timetable?.results || []);
    return (raw || []).map((t) => {
      const classId    = getId(t, ["class_id", "class_name_id", "class_name", "class"]);
      const classLabel = getLabel(t, ["class_label", "class_name", "class"], classId);

      const sectionId    = getId(t, ["section_id", "section"]);
      const sectionLabel = getLabel(t, ["section_label", "section_name", "section"], sectionId);

      const subjectId    = getId(t, ["subject_id", "subject"]);
      const subjectLabel = getLabel(t, ["subject_label", "subject_name", "subject"], subjectId);

      const classKey   = classId || classLabel;
      const sectionKey = sectionId || sectionLabel;
      const subjectKey = subjectId || subjectLabel;

      return {
        classId, classLabel, classKey,
        sectionId, sectionLabel, sectionKey,
        subjectId, subjectLabel, subjectKey,
      };
    })
    // keep only rows that at least have a class label/key
    .filter(r => r.classKey && r.sectionKey && r.subjectKey);
  }, [timetable]);

  // ---------------- Cascading options (unique by key) ----------------
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

  // ---------------- Resolve chosen trio to IDs/labels for POST ----------------
  const resolveSelection = () => {
    // Find any row matching the current selection
    const hit = rows.find(r =>
      r.classKey === selected.classKey &&
      r.sectionKey === selected.sectionKey &&
      r.subjectKey === selected.subjectKey
    );
    if (!hit) return null;
    return {
      class_id: hit.classId,   // may be "", use label fallback below
      class_label: hit.classLabel,
      section_id: hit.sectionId,
      section_label: hit.sectionLabel,
      subject_id: hit.subjectId,
      subject_label: hit.subjectLabel,
    };
  };

  // ---------------- Submit ----------------
  const submit = async (e) => {
    e.preventDefault();

    if (!selected.classKey || !selected.sectionKey || !selected.subjectKey) {
      toast.error("Pick Class, Section and Subject.");
      return;
    }
    if (!selected.title || !file) {
      toast.error("Set a title and choose a PDF.");
      return;
    }

    const resolved = resolveSelection();
    if (!resolved) {
      toast.error("Invalid selection. Pick options again.");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();

      // Prefer numeric IDs if available; otherwise send labels (backend can accept labels if you enabled that).
      fd.append("class_name", resolved.class_id || resolved.class_label);
      fd.append("section",    resolved.section_id || resolved.section_label);
      fd.append("subject",    resolved.subject_id || resolved.subject_label);

      fd.append("title", selected.title);
      if (selected.instructions) fd.append("instructions", selected.instructions);
      if (selected.due_date) fd.append("due_date", selected.due_date);
      fd.append("file", file);

      await AxiosInstance.post("assignments/", fd); // multipart handled automatically
      toast.success("Assignment uploaded");

      setSelected({ classKey: "", sectionKey: "", subjectKey: "", title: "", instructions: "", due_date: "" });
      setFile(null);
      await loadMine();
    } catch (e) {
      console.error("Upload failed:", e?.response?.data || e);
      // helpful error bubble from server if available
      const msg = e?.response?.data?.detail || "Upload failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Pretty labels for list ----------------
  const labelMaps = useMemo(() => {
    const classes = new Map(classOptions.map(o => [o.key, o.label]));
    const sections = new Map(sectionOptions.map(o => [o.key, o.label]));
    const subjects = new Map(subjectOptions.map(o => [o.key, o.label]));
    rows.forEach(r => {
      if (!classes.has(r.classKey)) classes.set(r.classKey, r.classLabel);
      if (!sections.has(r.sectionKey)) sections.set(r.sectionKey, r.sectionLabel);
      if (!subjects.has(r.subjectKey)) subjects.set(r.subjectKey, r.subjectLabel);
    });
    return { classes, sections, subjects };
  }, [classOptions, sectionOptions, subjectOptions, rows]);

  const human = (a) => {
    // Try to map IDs back to labels; fall back to raw values
    const classKey = toStr(a.class_name ?? a.class_name_id ?? a.class ?? "");
    const sectionKey = toStr(a.section ?? a.section_id ?? "");
    const subjectKey = toStr(a.subject ?? a.subject_id ?? "");
    const cls = labelMaps.classes.get(classKey) ?? (a.class_label ?? a.class_name ?? a.class ?? classKey);
    const sec = labelMaps.sections.get(sectionKey) ?? (a.section_label ?? a.section ?? sectionKey);
    const sub = labelMaps.subjects.get(subjectKey) ?? (a.subject_label ?? a.subject ?? subjectKey);
    return { cls, sec, sub };
  };

  // ---------------- UI ----------------
  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold">Assignments</h2>

      {/* Upload form */}
      <form onSubmit={submit} className="bg-white rounded-xl border p-4 grid gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Class */}
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

          {/* Section */}
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

          {/* Subject */}
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

        {/* Title */}
        <input
          className="input input-bordered"
          placeholder="Title"
          value={selected.title}
          onChange={(e) => setSelected(s => ({ ...s, title: e.target.value }))}
        />

        {/* Instructions (optional) */}
        <textarea
          className="textarea textarea-bordered"
          placeholder="Instructions (optional)"
          value={selected.instructions}
          onChange={(e) => setSelected(s => ({ ...s, instructions: e.target.value }))}
        />

        {/* Due date (optional) */}
        <input
          type="date"
          className="input input-bordered"
          value={selected.due_date}
          onChange={(e) => setSelected(s => ({ ...s, due_date: e.target.value }))}
        />

        {/* File */}
        <input
          type="file"
          accept="application/pdf"
          className="file-input file-input-bordered"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Upload"}
        </button>
      </form>

      {/* My uploads */}
      <div className="bg-white rounded-xl border p-4">
        <div className="font-medium mb-2">My uploaded assignments</div>
        {list.length ? (
          <ul className="space-y-2">
            {list.map((a) => {
              const labels = human(a);
              return (
                <li key={a.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-sm opacity-70">
                      {labels.cls} • {labels.sec} • {labels.sub}
                      {a.due_date ? ` • Due: ${a.due_date}` : ""}
                    </div>
                  </div>
                  {a.file ? (
                    <a className="link" href={a.file} target="_blank" rel="noreferrer">Download PDF</a>
                  ) : (
                    <span className="opacity-60 text-sm">No file</span>
                  )}
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
