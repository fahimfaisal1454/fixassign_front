import { useEffect, useMemo, useState } from "react";
import Axios from "../../components/AxiosInstance";
import AttendanceSheet from "./AttendanceSheet";

export default function AttendanceReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sheet modal
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filters
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [date, setDate] = useState("");

  // Labels
  const selectedClass = useMemo(
    () => classes.find(c => String(c.id) === String(selectedClassId)),
    [classes, selectedClassId]
  );
  const selectedSection = useMemo(
    () => sections.find(s => String(s.id) === String(selectedSectionId)),
    [sections, selectedSectionId]
  );
  const selectedSubject = useMemo(
    () => subjects.find(s => String(s.id) === String(selectedSubjectId)),
    [subjects, selectedSubjectId]
  );

  // Load classes (with sections)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await Axios.get("class-names/");
        setClasses(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load classes", e);
      }
    })();
  }, []);

  // When class changes, set sections and reset lower selections
  useEffect(() => {
    const cls = classes.find(c => String(c.id) === String(selectedClassId));
    setSections(cls?.sections || []);
    setSelectedSectionId("");
    setSubjects([]);
    setSelectedSubjectId("");
  }, [selectedClassId, classes]);

  // Derive subjects from the teacher's timetable for the chosen class+section
  useEffect(() => {
    (async () => {
      if (!selectedClassId || !selectedSectionId) {
        setSubjects([]);
        setSelectedSubjectId("");
        return;
      }
      try {
        const res = await Axios.get("timetable/", {
          params: { class_id: selectedClassId, section_id: selectedSectionId },
        });
        const items = Array.isArray(res.data) ? res.data : res.data?.results || [];
        const uniq = new Map();
        for (const r of items) {
          const id = r.subject || r.subject_id;
          const name = r.subject_label || r.subject_name || "";
          if (id && !uniq.has(id)) uniq.set(id, { id, name });
        }
        setSubjects(Array.from(uniq.values()));
      } catch (e) {
        console.error("Failed to load subjects from timetable", e);
        setSubjects([]);
      }
    })();
  }, [selectedClassId, selectedSectionId]);

  // Load attendance (exact date)
  const load = async () => {
    if (!selectedClassId || !selectedSectionId || !selectedSubjectId || !date) return;
    setLoading(true);
    try {
      const { data } = await Axios.get("attendance/", {
        params: {
          class_id: selectedClassId,
          section_id: selectedSectionId,
          subject_id: selectedSubjectId,
          date,
        },
      });
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      console.error("Failed to load attendance", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Update a record locally
  const updateRow = (idx, field, value) => {
    setRows(r => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  // Save a single record
  const saveRow = async (row) => {
    try {
      await Axios.patch(`attendance/${row.id}/`, { status: row.status, remarks: row.remarks });
      // optionally toast success
    } catch (e) {
      console.error("Failed to save", e);
    }
  };

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-4">Attendance Report</h1>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Class</label>
          <select
            value={selectedClassId}
            onChange={e=>setSelectedClassId(e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="">Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Section</label>
          <select
            value={selectedSectionId}
            onChange={e=>setSelectedSectionId(e.target.value)}
            className="select select-bordered w-full"
            disabled={!selectedClassId}
          >
            <option value="">Select section…</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <select
            value={selectedSubjectId}
            onChange={e=>setSelectedSubjectId(e.target.value)}
            className="select select-bordered w-full"
            disabled={!selectedClassId || !selectedSectionId}
          >
            <option value="">Select subject…</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e=>setDate(e.target.value)}
            className="input input-bordered w-full"
          />
        </div>

        <div className="flex items-end">
          <button
            className="btn btn-primary w-full"
            onClick={load}
            disabled={!selectedClassId || !selectedSectionId || !selectedSubjectId || !date || loading}
          >
            {loading ? "Loading…" : "Load Report"}
          </button>
        </div>

        <div className="flex items-end">
          <button
            className="btn btn-secondary w-full"
            onClick={() => setSheetOpen(true)}
            disabled={!selectedClassId || !selectedSectionId}
          >
            Open Attendance Sheet
          </button>
        </div>
      </div>

      {(selectedClass || selectedSection || selectedSubject || date) && (
        <div className="mb-2 text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
          {selectedClass && <div><b>Class:</b> {selectedClass.name}</div>}
          {selectedSection && <div><b>Section:</b> {selectedSection.name}</div>}
          {selectedSubject && <div><b>Subject:</b> {selectedSubject.name}</div>}
          {date && <div><b>Date:</b> {date}</div>}
          {!!rows.length && <div><b>Records:</b> {rows.length}</div>}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded border">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Student</th>
              <th>Status</th>
              <th>Remarks</th>
              <th>Save</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-4">Loading…</td></tr>
            ) : rows.length ? (
              rows.map((r, idx) => (
                <tr key={r.id}>
                  <td>{idx + 1}</td>
                  <td>{r.date}</td>
                  <td>{r.student_name}</td>
                  <td>
                    <select
                      value={r.status}
                      onChange={e=>updateRow(idx, "status", e.target.value)}
                      className="select select-bordered select-xs"
                    >
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="LATE">Late</option>
                      <option value="EXCUSED">Excused</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={r.remarks || ""}
                      onChange={e=>updateRow(idx, "remarks", e.target.value)}
                      className="input input-bordered input-xs w-full"
                    />
                  </td>
                  <td>
                    <button className="btn btn-xs btn-success" onClick={()=>saveRow(r)}>Save</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="p-4 text-slate-500">No records.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Attendance Sheet modal (monthly grid + download) */}
      {sheetOpen && (
        <AttendanceSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          classId={selectedClassId}
          sectionId={selectedSectionId}
          subjectId={selectedSubjectId}  // optional; remove if you want combined subjects
        />
      )}
    </div>
  );
}
