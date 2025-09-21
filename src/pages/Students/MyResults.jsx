// StudentResults.jsx
import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/**
 * Student view:
 * - Pulls the student's own timetable (/timetable/?student=me) to infer class/section + subjects.
 * - Resolves the logged-in student's numeric ID via several common endpoints.
 * - Loads exams for that class+section.
 * - For a picked exam, fetches the student's marks per subject (published exams only).
 */
export default function StudentResults() {
  const [loadingBoot, setLoadingBoot] = useState(true);

  // derived from timetable
  const [timeRows, setTimeRows] = useState([]);
  const [classId, setClassId] = useState("");
  const [className, setClassName] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [subjects, setSubjects] = useState([]); // [{id, name}]

  // my student id
  const [studentId, setStudentId] = useState(null);

  // exams + selection
  const [exams, setExams] = useState([]); // [{id,name,is_published,...}]
  const [examId, setExamId] = useState("");

  // marks for selected exam keyed by subjectId
  const [marks, setMarks] = useState({}); // { [subjectId]: { score, letter, gpa } }
  const [loadingMarks, setLoadingMarks] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // Bootstrap: timetable + resolve student id
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) timetable to learn class, section, subjects
        const tt = await AxiosInstance.get("timetable/", { params: { student: "me" } });
        const rows = Array.isArray(tt.data) ? tt.data : [];
        if (cancelled) return;
        setTimeRows(rows);

        // derive class/section (most students are in one; if many, use the most frequent)
        const cMap = new Map();
        const sMap = new Map();
        const subjMap = new Map();
        for (const r of rows) {
          const cid = r.class_name_id ?? r.class_id ?? r.class_name;
          const cname = r.class_name_label || r.class_name || String(cid || "");
          const sid = r.section_id ?? r.section;
          const sname = r.section_label || r.section || String(sid || "");
          const subId = r.subject_id ?? r.subject;
          const subName = r.subject_label || r.subject || String(subId || "");
          if (cid != null) cMap.set(cid, (cMap.get(cid) || 0) + 1);
          if (sid != null) sMap.set(sid, (sMap.get(sid) || 0) + 1);
          if (subId != null && subName) subjMap.set(subId, subName);
        }

        // pick dominant class/section
        const best = (m) =>
          Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        const chosenClassId = best(cMap) ?? "";
        const chosenSectionId = best(sMap) ?? "";

        setClassId(String(chosenClassId || ""));
        setSectionId(String(chosenSectionId || ""));

        // set labels from a representative row
        const rep = rows.find(
          (r) =>
            String(r.class_name_id ?? r.class_id ?? r.class_name) ===
              String(chosenClassId) &&
            String(r.section_id ?? r.section) === String(chosenSectionId)
        );
        setClassName(rep?.class_name_label || rep?.class_name || "");
        setSectionName(rep?.section_label || rep?.section || "");

        // subjects list
        const subs = Array.from(subjMap.entries()).map(([id, name]) => ({
          id,
          name,
        }));
        subs.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        setSubjects(subs);
      } catch (e) {
        console.error(e);
        toast.error("Couldn't load your timetable.");
      }

      try {
        // 2) resolve my student id (try a few common patterns)
        const sid = await resolveMyStudentId();
        if (!cancelled) setStudentId(sid);
      } catch (e) {
        console.warn("Student id not resolved:", e?.message || e);
        if (!cancelled) setStudentId(null);
      } finally {
        if (!cancelled) setLoadingBoot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Load exams for class+section
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !sectionId) {
        setExams([]);
        setExamId("");
        return;
      }
      try {
        const { data } = await AxiosInstance.get("exams/", {
          params: { class_name: classId, section: sectionId },
        });
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setExams(list);
          // auto-select the most recent (first) if none selected yet
          if (!examId && list.length) setExamId(String(list[0].id));
        }
      } catch {
        if (!cancelled) setExams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sectionId]);

  // ───────────────────────────────────────────────────────────────────────────
  // Load marks when exam changes
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!examId || !studentId || subjects.length === 0) {
        setMarks({});
        return;
      }
      setLoadingMarks(true);
      try {
        const next = {};
        // fetch per subject (keeps backend fast/simple; small number of subjects)
        await Promise.all(
          subjects.map(async (s) => {
            try {
              const { data } = await AxiosInstance.get("exam-marks/", {
                params: {
                  exam: examId,
                  student: studentId, // backend only returns published if not staff
                  subject: s.id,
                },
              });
              const arr = Array.isArray(data) ? data : [];
              if (arr.length) {
                const m = arr[0];
                next[s.id] = {
                  score: m.score,
                  letter: m.letter,
                  gpa: m.gpa,
                };
              }
            } catch {
              /* ignore per-subject failures */
            }
          })
        );
        if (!cancelled) setMarks(next);
      } finally {
        if (!cancelled) setLoadingMarks(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, studentId, subjects]);

  const currentExamName = useMemo(
    () => exams.find((e) => String(e.id) === String(examId))?.name || "",
    [exams, examId]
  );

  const hasPublishWarning = useMemo(() => {
    const ex = exams.find((e) => String(e.id) === String(examId));
    return ex && !ex.is_published;
  }, [exams, examId]);

  // ───────────────────────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────────────────────
  if (loadingBoot) {
    return <div className="p-4 text-sm">Loading your data…</div>;
  }

  if (!classId || !sectionId) {
    return (
      <div className="p-4 space-y-3">
        <h2 className="text-xl font-semibold">My Results</h2>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-slate-600">
            We couldn't determine your class/section from your timetable. Ask the school
            to ensure your account is linked to a student profile and timetable.
          </p>
        </div>
      </div>
    );
  }

  if (studentId == null) {
    return (
      <div className="p-4 space-y-3">
        <h2 className="text-xl font-semibold">My Results</h2>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4">
          <p className="text-sm">
            Couldn't resolve your student profile. Marks may be unavailable.
            Please contact your school to link your login to your student record.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Results</h2>
        <div className="text-sm text-slate-600">
          {className && sectionName ? (
            <>
              Class: <b>{className}</b> • Section: <b>{sectionName}</b>
            </>
          ) : (
            "Class/Section"
          )}
        </div>
      </div>

      {/* Exam picker */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Exam</label>
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            disabled={!exams.length}
          >
            {!exams.length ? (
              <option value="">No exams available</option>
            ) : (
              exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))
            )}
          </select>

          {hasPublishWarning && (
            <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
              This exam isn’t published yet. Results will appear when published.
            </span>
          )}
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="text-sm font-semibold">
            {currentExamName ? currentExamName : "Results"}
          </div>
          <div className="text-xs text-slate-500">
            Only published exam results are visible.
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3 px-4 py-2 text-xs font-medium text-slate-600 border-b">
          <div>#</div>
          <div>Subject</div>
          <div className="text-right">Score</div>
          <div className="text-center">Letter</div>
          <div className="text-center">GPA</div>
          <div className="text-center">Status</div>
        </div>

        {!examId ? (
          <div className="p-4 text-sm text-slate-500">Select an exam to view marks.</div>
        ) : loadingMarks ? (
          <div className="p-4 text-sm">Loading marks…</div>
        ) : subjects.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No subjects found from your timetable.</div>
        ) : (
          subjects.map((s, i) => {
            const m = marks[s.id];
            const has = !!m && (m.score !== null && m.score !== undefined);
            return (
              <div
                key={s.id}
                className="grid grid-cols-6 gap-3 px-4 py-2 text-sm border-b last:border-b-0"
              >
                <div>{i + 1}</div>
                <div>{s.name}</div>
                <div className="text-right">{has ? String(m.score) : "—"}</div>
                <div className="text-center">{has ? (m.letter || "—") : "—"}</div>
                <div className="text-center">{has ? (m.gpa ?? "—") : "—"}</div>
                <div className="text-center">
                  {has ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                      Available
                    </span>
                  ) : (
                    <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-xs">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Tries multiple endpoints to get the current user's student id.
// Returns a number or throws.
async function resolveMyStudentId() {
  // 1) students/me/
  try {
    const r = await AxiosInstance.get("students/me/");
    const obj = Array.isArray(r.data) ? r.data[0] : r.data;
    const id = Number(obj?.id);
    if (!Number.isNaN(id)) return id;
  } catch {}

  // 2) students/?me=1
  try {
    const r = await AxiosInstance.get("students/", { params: { me: 1 } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const id = Number(arr[0]?.id);
    if (!Number.isNaN(id)) return id;
  } catch {}

  // 3) students/?user=me
  try {
    const r = await AxiosInstance.get("students/", { params: { user: "me" } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const id = Number(arr[0]?.id);
    if (!Number.isNaN(id)) return id;
  } catch {}

  // 4) students/?user_id=me
  try {
    const r = await AxiosInstance.get("students/", { params: { user_id: "me" } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const id = Number(arr[0]?.id);
    if (!Number.isNaN(id)) return id;
  } catch {}

  // If none work, try: students/?limit=1 ordered by current user (backend-dependent)
  try {
    const r = await AxiosInstance.get("students/", { params: { limit: 1 } });
    const arr = Array.isArray(r.data) ? r.data : (r.data?.results || []);
    const id = Number(arr[0]?.id);
    if (!Number.isNaN(id)) return id;
  } catch {}

  throw new Error("unresolved-student-id");
}
