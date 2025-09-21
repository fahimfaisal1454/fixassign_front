import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function EnterMarks() {
  // dropdown data
  const [classes, setClasses] = useState([]);                   // [{id,name,sections:[{id,name}]}]
  const [sections, setSections] = useState([]);                 // derived from selected class
  const [subjects, setSubjects] = useState([]);                 // fetched by class
  const [exams, setExams] = useState([]);                       // fetched by class+section

  // selections
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examId, setExamId] = useState("");

  // students & marks
  const [students, setStudents] = useState([]);                 // fetched by class+section
  const [marks, setMarks] = useState({});                       // { [studentId]: "87" }
  const [loading, setLoading] = useState(false);

  // ───────────────────────────────────────────────────────────
  // 1) Load classes (with embedded sections)
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await AxiosInstance.get("class-names/");
        if (!cancelled) setClasses(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) toast.error("Failed to load classes.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ───────────────────────────────────────────────────────────
  // 2) When class changes → update sections, reset dependent state
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const cls = classes.find(c => String(c.id) === String(classId));
    setSections(cls?.sections || []);
    setSectionId("");
    setSubjectId("");
    setExamId("");
    setStudents([]);
    setMarks({});
  }, [classId, classes]);

  // ───────────────────────────────────────────────────────────
  // 3) Fetch subjects when class changes
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) { setSubjects([]); return; }
      try {
        const { data } = await AxiosInstance.get("subjects/", { params: { class_id: classId } });
        if (!cancelled) setSubjects(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSubjects([]);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  // ───────────────────────────────────────────────────────────
  // 4) Fetch exams for the chosen class+section
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !sectionId) { setExams([]); return; }
      try {
        const { data } = await AxiosInstance.get("exams/", {
          params: { class_name: classId, section: sectionId },
        });
        if (!cancelled) setExams(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setExams([]);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, sectionId]);

  // ───────────────────────────────────────────────────────────
  // 5) Fetch students when both class & section are chosen
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !sectionId) { setStudents([]); setMarks({}); return; }
      setLoading(true);
      try {
        const { data } = await AxiosInstance.get("students/", {
          params: { class_id: classId, section_id: sectionId },
        });
        const rows = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setStudents(rows);
          // keep any already-entered marks only for currently loaded students
          setMarks(prev => {
            const next = {};
            for (const s of rows) if (prev[s.id] != null) next[s.id] = prev[s.id];
            return next;
          });
        }
      } catch (e) {
        if (!cancelled) {
          setStudents([]);
          setMarks({});
          toast.error("Failed to load students.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, sectionId]);

  // ───────────────────────────────────────────────────────────
  // helpers
  // ───────────────────────────────────────────────────────────
  const currentClassName = useMemo(
    () => (classes.find(c => String(c.id) === String(classId))?.name) || "",
    [classes, classId]
  );
  const currentSectionName = useMemo(
    () => (sections.find(s => String(s.id) === String(sectionId))?.name) || "",
    [sections, sectionId]
  );
  const currentSubjectName = useMemo(
    () => (subjects.find(s => String(s.id) === String(subjectId))?.name) || "",
    [subjects, subjectId]
  );

  const setScore = (sid, val) => {
    // allow empty, else clamp to 0..100 numeric
    const raw = (val ?? "").toString().trim();
    if (raw === "") return setMarks(m => ({ ...m, [sid]: "" }));
    let num = Number(raw);
    if (Number.isNaN(num)) return; // ignore invalid key
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    setMarks(m => ({ ...m, [sid]: String(num) }));
  };

  const saveAll = async () => {
    if (!classId || !sectionId || !subjectId) return toast.error("Pick class, section and subject.");
    if (!examId) return toast.error("Pick an exam.");
    const payloads = students
      .map(s => ({ sid: s.id, score: marks[s.id] }))
      .filter(x => x.score !== "" && x.score != null);
    if (!payloads.length) return toast("Nothing to save.");

    let ok = 0, fail = 0;
    const btn = toast.loading("Saving marks…");
    for (const row of payloads) {
      try {
        await AxiosInstance.post("exam-marks/", {
          exam: Number(examId),
          student: Number(row.sid),
          subject: Number(subjectId),
          score: Number(row.score),
        });
        ok++;
      } catch {
        fail++;
      }
    }
    toast.dismiss(btn);
    if (fail) toast(`Saved ${ok}, failed ${fail}.`);
    else toast.success(`Saved ${ok} marks.`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Enter Marks</h1>

      {/* Filters */}
      <div className="bg-white border rounded-md p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          {/* Class */}
          <div>
            <label className="text-sm font-semibold">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full border rounded px-2 py-1 bg-white"
            >
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="text-sm font-semibold">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={!classId}
              className="w-full border rounded px-2 py-1 bg-white disabled:bg-slate-100"
            >
              <option value="">Select section…</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="text-sm font-semibold">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!classId}
              className="w-full border rounded px-2 py-1 bg-white disabled:bg-slate-100"
            >
              <option value="">Select subject…</option>
              {subjects.map(su => <option key={su.id} value={su.id}>{su.name}</option>)}
            </select>
          </div>

          {/* Exam */}
          <div>
            <label className="text-sm font-semibold">Exam</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              disabled={!classId || !sectionId}
              className="w-full border rounded px-2 py-1 bg-white disabled:bg-slate-100"
            >
              <option value="">Select exam…</option>
              {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-600">
          {currentClassName && currentSectionName && (
            <>Selected: <b>{currentClassName}</b> / <b>{currentSectionName}</b>{currentSubjectName ? <> / <b>{currentSubjectName}</b></> : null}</>
          )}
        </div>
      </div>

      {/* Students + entry */}
      <div className="bg-white border rounded-md overflow-hidden">
        <div className="px-4 py-2 text-sm font-semibold bg-slate-50 border-b">
          Students {loading ? "(loading…)" : `(${students.length})`}
        </div>

        {(!classId || !sectionId) && (
          <div className="p-4 text-sm text-slate-500">Pick class and section to load students.</div>
        )}

        {classId && sectionId && !loading && students.length === 0 && (
          <div className="p-4 text-sm text-slate-500">No students found.</div>
        )}

        {classId && sectionId && !loading && students.length > 0 && (
          <>
            <div className="grid grid-cols-6 gap-3 px-4 py-2 text-xs font-medium text-slate-600 border-b bg-slate-50">
              <div>#</div>
              <div>Name</div>
              <div>Roll</div>
              <div>Subject</div>
              <div>Exam</div>
              <div>Score (0–100)</div>
            </div>

            {students.map((s, i) => (
              <div key={s.id} className="grid grid-cols-6 gap-3 px-4 py-2 text-sm border-b last:border-b-0">
                <div>{i + 1}</div>
                <div>{s.full_name}</div>
                <div>{s.roll_number ?? "—"}</div>
                <div>{currentSubjectName || "—"}</div>
                <div>{exams.find(e => String(e.id) === String(examId))?.name || "—"}</div>
                <div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={marks[s.id] ?? ""}
                    onChange={(e) => setScore(s.id, e.target.value)}
                    className="w-28 border rounded px-2 py-1"
                    disabled={!subjectId || !examId}
                    placeholder="e.g. 78"
                  />
                </div>
              </div>
            ))}

            <div className="p-3 flex justify-end">
              <button
                onClick={saveAll}
                className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={!subjectId || !examId || students.length === 0}
              >
                Save all
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
