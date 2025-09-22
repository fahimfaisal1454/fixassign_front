import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";

export default function MyStudents() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // dropdown state
  const [classes, setClasses] = useState([]);          // [{id, name}]
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sections, setSections] = useState([]);        // [{id, name}]
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [subjects, setSubjects] = useState([]);        // [{id, name}]
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  // timetable slots (scoped to logged-in teacher by backend)
  const [slots, setSlots] = useState([]);

  // 1) Load MY timetable
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await AxiosInstance.get("timetable/");
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        if (!cancelled) setSlots(list);
      } catch (e) {
        console.error("Timetable load failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2) Build CLASSES list from my timetable
  useEffect(() => {
    const unique = new Map();
    for (const s of slots) {
      const classId = String(s.class_id ?? s.class_name ?? s.class);
      if (!classId) continue;
      if (!unique.has(classId)) {
        unique.set(classId, {
          id: classId,
          name: s.class_label || s.class_name || `Class ${classId}`,
        });
      }
    }
    setClasses(Array.from(unique.values()));
  }, [slots]);

  // 3) When class changes, derive SECTIONS from timetable
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId("");
      setSubjects([]);
      setSelectedSubjectId("");
      return;
    }
    const unique = new Map();
    for (const s of slots) {
      const classId   = String(s.class_id ?? s.class_name ?? s.class);
      const sectionId = String(s.section_id ?? s.section);
      if (classId === String(selectedClassId) && sectionId) {
        if (!unique.has(sectionId)) {
          unique.set(sectionId, { id: sectionId, name: s.section_label || s.section || "" });
        }
      }
    }
    setSections(Array.from(unique.values()));
    setSelectedSectionId("");
    setSubjects([]);
    setSelectedSubjectId("");
  }, [selectedClassId, slots]);

  // 4) When class+section change, derive SUBJECTS from timetable
  useEffect(() => {
    if (!selectedClassId || !selectedSectionId) {
      setSubjects([]);
      setSelectedSubjectId("");
      return;
    }
    const unique = new Map();
    for (const s of slots) {
      const classId   = String(s.class_id ?? s.class_name ?? s.class);
      const sectionId = String(s.section_id ?? s.section);
      const subjectId = String(s.subject_id ?? s.subject);
      if (classId === String(selectedClassId) && sectionId === String(selectedSectionId) && subjectId) {
        if (!unique.has(subjectId)) {
          unique.set(subjectId, { id: subjectId, name: s.subject_label || s.subject_name || "" });
        }
      }
    }
    setSubjects(Array.from(unique.values()));
    setSelectedSubjectId("");
  }, [selectedClassId, selectedSectionId, slots]);

  // 5) Fetch students when class, section & subject are chosen
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedClassId || !selectedSectionId || !selectedSubjectId) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const { data } = await AxiosInstance.get("students/", {
          params: {
            class_id: selectedClassId,
            section_id: selectedSectionId,
            subject_id: selectedSubjectId,
          },
        });
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load students", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedSectionId, selectedSubjectId]);

  // search filter
  const filtered = useMemo(() => {
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter((s) =>
      (s.full_name || "").toLowerCase().includes(needle) ||
      String(s.roll_number || "").toLowerCase().includes(needle) ||
      (s.class_name_label || "").toLowerCase().includes(needle) ||
      (s.section_label || "").toLowerCase().includes(needle)
    );
  }, [q, rows]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <h2 className="text-xl font-semibold">My Students</h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* Class select */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Section select */}
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            disabled={!selectedClassId}
            className="px-3 py-2 border rounded-lg text-sm bg-white disabled:bg-slate-100"
          >
            <option value="">Select section…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Subject select */}
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            disabled={!selectedClassId || !selectedSectionId || subjects.length === 0}
            className="px-3 py-2 border rounded-lg text-sm bg-white disabled:bg-slate-100"
          >
            <option value="">Select subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Search box */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64 px-3 py-2 border rounded-lg text-sm"
            placeholder="Search by name, roll, class, section…"
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 gap-3 p-3 text-sm font-medium bg-slate-50 border-b">
          <div>#</div>
          <div>Name</div>
          <div>Roll</div>
          <div>Class</div>
          <div>Section</div>
          <div>Photo</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm">Loading…</div>
        ) : filtered.length ? (
          filtered.map((s, i) => (
            <div key={s.id} className="grid grid-cols-6 gap-3 p-3 text-sm border-b last:border-b-0">
              <div>{i + 1}</div>
              <div>{s.full_name}</div>
              <div>{s.roll_number ?? "-"}</div>
              <div>{s.class_name_label || s.class_name}</div>
              <div>{s.section_label || s.section || "-"}</div>
              <div>
                {s.photo ? (
                  <img src={s.photo} alt={s.full_name} className="h-9 w-9 rounded-full object-cover border" />
                ) : "—"}
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-sm text-slate-500">
            {selectedClassId && selectedSectionId && selectedSubjectId
              ? "No students found."
              : "Pick class, section & subject to load students."}
          </div>
        )}
      </div>
    </div>
  );
}
