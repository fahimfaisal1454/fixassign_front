// src/pages/admin/AdminReport.jsx
import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

const GRAND_ID = "__grand__";

/* detect weights for 1st/2nd/final */
function weightForExam(ex) {
  const name = (ex?.name || "").toLowerCase();
  if (/(final|term\s*3|third)/.test(name)) return 0.5;
  if (/(2nd|second|term\s*2)/.test(name)) return 0.25;
  if (/(1st|first|term\s*1)/.test(name)) return 0.25;
  // anything else: no weight (ignored in grand)
  return 0;
}

/* ---------- Component ---------- */
export default function AdminReport() {
  /* ---------- PRINT CSS (only marksheet prints) ---------- */
  const PrintStyles = (
    <style>
      {`
      @media print {
        @page { size: A4; margin: 12mm; }
        /* Hide everything by default */
        body * { visibility: hidden; }
        /* Show only the print area */
        #print-area, #print-area * { visibility: visible; }
        /* Ensure the print area occupies the page */
        #print-area {
          position: static !important;
          inset: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
          width: 100% !important;
        }
        /* Never print elements marked no-print */
        .no-print { display: none !important; }
      }
    `}
    </style>
  );

  /* filters */
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const [year, setYear] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");

  /* data holders */
  const [roster, setRoster] = useState({}); // { [studentId]: { roll, name } }
  const [subjectMeta, setSubjectMeta] = useState({}); // { [subjectId]: { id, name, teacher_name } }

  // list for left pane
  const studentsList = useMemo(() => {
    const rows = Object.entries(roster).map(([idStr, v]) => ({
      id: Number(idStr),
      name: v.name || `Student ${idStr}`,
      roll: v.roll ?? "—",
    }));
    rows.sort((a, b) => String(a.roll).localeCompare(String(b.roll)));
    return rows;
  }, [roster]);

  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailRows, setDetailRows] = useState([]); // right table rows
  const [totals, setTotals] = useState(null); // { totalScore, avgGpa, count }

  /* ---------- load years ---------- */
  useEffect(() => {
    (async () => {
      try {
        const r = await AxiosInstance.get("classes/years/");
        const ys = Array.isArray(r.data) ? r.data : [];
        setYears(ys);
        if (ys.length) {
          const latest = ys.slice().sort((a, b) => Number(b) - Number(a))[0];
          setYear(String(latest));
        }
      } catch {
        toast.error("Failed to load years.");
      }
    })();
  }, []);

  /* ---------- load classes for year ---------- */
  useEffect(() => {
    if (!year) {
      setClasses([]); setSections([]);
      setClassId(""); setSectionId("");
      setExams([]); setExamId("");
      setRoster({}); setSubjectMeta({});
      setSelectedStudentId(null); setDetailRows([]); setTotals(null);
      return;
    }
    (async () => {
      try {
        const { data } = await AxiosInstance.get("classes/", { params: { year } });
        setClasses(Array.isArray(data) ? data : data?.results || []);
      } catch {
        setClasses([]);
      }
    })();
  }, [year]);

  /* ---------- sections from selected class ---------- */
  useEffect(() => {
    const cls = classes.find((c) => String(c.id) === String(classId));
    const secs = (cls?.sections_detail || cls?.sections || []).map((s) => ({
      id: s.id, name: s.name,
    }));
    setSections(secs);
    setSectionId("");
    setExams([]); setExamId("");
    setRoster({}); setSubjectMeta({});
    setSelectedStudentId(null); setDetailRows([]); setTotals(null);
  }, [classId, classes]);

  /* ---------- exams (year + class + section) ---------- */
  useEffect(() => {
    (async () => {
      if (!year || !classId || !sectionId) {
        setExams([]); setExamId(""); return;
      }
      try {
        const { data } = await AxiosInstance.get("exams/", {
          params: { year, class_name: Number(classId), section: Number(sectionId) },
        });
        const list = Array.isArray(data) ? data : [];
        setExams(list);
        if (!examId && list.length) setExamId(String(list[0].id));
      } catch {
        setExams([]); setExamId("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, classId, sectionId]);

  /* ---------- subject meta (from timetable preferred) ---------- */
  useEffect(() => {
    (async () => {
      setSubjectMeta({});
      if (!year || !classId || !sectionId) return;

      // Try from timetable (has teacher names)
      const buildFromTimetable = async () => {
        const { data } = await AxiosInstance.get("timetable/", {
          params: { year, class_name: Number(classId), section: Number(sectionId) },
        });
        const rows = Array.isArray(data) ? data : [];
        const map = {};
        for (const r of rows) {
          const sid = String(r.subject_id ?? r.subject);
          if (!sid) continue;
          if (!map[sid]) {
            map[sid] = {
              id: sid,
              name: r.subject_label || r.subject || sid,
              teacher_name: r.teacher_name || r.teacher_label || r.teacher || "—",
            };
          }
        }
        return map;
      };

      const buildFromSubjectsOnly = async () => {
        const { data } = await AxiosInstance.get("subjects/", {
          params: { year, class_id: Number(classId) },
        });
        const arr = Array.isArray(data) ? data : [];
        const map = {};
        for (const s of arr) {
          const sid = String(s.id ?? s.subject_id ?? s.subject);
          if (!sid) continue;
          map[sid] = { id: sid, name: s.name || String(s), teacher_name: "—" };
        }
        return map;
      };

      try {
        let map = {};
        try {
          map = await buildFromTimetable();
        } catch {
          map = await buildFromSubjectsOnly();
        }
        setSubjectMeta(map);
      } catch {
        setSubjectMeta({});
      }
    })();
  }, [year, classId, sectionId]);

  /* ---------- roster (list every student) ---------- */
  useEffect(() => {
    (async () => {
      setRoster({});
      if (!year || !classId || !sectionId) return;
      try {
        const { data } = await AxiosInstance.get("students/", {
          params: { year, class_id: Number(classId), section_id: Number(sectionId) },
        });
        const list = Array.isArray(data) ? data : data?.results || [];
        const map = {};
        for (const s of list) {
          const id = Number(s.id ?? s.student_id ?? s.student);
          if (!id) continue;
          const roll =
            s.roll_number ?? s.roll ?? s.student_roll ?? s?.student?.roll_number ?? "—";
          const name =
            s.full_name ?? s.name ?? s.student_name ?? s?.student?.full_name ?? `Student ${id}`;
          map[id] = { roll, name };
        }
        setRoster(map);
        if (!selectedStudentId && list.length) {
          const first = list
            .map((s) => ({
              id: Number(s.id ?? s.student_id ?? s.student),
              roll:
                s.roll_number ?? s.roll ?? s.student_roll ?? s?.student?.roll_number ?? "—",
            }))
            .sort((a, b) => String(a.roll).localeCompare(String(b.roll)))[0];
          if (first?.id) setSelectedStudentId(first.id);
        }
      } catch {
        setRoster({});
      }
    })();
  }, [year, classId, sectionId, selectedStudentId]);

  /* ---------- fetch marks for a single exam and student ---------- */
  const fetchSubjectMarksForExam = async (exam, studentId) => {
    const res = await AxiosInstance.get("exam-marks/", {
      params: { exam: Number(exam.id), student: Number(studentId) },
    });
    const arr = Array.isArray(res.data) ? res.data : [];
    // map by subjectId
    const map = new Map();
    for (const m of arr) {
      const sid = String(m.subject_id ?? m.subject?.id ?? m.subject);
      if (!sid) continue;
      map.set(sid, {
        score: m.score,
        gpa: m.gpa,
        letter: m.letter ?? m.grade_letter,
      });
    }
    return map;
  };

  /* ---------- build detail table (right pane) ---------- */
  useEffect(() => {
    (async () => {
      setDetailRows([]); setTotals(null);
      if (!selectedStudentId || !year || !classId || !sectionId) return;
      if (!examId) return;

      setLoadingDetails(true);
      try {
        let rowsBySubject = new Map();

        if (examId === GRAND_ID) {
          // Weighted combine across 1st(25%) + 2nd(25%) + Final(50%)
          const weightedExams = exams
            .map((e) => ({ e, w: weightForExam(e) }))
            .filter((x) => x.w > 0);

          if (weightedExams.length === 0) {
            setLoadingDetails(false);
            return;
          }

          // fetch marks per weighted exam
          const perExam = await Promise.all(
            weightedExams.map(async ({ e, w }) => {
              const m = await fetchSubjectMarksForExam(e, selectedStudentId);
              return { weight: w, marks: m };
            })
          );

          // combine
          rowsBySubject = new Map();
          const subjectIds = new Set([
            ...Object.keys(subjectMeta),
            ...perExam.flatMap(({ marks }) => Array.from(marks.keys())),
          ]);

          for (const sid of subjectIds) {
            let score = 0;
            let gpa = 0;
            let any = false;
            for (const { weight, marks } of perExam) {
              const mk = marks.get(sid);
              if (mk && (mk.score != null || mk.gpa != null)) {
                any = true;
                if (mk.score != null) score += Number(mk.score || 0) * weight;
                if (mk.gpa != null) gpa += Number(mk.gpa || 0) * weight;
              }
            }
            if (any) {
              rowsBySubject.set(sid, {
                subject_id: sid,
                subject_name: subjectMeta[sid]?.name || sid,
                teacher_name: subjectMeta[sid]?.teacher_name || "—",
                score,
                gpa,
                letter: letterFromGPA(gpa),
              });
            }
          }
        } else {
          // single exam
          const selectedExam = exams.find((e) => String(e.id) === String(examId));
          if (!selectedExam) return;

          const map = await fetchSubjectMarksForExam(selectedExam, selectedStudentId);

          // union of subjects we know + marks returned
          const union = new Set([...Object.keys(subjectMeta), ...map.keys()]);
          rowsBySubject = new Map();
          for (const sid of union) {
            const mk = map.get(sid);
            rowsBySubject.set(sid, {
              subject_id: sid,
              subject_name: subjectMeta[sid]?.name || sid,
              teacher_name: subjectMeta[sid]?.teacher_name || "—",
              score: mk?.score ?? null,
              gpa: mk?.gpa ?? null,
              letter: mk?.letter ?? (mk?.gpa != null ? letterFromGPA(mk.gpa) : "—"),
            });
          }
        }

        // to array, sort by subject name
        const rows = Array.from(rowsBySubject.values()).sort((a, b) =>
          String(a.subject_name).localeCompare(String(b.subject_name))
        );
        setDetailRows(rows);

        // totals
        const valid = rows.filter((r) => r.score != null || r.gpa != null);
        if (valid.length) {
          const totalScore = valid.reduce((s, r) => s + Number(r.score || 0), 0);
          const avgGpa = valid.reduce((s, r) => s + Number(r.gpa || 0), 0) / valid.length;
          setTotals({ totalScore, avgGpa, count: valid.length });
        } else {
          setTotals(null);
        }
      } catch {
        toast.error("Failed to load report.");
      } finally {
        setLoadingDetails(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, examId, exams, subjectMeta, year, classId, sectionId]);

  /* ---------- helpers ---------- */
  const selectedStudent = selectedStudentId
    ? { id: selectedStudentId, ...(roster[selectedStudentId] || {}) }
    : null;

  const currentExamName = useMemo(() => {
    if (examId === GRAND_ID) return "Grand total (25% + 25% + 50%)";
    return exams.find((e) => String(e.id) === String(examId))?.name || "";
  }, [examId, exams]);

  const onPrint = () => window.print();

  const onDownloadCsv = () => {
    const headers = ["Subject", "Marks", "Letter", "GPA", "Teacher"];
    const rows = detailRows.map((r) => [
      r.subject_name,
      r.score != null ? Number(r.score).toFixed(2) : "",
      r.letter ?? "",
      r.gpa != null ? Number(r.gpa).toFixed(2) : "",
      r.teacher_name ?? "",
    ]);
    if (totals) {
      rows.push([]);
      rows.push([
        "Total",
        totals.totalScore.toFixed(2),
        letterFromGPA(totals.avgGpa),
        totals.avgGpa.toFixed(2),
        "",
      ]);
    }

    const csv =
      [headers, ...rows]
        .map((r) =>
          r
            .map((cell) => {
              const v = String(cell ?? "");
              return v.includes(",") ? `"${v.replace(/"/g, '""')}"` : v;
            })
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stu = selectedStudent ? `_roll${selectedStudent.roll}` : "";
    a.download = `report_${currentExamName.replace(/\s+/g, "_")}${stu}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- UI ---------- */
  return (
    <div className="space-y-4">
      {PrintStyles}

      <h1 className="text-xl font-bold no-print">Exam Report</h1>

      {/* Filters */}
      <div className="grid md:grid-cols-4 gap-3 bg-white border p-3 rounded no-print">
        <div>
          <div className="text-xs font-semibold mb-1">Year</div>
          <select
            className="w-full border rounded px-2 py-1 bg-white"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">Select year…</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1">Class</div>
          <select
            className="w-full border rounded px-2 py-1 bg-white"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={!year}
          >
            <option value="">{year ? "Select class…" : "Select a year first"}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1">Section</div>
          <select
            className="w-full border rounded px-2 py-1 bg-white"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!year || !classId}
          >
            <option value="">Select section…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1">Exam</div>
          <select
            className="w-full border rounded px-2 py-1 bg-white"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            disabled={!year || !classId || !sectionId}
          >
            <option value="">Select exam…</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}{ex.is_published ? " ✅" : ""}
              </option>
            ))}
            {exams.length > 0 && (
              <option value={GRAND_ID}>Grand total (25% + 25% + 50%)</option>
            )}
          </select>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Students list */}
        <div className="bg-white border rounded overflow-hidden no-print">
          <div className="px-3 py-2 bg-slate-50 border-b text-sm font-semibold">
            Students
          </div>
          {studentsList.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">No students found.</div>
          ) : (
            <ul className="divide-y">
              {studentsList.map((s) => {
                const active = String(s.id) === String(selectedStudentId);
                return (
                  <li
                    key={s.id}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                      active ? "bg-emerald-50" : ""
                    }`}
                    onClick={() => setSelectedStudentId(s.id)}
                  >
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-slate-500">Roll: {s.roll}</div>
                    </div>
                    <div className="text-xs text-slate-500">View</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail panel (PRINT TARGET) */}
        <div id="print-area" className="bg-white border rounded overflow-hidden md:col-span-2">
          {/* Header + actions (actions are no-print) */}
          <div className="px-3 py-2 bg-slate-50 border-b text-sm font-semibold flex items-center justify-between">
            <div>
              {selectedStudent
                ? `${selectedStudent.name} — Roll ${selectedStudent.roll}`
                : "Student details"}
              {currentExamName ? ` • ${currentExamName}` : ""}
            </div>
            <div className="flex gap-2 no-print">
              <button
                className="px-3 py-1.5 text-xs rounded border hover:bg-slate-50"
                onClick={onDownloadCsv}
                disabled={!detailRows.length}
              >
                Download CSV
              </button>
              <button
                className="px-3 py-1.5 text-xs rounded border hover:bg-slate-50"
                onClick={onPrint}
                disabled={!detailRows.length}
                title="Print / Save as PDF"
              >
                Print / Save PDF
              </button>
            </div>
          </div>

          {!selectedStudent ? (
            <div className="p-4 text-sm text-slate-500">Select a student to view subjects.</div>
          ) : loadingDetails ? (
            <div className="p-4 text-sm">Loading…</div>
          ) : detailRows.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No subjects found.</div>
          ) : (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    <th className="px-2 py-1 text-left border">Subject</th>
                    <th className="px-2 py-1 text-center border">Marks</th>
                    <th className="px-2 py-1 text-center border">Letter</th>
                    <th className="px-2 py-1 text-center border">GPA</th>
                    <th className="px-2 py-1 text-left border">Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-2 py-1 border">{r.subject_name}</td>
                      <td className="px-2 py-1 border text-center">
                        {r.score != null ? Number(r.score).toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-1 border text-center">{r.letter ?? "—"}</td>
                      <td className="px-2 py-1 border text-center">
                        {r.gpa != null ? Number(r.gpa).toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-1 border">{r.teacher_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>

                {totals && (
                  <tfoot>
                    <tr className="bg-slate-50 font-medium">
                      <td className="px-2 py-1 border text-right" colSpan={1}>Total</td>
                      <td className="px-2 py-1 border text-center">
                        {totals.totalScore.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border text-center">
                        {letterFromGPA(totals.avgGpa)}
                      </td>
                      <td className="px-2 py-1 border text-center">
                        {totals.avgGpa.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border" />
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-2 py-2 text-xs text-slate-500 border">
                        Averages based on {totals.count} subject{totals.count > 1 ? "s" : ""} with marks.
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- GPA→Letter fallback (admin scale not needed for report) ---------- */
function letterFromGPA(x) {
  const g = Number(x);
  if (!Number.isFinite(g)) return "—";
  if (g >= 5.0) return "A+";
  if (g >= 4.0) return "A";
  if (g >= 3.5) return "A-";
  if (g >= 3.0) return "B";
  if (g >= 2.0) return "C";
  if (g >= 1.0) return "D";
  return "F";
}
