import { useEffect, useMemo, useState } from "react";
import Axios from "../../../components/AxiosInstance"
import AttendanceSheet from "../../Teachers/AttendanceSheet"; // ⬅️ adjust this path if your file lives elsewhere

export default function StudentAttendance() {
  // dropdown data
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // selections
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState(""); // optional

  // modal
  const [sheetOpen, setSheetOpen] = useState(false);

  // labels for quick context
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

  // 1) load classes (with embedded sections)
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

  // 2) when class changes, update sections + reset lower selections
  useEffect(() => {
    const cls = classes.find(c => String(c.id) === String(selectedClassId));
    setSections(cls?.sections || []);
    setSelectedSectionId("");
    setSubjects([]);
    setSelectedSubjectId("");
  }, [selectedClassId, classes]);

  // 3) derive subjects from teacher timetable rows for the chosen class+section
  useEffect(() => {
    (async () => {
      if (!selectedClassId || !selectedSectionId) {
        setSubjects([]); setSelectedSubjectId("");
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
        console.warn("Subjects lookup failed; subject will be optional.", e);
        setSubjects([]);
      }
    })();
  }, [selectedClassId, selectedSectionId]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Student Attendance (Monthly Sheet)</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
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
          <label className="block text-sm font-medium mb-1">Subject (optional)</label>
          <select
            value={selectedSubjectId}
            onChange={e=>setSelectedSubjectId(e.target.value)}
            className="select select-bordered w-full"
            disabled={!selectedClassId || !selectedSectionId}
          >
            <option value="">All subjects…</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => setSheetOpen(true)}
        disabled={!selectedClassId || !selectedSectionId}
      >
        Open Monthly Sheet
      </button>

      {(selectedClass || selectedSection || selectedSubject) && (
        <div className="mt-3 text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
          {selectedClass   && <div><b>Class:</b> {selectedClass.name}</div>}
          {selectedSection && <div><b>Section:</b> {selectedSection.name}</div>}
          {selectedSubject && <div><b>Subject:</b> {selectedSubject.name}</div>}
        </div>
      )}

      {sheetOpen && (
        <AttendanceSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          classId={selectedClassId}
          sectionId={selectedSectionId}
          subjectId={selectedSubjectId || undefined} // omit to combine all subjects
        />
      )}
    </div>
  );
}
