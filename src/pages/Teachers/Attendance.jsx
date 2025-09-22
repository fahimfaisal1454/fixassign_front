import { useEffect, useMemo, useState } from "react";
import Axios from "../../components/AxiosInstance";

const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const weekdayFromDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : WEEKDAYS[d.getDay()];
};

// helpers to be resilient to field names coming from your API
const idOf = (obj, ...keys) => {
  for (const k of keys) if (obj && obj[k] != null) return String(obj[k]);
  return "";
};
const slotClassId   = (s) => idOf(s, "class_name", "class_id", "class");
const slotSectionId = (s) => idOf(s, "section", "section_id");
const slotSubjectId = (s) => idOf(s, "subject", "subject_id");
const slotDayName   = (s) =>
  s?.day_of_week_display ||
  (Number.isInteger(s?.day_of_week) ? WEEKDAYS[s.day_of_week] : "");

/**
 * Attendance (teacher-scoped)
 * - Class/Section dropdowns are now filtered to only the teacher's timetable.
 */
export default function Attendance() {
  // inputs
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [allClasses, setAllClasses] = useState([]); // raw /class-names/ (with sections)
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [weekday, setWeekday] = useState(() => weekdayFromDate(new Date().toISOString().slice(0,10)));
  const [periodId, setPeriodId] = useState("");  // final timetable id when multiple periods match

  // timetable + rows
  const [slots, setSlots] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1) load classes (with sections)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await Axios.get("class-names/");
        setAllClasses(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load classes", e);
      }
    })();
  }, []);

  // 2) load my timetable (scoped to logged-in teacher)
  useEffect(() => {
    (async () => {
      try {
        const res = await Axios.get("timetable/");
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setSlots(list);
      } catch (e) {
        console.error("Timetable load failed", e);
      }
    })();
  }, []);

  // ---- NEW: derive allowed classes/sections from timetable ----
  // Map<classId, Set<sectionId>> for the teacher
  const allowedByClass = useMemo(() => {
    const m = new Map();
    for (const s of slots) {
      const cId = slotClassId(s);
      const secId = slotSectionId(s);
      if (!cId) continue;
      if (!m.has(cId)) m.set(cId, new Set());
      if (secId) m.get(cId).add(secId);
    }
    return m;
  }, [slots]);

  // Filtered classes list (only classes the teacher actually teaches).
  // Also filter the sections inside each class to only the teacher's sections.
  const classes = useMemo(() => {
    if (!allClasses.length) return [];
    if (allowedByClass.size === 0) return [];
    return allClasses
      .filter(c => allowedByClass.has(String(c.id)))
      .map(c => ({
        ...c,
        sections: (c.sections || []).filter(sec =>
          allowedByClass.get(String(c.id)).has(String(sec.id))
        ),
      }));
  }, [allClasses, allowedByClass]);

  // If current selection becomes invalid after filtering, reset it.
  useEffect(() => {
    if (selectedClassId && !classes.some(c => String(c.id) === String(selectedClassId))) {
      setSelectedClassId("");
      setSelectedSectionId("");
      setSelectedSubjectId("");
      setPeriodId("");
      setRows([]);
    }
  }, [classes, selectedClassId]);

  // 3) when class changes, set sections + reset lower selections
  useEffect(() => {
    const cls = classes.find(c => String(c.id) === String(selectedClassId));
    setSections(cls?.sections || []);
    setSelectedSectionId("");
    setSubjects([]);
    setSelectedSubjectId("");
    setPeriodId("");
    setRows([]);
  }, [selectedClassId, classes]);

  // 4) when class+section change, derive subjects from timetable (teacher-scoped)
  useEffect(() => {
    if (!selectedClassId || !selectedSectionId) {
      setSubjects([]); setSelectedSubjectId(""); setPeriodId(""); return;
    }
    const unique = new Map();
    for (const s of slots) {
      if (slotClassId(s) === String(selectedClassId) && slotSectionId(s) === String(selectedSectionId)) {
        const sid = slotSubjectId(s);
        const label = s.subject_label || s.subject_name || "";
        if (sid && !unique.has(sid)) unique.set(sid, { id: sid, name: label });
      }
    }
    setSubjects(Array.from(unique.values()));
    setSelectedSubjectId("");
    setPeriodId("");
    setRows([]);
  }, [selectedClassId, selectedSectionId, slots]);

  // 5) keep weekday synced to chosen date (but user can change manually)
  useEffect(() => {
    setWeekday(weekdayFromDate(date));
  }, [date]);

  // 6) compute matching periods for current filters
  const periodOptions = useMemo(() => {
    if (!selectedClassId || !selectedSectionId || !selectedSubjectId || !weekday) return [];
    return slots
      .filter(s =>
        slotClassId(s)   === String(selectedClassId) &&
        slotSectionId(s) === String(selectedSectionId) &&
        slotSubjectId(s) === String(selectedSubjectId) &&
        slotDayName(s)   === String(weekday)
      )
      .map(s => ({ id: s.id, label: `${s.start_time}-${s.end_time}` }));
  }, [slots, selectedClassId, selectedSectionId, selectedSubjectId, weekday]);

  // auto-select period when there is exactly one
  useEffect(() => {
    if (periodOptions.length === 1) setPeriodId(String(periodOptions[0].id));
    else setPeriodId("");
  }, [periodOptions.length]);

  // 7) LOAD roster like AttendanceReport: merge students + attendance list
  const loadRoster = async () => {
    if (!date || !selectedClassId || !selectedSectionId || !selectedSubjectId) return;
    setLoading(true);
    try {
      // 1) all students (source of truth for full_name)
      const stuReq = Axios.get("students/", {
        params: { class_id: selectedClassId, section_id: selectedSectionId },
      });
      // 2) existing attendance (exact date)
      const attReq = Axios.get("attendance/", {
        params: {
          class_id: selectedClassId,
          section_id: selectedSectionId,
          subject_id: selectedSubjectId,
          date,
        },
      });

      const [stuRes, attRes] = await Promise.all([stuReq, attReq]);
      const students = Array.isArray(stuRes.data) ? stuRes.data : stuRes.data?.results || [];
      const records  = Array.isArray(attRes.data) ? attRes.data : attRes.data?.results || [];

      const bySid = new Map(records.map(r => [String(r.student), r]));

      const merged = students.map(s => {
        const rec = bySid.get(String(s.id));
        return {
          student: s.id,
          student_name: s.full_name || s.name || "",
          status: rec?.status || "PRESENT",
          remarks: rec?.remarks || "",
          attendance_id: rec?.id ?? null,
        };
      });

      setRows(merged);
    } catch (e) {
      console.error("Roster/records load failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // 8) SAVE roster (bulk) via attendance/roster/
  const save = async () => {
    if (!rows.length) return;

    // For saving, we still require an actual timetable slot (period)
    let finalTimetableId = periodId || (periodOptions.length === 1 ? String(periodOptions[0].id) : "");
    if (!finalTimetableId) {
      alert("Please select the period/time before saving.");
      return;
    }

    setSaving(true);
    try {
      await Axios.post("attendance/roster/", {
        timetable: Number(finalTimetableId),
        date,
        rows: rows.map(({ student, status, remarks }) => ({ student, status, remarks })),
      });
      await loadRoster(); // refresh to pick up any new IDs
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  // UI helpers
  const setStatus = (idx, status) => setRows(r => r.map((row,i) => i===idx ? {...row, status} : row));
  const markAll = (status) => setRows(r => r.map(row => ({ ...row, status })));

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-4">Attendance</h1>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={date}
            onChange={e=>setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Class</label>
          <select
            className="select select-bordered w-full"
            value={selectedClassId}
            onChange={e=>setSelectedClassId(e.target.value)}
          >
            <option value="">Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Section</label>
          <select
            className="select select-bordered w-full"
            value={selectedSectionId}
            onChange={e=>setSelectedSectionId(e.target.value)}
            disabled={!selectedClassId}
          >
            <option value="">Select section…</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <select
            className="select select-bordered w-full"
            value={selectedSubjectId}
            onChange={e=>setSelectedSubjectId(e.target.value)}
            disabled={!selectedClassId || !selectedSectionId}
          >
            <option value="">Select subject…</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Day of week (for saving)</label>
          <select
            className="select select-bordered w-full"
            value={weekday}
            onChange={e=>setWeekday(e.target.value)}
            disabled={!selectedClassId || !selectedSectionId || !selectedSubjectId}
          >
            <option value="">Select day…</option>
            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Period (start-end) only matters when saving and there are multiple matches */}
        {(selectedClassId && selectedSectionId && selectedSubjectId && weekday) && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Period (time)</label>
            <select
              className="select select-bordered w-full"
              value={periodId}
              onChange={e=>setPeriodId(e.target.value)}
              disabled={periodOptions.length <= 1}
            >
              {periodOptions.length === 0 && <option value="">No period for this selection</option>}
              {periodOptions.length === 1 && <option value={periodOptions[0].id}>{periodOptions[0].label}</option>}
              {periodOptions.length > 1 && <>
                <option value="">-- choose --</option>
                {periodOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </>}
            </select>
          </div>
        )}

        <div className="md:col-span-6">
          <button
            className="btn btn-primary w-full"
            onClick={loadRoster}
            // Weekday/period NOT required to load (only required to save)
            disabled={!date || !selectedClassId || !selectedSectionId || !selectedSubjectId || loading}
          >
            {loading ? "Loading…" : "Load Roster"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button className="btn btn-outline btn-xs" disabled={!rows.length} onClick={()=>markAll("PRESENT")}>All Present</button>
        <button className="btn btn-outline btn-xs" disabled={!rows.length} onClick={()=>markAll("ABSENT")}>All Absent</button>
      </div>

      <div className="overflow-x-auto bg-white rounded border">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-4">Loading…</td></tr>
            ) : rows.length ? (
              rows.map((r, idx) => (
                <tr key={r.student}>
                  <td>{idx + 1}</td>
                  <td>{r.student_name}</td>
                  <td>
                    <div className="join">
                      {["PRESENT","ABSENT","LATE","EXCUSED"].map(st => (
                        <button
                          key={st}
                          className={`btn btn-xs join-item ${r.status === st ? "btn-primary" : "btn-outline"}`}
                          onClick={() => setStatus(idx, st)}
                          type="button"
                        >
                          {st[0] + st.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <input
                      className="input input-bordered input-xs w-full"
                      value={r.remarks || ""}
                      onChange={e => setRows(rows => rows.map((x,i)=> i===idx ? {...x, remarks: e.target.value} : x))}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="p-4 text-slate-500">
                {!selectedClassId ? "Pick a class to begin." :
                 !selectedSectionId ? "Pick a section." :
                 !selectedSubjectId ? "Pick a subject." :
                 "No students found for this selection."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <button className="btn btn-success" disabled={saving || rows.length === 0} onClick={save}>
          {saving ? "Saving…" : "Save Attendance"}
        </button>
      </div>
    </div>
  );
}
