// src/pages/StudentResults.jsx
import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

/* ---------------- GPA → Letter using Admin Scale w/ Fallback ---------------- */
function letterFromGPA(gpa, scale) {
  const x = Number(gpa);
  if (!Number.isFinite(x)) return "";
  if (Array.isArray(scale) && scale.length) {
    const minVal = (r) =>
      Number(r.min_gpa ?? r.min ?? r.threshold ?? r.minGpa ?? r.cutoff ?? NaN);
    const sorted = [...scale]
      .filter((r) => Number.isFinite(minVal(r)) && r.letter)
      .sort((a, b) => minVal(b) - minVal(a));
    const row = sorted.find((r) => x >= minVal(r));
    if (row?.letter) return row.letter;
  }
  if (x >= 5.0) return "A+";
  if (x >= 4.0) return "A";
  if (x >= 3.5) return "A-";
  if (x >= 3.0) return "B";
  if (x >= 2.0) return "C";
  if (x >= 1.0) return "D";
  return "F";
}

const GRAND_ID = "__grand__";

/** Map an exam object to the required weight.
 *  1st = 0.25, 2nd = 0.25, Final = 0.50 (case/wording tolerant).
 *  If name doesn't match, default to 0 (ignored).
 */
function weightForExam(exam) {
  const name = String(exam?.name || "").toLowerCase().trim();
  if (!name) return 0;
  if (name.includes("final")) return 0.50;
  if (name.includes("2") || name.includes("second") || name.includes("2nd")) return 0.25;
  if (name.includes("1") || name.includes("first") || name.includes("1st")) return 0.25;
  return 0; // unknown terms won't affect the weighted total
}

/* ---------------- Component ---------------- */
export default function StudentResults() {
  const [loadingBoot, setLoadingBoot] = useState(true);

  // derived from timetable
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

  // marks for selected view keyed by subjectId
  const [marks, setMarks] = useState({}); // { [subjectId]: { score, letter, gpa } }
  const [loadingMarks, setLoadingMarks] = useState(false);

  // grade scale
  const [gradeScale, setGradeScale] = useState([]);

  /* ---------- Load grade scale once ---------- */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await AxiosInstance.get("grade-scales/");
        setGradeScale(Array.isArray(data) ? data : data?.results || []);
      } catch {
        setGradeScale([]);
      }
    })();
  }, []);

  /* ---------- Bootstrap: timetable + resolve student id ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tt = await AxiosInstance.get("timetable/", { params: { student: "me" } });
        const rows = Array.isArray(tt.data) ? tt.data : [];

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
          if (!className && cname) setClassName(cname);
          if (!sectionName && sname) setSectionName(sname);
        }

        const best = (m) =>
          Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        const chosenClassId = best(cMap) ?? "";
        const chosenSectionId = best(sMap) ?? "";

        if (!cancelled) {
          setClassId(String(chosenClassId || ""));
          setSectionId(String(chosenSectionId || ""));
          const subs = Array.from(subjMap.entries()).map(([id, name]) => ({ id, name }));
          subs.sort((a, b) => String(a.name).localeCompare(String(b.name)));
          setSubjects(subs);
        }
      } catch (e) {
        console.error(e);
        toast.error("Couldn't load your timetable.");
      }

      try {
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

  /* ---------- Load exams for class+section ---------- */
  useEffect(() => {
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
        setExams(list);
        if (!examId && list.length) setExamId(String(list[0].id));
      } catch {
        setExams([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sectionId]);

  /* ---------- Helper: fetch marks for ONE exam ---------- */
  const fetchMarksForExam = async (oneExamId) => {
    const map = {};
    await Promise.all(
      subjects.map(async (s) => {
        try {
          const { data } = await AxiosInstance.get("exam-marks/", {
            params: { exam: oneExamId, student: studentId, subject: s.id },
          });
          const arr = Array.isArray(data) ? data : [];
          if (arr.length) {
            const m = arr[0];
            map[s.id] = { score: m.score, letter: m.letter, gpa: m.gpa };
          }
        } catch {
          /* ignore */
        }
      })
    );
    return map;
  };

  /* ---------- Load marks when selection changes ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if ((!examId && examId !== GRAND_ID) || !studentId || subjects.length === 0) {
        setMarks({});
        return;
      }
      setLoadingMarks(true);

      try {
        // GRAND TOTAL (weighted: 1st 25% + 2nd 25% + Final 50%)
        if (examId === GRAND_ID) {
          // Only include exams that have a defined weight
          const weightedExams = exams
            .map((ex) => ({ ex, w: weightForExam(ex) }))
            .filter(({ w }) => w > 0);

          const perExam = await Promise.all(
            weightedExams.map(async ({ ex, w }) => ({
              w,
              map: await fetchMarksForExam(ex.id),
            }))
          );

          // combine -> per subject weighted average across available marks
          const combined = {};
          for (const s of subjects) {
            let wSum = 0;
            let scoreSum = 0;
            let gpaSum = 0;
            for (const item of perExam) {
              const m = item.map[s.id];
              if (m && m.score != null) {
                scoreSum += Number(m.score || 0) * item.w;
                gpaSum += Number(m.gpa || 0) * item.w;
                wSum += item.w;
              }
            }
            if (wSum > 0) {
              const wScore = scoreSum / wSum;
              const wGpa = gpaSum / wSum;
              combined[s.id] = {
                score: wScore,
                gpa: wGpa,
                letter: letterFromGPA(wGpa, gradeScale),
              };
            }
          }
          if (!cancelled) setMarks(combined);
          return;
        }

        // Single exam
        const single = await fetchMarksForExam(examId);
        if (!cancelled) setMarks(single);
      } finally {
        if (!cancelled) setLoadingMarks(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, studentId, subjects, exams, gradeScale]);

  /* ---------- Current exam name (handles grand) ---------- */
  const currentExamName = useMemo(() => {
    if (examId === GRAND_ID) return "Grand total (25% + 25% + 50%)";
    return exams.find((e) => String(e.id) === String(examId))?.name || "";
  }, [exams, examId]);

  /* ---------- Totals / Averages ---------- */
  const totals = useMemo(() => {
    const rows = subjects.map((s) => marks[s.id]).filter((m) => m && m.score != null);
    if (!rows.length) return null;
    const totalScore = rows.reduce((sum, m) => sum + Number(m.score || 0), 0);
    const avgGpa = rows.reduce((sum, m) => sum + Number(m.gpa || 0), 0) / rows.length;
    const avgLetter = letterFromGPA(avgGpa, gradeScale);
    return { totalScore, avgGpa, avgLetter, count: rows.length };
  }, [subjects, marks, gradeScale]);

  /* ---------- Downloads ---------- */
  const onDownloadCsv = () => {
    const headers = [
      "#",
      "Subject",
      examId === GRAND_ID ? "Weighted Score" : "Score",
      "Letter",
      examId === GRAND_ID ? "Weighted GPA" : "GPA",
      "Status",
    ];
    const rows = subjects.map((s, i) => {
      const m = marks[s.id];
      const has = !!m && (m.score !== null && m.score !== undefined);
      return [
        i + 1,
        s.name,
        has ? Number(m.score).toFixed(2) : "",
        has ? m.letter || "" : "",
        has && m.gpa != null ? Number(m.gpa).toFixed(2) : "",
        has ? "Available" : "Pending",
      ];
    });

    if (totals) {
      rows.push([]);
      rows.push([
        "Total",
        "",
        Number(totals.totalScore).toFixed(2),
        totals.avgLetter || "",
        Number(totals.avgGpa).toFixed(2),
        "",
      ]);
    }

    const csv =
      [headers, ...rows]
        .map((r) =>
          r
            .map((cell) => {
              const v = String(cell ?? "");
              if (v.includes(",") || v.includes('"') || v.includes("\n"))
                return `"${v.replace(/"/g, '""')}"`;
              return v;
            })
            .join(",")
        )
        .join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results_${currentExamName.replace(/\s+/g, "_")}_${className || "class"}_${sectionName || "section"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPrint = () => window.print();

  /* ---------- UI ---------- */
  if (loadingBoot) return <div className="p-4 text-sm">Loading your data…</div>;

  return (
    <div className="p-1 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Results</h2>
        <div className="text-sm text-slate-600">
          Class: <b>{className || "-"}</b> • Section: <b>{sectionName || "-"}</b>
        </div>
      </div>

      {/* Exam picker + actions */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
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
              <>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
                <option value={GRAND_ID}>Grand total (25% + 25% + 50%)</option>
              </>
            )}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50"
            onClick={onDownloadCsv}
            disabled={!subjects.length}
            title="Download CSV"
          >
            Download CSV
          </button>
          <button
            className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50"
            onClick={onPrint}
            title="Print / Save as PDF"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Cell-styled TABLE */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="text-sm font-semibold">{currentExamName || "Results"}</div>
          <div className="text-xs text-slate-500">
            {examId === GRAND_ID
              ? "Weighted CGPA uses: 1st term 25% + 2nd term 25% + Final term 50%."
              : "Only published exam results are visible."}
          </div>
        </div>

        <table className="min-w-full table-fixed border-collapse">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-700">
              <th className="w-14 px-3 py-2 border">#</th>
              <th className="px-3 py-2 border">Subject</th>
              <th className="w-36 px-3 py-2 border text-right">
                {examId === GRAND_ID ? "Weighted Score" : "Score"}
              </th>
              <th className="w-28 px-3 py-2 border text-center">Letter</th>
              <th className="w-28 px-3 py-2 border text-center">
                {examId === GRAND_ID ? "Weighted GPA" : "GPA"}
              </th>
              <th className="w-32 px-3 py-2 border text-center">Status</th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {!examId ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500 border">
                  Select an exam to view marks.
                </td>
              </tr>
            ) : loadingMarks ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center border">
                  Loading marks…
                </td>
              </tr>
            ) : subjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500 border">
                  No subjects found in your timetable.
                </td>
              </tr>
            ) : (
              subjects.map((s, i) => {
                const m = marks[s.id];
                const has = !!m && (m.score !== null && m.score !== undefined);
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-2 border">{i + 1}</td>
                    <td className="px-3 py-2 border">{s.name}</td>
                    <td className="px-3 py-2 border text-right">
                      {has ? Number(m.score).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 border text-center">{has ? m.letter || "—" : "—"}</td>
                    <td className="px-3 py-2 border text-center">
                      {has && m.gpa != null ? Number(m.gpa).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 border text-center">
                      {has ? (
                        <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {totals && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2 border" colSpan={2}>Total</td>
                <td className="px-3 py-2 border text-right">
                  {Number(totals.totalScore).toFixed(2)}
                </td>
                <td className="px-3 py-2 border text-center">
                  {totals.avgLetter || "—"}
                </td>
                <td className="px-3 py-2 border text-center">
                  {Number(totals.avgGpa).toFixed(2)}
                </td>
                <td className="px-3 py-2 border text-center"></td>
              </tr>
              <tr>
                <td colSpan={6} className="px-3 py-2 text-xs text-slate-500 border">
                  Averages are based on {totals.count} subject{totals.count > 1 ? "s" : ""} with available marks.
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ---------------- Helper: resolve current student's ID ---------------- */
async function resolveMyStudentId() {
  try {
    const r = await AxiosInstance.get("students/me/");
    const obj = Array.isArray(r.data) ? r.data[0] : r.data;
    const id = Number(obj?.id);
    if (!Number.isNaN(id)) return id;
  } catch (e) {}

  try {
    const r = await AxiosInstance.get("students/", { params: { me: 1 } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const id = Number(arr[0]?.id);
    if (!Number.isNaN(id)) return id;
  } catch (e) {}

  try {
    const r = await AxiosInstance.get("students/", { params: { user: "me" } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const id = Number(arr[0]?.id);
    if (!Number.isNaN(id)) return id;
  } catch (e) {}

  try {
    const r = await AxiosInstance.get("students/", { params: { user_id: "me" } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const id = Number(arr[0]?.id);
    if (!Number.isNaN(id)) return id;
  } catch (e) {}

  throw new Error("unresolved-student-id");
}
