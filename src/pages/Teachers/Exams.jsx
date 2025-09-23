// src/pages/teachers/EnterMarks.jsx
import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";
import { toast, Toaster } from "react-hot-toast";

export default function EnterMarks() {
  // dropdown data (scoped to this teacher)
  const [classes, setClasses] = useState([]);     // [{id,name}]
  const [sections, setSections] = useState([]);   // [{id,name}] filtered by class
  const [subjects, setSubjects] = useState([]);   // [{id,name}] filtered by class+section
  const [exams, setExams] = useState([]);         // from backend by class+section

  // selections
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examId, setExamId] = useState("");

  // students & marks
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});         // form inputs being typed: { [studentId]: "87" }
  const [existingMarks, setExistingMarks] = useState({}); // server marks: { [studentId]: "87" } -> LOCKED
  const [loading, setLoading] = useState(false);

  // internal: normalized teacher assignments from timetable
  const [teachRows, setTeachRows] = useState([]);

  // keep track of the last successfully saved rows so the teacher can review
  const [lastSavedRows, setLastSavedRows] = useState([]); // [{sid, name, roll, score, subjectName, examName}]
  const [showSavedModal, setShowSavedModal] = useState(false);

  // manual/auto re-fetch trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // ───────────────────────────────────────────────────────────
  // 1) Load TEACHER's classes/sections/subjects from timetable/?user=me
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const normalize = (rows) => {
      const out = [];
      for (const r of rows) {
        const classId   = r.class_name_id ?? r.class_id ?? r.class_name ?? r.class;
        const className = r.class_name_label || r.class_name || r.class_label || String(classId || "");
        const sectionId   = r.section_id ?? r.section;
        const sectionName = r.section_label || r.section || String(sectionId || "");
        const subjectId   = r.subject_id ?? r.subject;
        const subjectName = r.subject_label || r.subject || String(subjectId || "");
        if (classId == null || sectionId == null || subjectId == null) continue;
        out.push({
          classId: String(classId),
          className: String(className || classId),
          sectionId: String(sectionId),
          sectionName: String(sectionName || sectionId),
          subjectId: String(subjectId),
          subjectName: String(subjectName || subjectId),
        });
      }
      return out;
    };

    (async () => {
      try {
        const res = await AxiosInstance.get("timetable/", { params: { user: "me" } });
        const rows = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setTeachRows(normalize(rows));
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setTeachRows([]);
          toast.error("Couldn't load your teaching assignments.");
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ───────────────────────────────────────────────────────────
  // 2) Build classes from teachRows
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const byClass = new Map();
    for (const r of teachRows) {
      if (!byClass.has(r.classId)) byClass.set(r.classId, r.className);
    }
    const list = Array.from(byClass.entries()).map(([id, name]) => ({ id, name }));
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    setClasses(list);

    // Reset selections if no longer valid
    if (classId && !byClass.has(String(classId))) {
      setClassId(""); setSectionId(""); setSubjectId(""); setExamId("");
      setStudents([]); setMarks({}); setExistingMarks({}); setLastSavedRows([]);
    }
  }, [teachRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────────────────────────────────────────────────────────
  // 3) Sections when class changes
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const set = new Map();
    for (const r of teachRows) {
      if (String(r.classId) !== String(classId)) continue;
      if (!set.has(r.sectionId)) set.set(r.sectionId, r.sectionName);
    }
    const list = Array.from(set.entries()).map(([id, name]) => ({ id, name }));
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    setSections(list);

    setSectionId(""); setSubjectId(""); setExamId("");
    setStudents([]); setMarks({}); setExistingMarks({}); setLastSavedRows([]);
  }, [classId, teachRows]);

  // ───────────────────────────────────────────────────────────
  // 4) Subjects when section changes
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const set = new Map();
    for (const r of teachRows) {
      if (String(r.classId) !== String(classId)) continue;
      if (String(r.sectionId) !== String(sectionId)) continue;
      if (!set.has(r.subjectId)) set.set(r.subjectId, r.subjectName);
    }
    const list = Array.from(set.entries()).map(([id, name]) => ({ id, name }));
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    setSubjects(list);

    setSubjectId(""); setExamId("");
    setMarks({}); setExistingMarks({}); setLastSavedRows([]);
  }, [classId, sectionId, teachRows]);

  // ───────────────────────────────────────────────────────────
  // 5) Exams for selected class+section
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !sectionId) { setExams([]); return; }
      try {
        const { data } = await AxiosInstance.get("exams/", {
          params: { class_name: classId, section: sectionId },
        });
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) setExams(list);
      } catch (err) {
        console.error(err);
        if (!cancelled) setExams([]);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, sectionId]);

  // ───────────────────────────────────────────────────────────
  // 6) Students in this class+section
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !sectionId) { setStudents([]); setMarks({}); setExistingMarks({}); return; }
      setLoading(true);
      try {
        const { data } = await AxiosInstance.get("students/", {
          params: { class_id: classId, section_id: sectionId },
        });
        const rows = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setStudents(rows);
          // preserve any typed scores for visible students
          setMarks(prev => {
            const next = {};
            for (const s of rows) if (prev[s.id] != null) next[s.id] = prev[s.id];
            return next;
          });
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setStudents([]); setMarks({}); setExistingMarks({});
          toast.error("Failed to load students.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, sectionId]);

  // ───────────────────────────────────────────────────────────
  // 7) Load EXISTING marks for the chosen exam + subject (LOCK them)
  //     Refreshable via refreshKey and after saves
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // reset when filters incomplete
      if (!examId || !subjectId) { setExistingMarks({}); return; }
      try {
        const res = await AxiosInstance.get("exam-marks/", {
          params: { exam: examId, subject: subjectId },
        });
        const arr = Array.isArray(res.data) ? res.data : [];
        const serverMap = {};
        for (const m of arr) serverMap[m.student] = m.score == null ? "" : String(m.score);
        if (!cancelled) {
          setExistingMarks(serverMap);
          // do NOT override current typing; we only lock inputs in UI
        }
      } catch (err) {
        console.warn("prefill/lock fetch failed", err);
        if (!cancelled) setExistingMarks({});
      }
    })();
    return () => { cancelled = true; };
  }, [examId, subjectId, classId, sectionId, refreshKey]);

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
  const currentExamName = useMemo(
    () => (exams.find(e => String(e.id) === String(examId))?.name) || "",
    [exams, examId]
  );

  const setScore = (sid, val) => {
    // allow empty, else clamp 0..100
    const raw = (val ?? "").toString().trim();
    if (raw === "") return setMarks(m => ({ ...m, [sid]: "" }));
    let num = Number(raw);
    if (Number.isNaN(num)) return; // ignore invalid input
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    setMarks(m => ({ ...m, [sid]: String(num) }));
  };

  // UPSERT: POST new mark; if 400 (exists), GET id and PATCH
  // Now we SKIP students who already have marks (locked).
  const saveAll = async () => {
    if (!classId || !sectionId || !subjectId) { toast.error("Pick class, section and subject."); return; }
    if (!examId) { toast.error("Pick an exam."); return; }

    const payloads = students
      .map(s => ({ sid: s.id, score: marks[s.id] }))
      .filter(x => x.score !== "" && x.score != null)
      .filter(x => existingMarks[x.sid] == null); // ← don't overwrite locked marks

    if (!payloads.length) {
      toast("Nothing to save (either empty or already locked).");
      return;
    }

    const btnId = toast.loading("Saving marks…");
    let ok = 0, fail = 0;

    for (const row of payloads) {
      const common = { exam: Number(examId), student: Number(row.sid), subject: Number(subjectId) };
      try {
        await AxiosInstance.post("exam-marks/", { ...common, score: Number(row.score) });
        ok++;
      } catch (err) {
        try {
          // in case backend returns 400 (exists) we still patch, but this should be rare because we skip locked
          const g = await AxiosInstance.get("exam-marks/", { params: common });
          const id = Array.isArray(g.data) ? g.data[0]?.id : g.data?.results?.[0]?.id;
          if (id) {
            await AxiosInstance.patch(`exam-marks/${id}/`, { score: Number(row.score) });
            ok++;
          } else {
            fail++;
          }
        } catch (e2) {
          console.error(e2);
          fail++;
        }
      }
    }

    toast.dismiss(btnId);

    // Build a friendly saved list for quick viewing
    const saved = payloads.map(({ sid, score }) => {
      const s = students.find(x => x.id === sid);
      return {
        sid,
        name: s?.full_name || `Student ${sid}`,
        roll: s?.roll_number ?? "—",
        score: String(score),
        subjectName: currentSubjectName || "—",
        examName: currentExamName || "—",
      };
    });
    setLastSavedRows(saved);

    // ✅ Clear marks from inputs after save
    setMarks({});

    if (fail) toast(`Saved ${ok}, failed ${fail}. Click "View saved marks" to review.`, { duration: 5000 });
    else toast.success(`Saved ${ok} marks. Click "View saved marks" to review.`, { duration: 4000 });

    // 🔄 Immediately re-fetch existing marks so newly saved rows become locked
    setRefreshKey(k => k + 1);
  };

  const doRefresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-6">
      {/* Hot Toast portal – required for toasts to show */}
      <Toaster position="top-right" />

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

          {/* Subject (restricted to teacher's assignment) */}
          <div>
            <label className="text-sm font-semibold">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!classId || !sectionId}
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

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-600">
            {currentClassName && currentSectionName && (
              <>Selected: <b>{currentClassName}</b> / <b>{currentSectionName}</b>{currentSubjectName ? <> / <b>{currentSubjectName}</b></> : null}</>
            )}
          </div>
          <button
            onClick={doRefresh}
            className="px-3 py-1.5 text-xs rounded border bg-white hover:bg-slate-50"
            disabled={!examId || !subjectId}
            title="Re-fetch existing marks for this exam & subject"
          >
            Refresh marks
          </button>
        </div>
      </div>

      {/* Students + entry */}
      <div className="bg-white border rounded-md overflow-hidden">
        <div className="px-4 py-2 text-sm font-semibold bg-slate-50 border-b flex items-center justify-between">
          <div>
            Students {loading ? "(loading…)" : `(${students.length})`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSavedModal(true)}
              disabled={!lastSavedRows.length}
              className="px-3 py-1.5 text-sm rounded border bg-white hover:bg-slate-50 disabled:opacity-60"
              title={lastSavedRows.length ? "View the marks you just saved" : "No recent saved marks yet"}
            >
              View saved marks{lastSavedRows.length ? ` (${lastSavedRows.length})` : ""}
            </button>
          </div>
        </div>

        {(!classId || !sectionId) && (
          <div className="p-4 text-sm text-slate-500">Pick class and section to load students.</div>
        )}

        {classId && sectionId && !loading && students.length === 0 && (
          <div className="p-4 text-sm text-slate-500">No students found.</div>
        )}

        {classId && sectionId && !loading && students.length > 0 && (
          <>
            <div className="grid grid-cols-7 gap-3 px-4 py-2 text-xs font-medium text-slate-600 border-b bg-slate-50">
              <div>#</div>
              <div>Name</div>
              <div>Roll</div>
              <div>Subject</div>
              <div>Exam</div>
              <div>Score (0–100)</div>
              <div className="text-center">Status</div>
            </div>

            {students.map((s, i) => {
              const lockedScore = existingMarks[s.id];  // if defined -> lock
              const isLocked = lockedScore !== undefined && lockedScore !== null && lockedScore !== "";
              const value = isLocked
                ? String(lockedScore)              // show server score
                : (marks[s.id] ?? "");             // show typing value

              return (
                <div key={s.id} className="grid grid-cols-7 gap-3 px-4 py-2 text-sm border-b last:border-b-0">
                  <div>{i + 1}</div>
                  <div>{s.full_name}</div>
                  <div>{s.roll_number ?? "—"}</div>
                  <div>{currentSubjectName || "—"}</div>
                  <div>{(exams.find(e => String(e.id) === String(examId))?.name) || "—"}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(e) => setScore(s.id, e.target.value)}
                      className={`w-28 border rounded px-2 py-1 ${isLocked ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""}`}
                      disabled={!subjectId || !examId || isLocked}
                      placeholder="e.g. 78"
                    />
                    {isLocked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                        🔒 locked
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    {isLocked ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                        Saved
                      </span>
                    ) : (
                      <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-xs">
                        Editable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="p-3 flex justify-end">
              <button
                onClick={saveAll}
                className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={!subjectId || !examId || students.length === 0}
                title="Save marks"
              >
                Save all
              </button>
            </div>
          </>
        )}
      </div>

      {/* Simple Modal for viewing last saved marks */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSavedModal(false)}
          />
          {/* dialog */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">
                Recently saved marks
                {currentExamName ? ` — ${currentExamName}` : ""}
                {currentSubjectName ? ` (${currentSubjectName})` : ""}
              </div>
              <button
                onClick={() => setShowSavedModal(false)}
                className="px-2 py-1 text-sm border rounded hover:bg-slate-50"
              >Close</button>
            </div>

            {lastSavedRows.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">Nothing saved yet in this session.</div>
            ) : (
              <div className="max-h-[60vh] overflow-auto">
                <div className="grid grid-cols-5 gap-3 px-4 py-2 text-xs font-medium text-slate-600 border-b bg-slate-50">
                  <div>#</div>
                  <div>Name</div>
                  <div>Roll</div>
                  <div>Score</div>
                  <div>Exam / Subject</div>
                </div>
                {lastSavedRows.map((r, i) => (
                  <div key={`${r.sid}-${i}`} className="grid grid-cols-5 gap-3 px-4 py-2 text-sm border-b last:border-b-0">
                    <div>{i + 1}</div>
                    <div>{r.name}</div>
                    <div>{r.roll}</div>
                    <div>{r.score}</div>
                    <div>{r.examName}{r.subjectName ? ` / ${r.subjectName}` : ""}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 flex justify-end gap-2">
              <button
                onClick={() => setLastSavedRows([])}
                className="px-3 py-1.5 text-sm rounded border bg-white hover:bg-slate-50"
                title="Clear the recent saved list (doesn't delete from server)"
              >
                Clear list
              </button>
              <button
                onClick={() => setShowSavedModal(false)}
                className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
