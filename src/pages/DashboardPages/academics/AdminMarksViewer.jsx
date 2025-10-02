// src/pages/admin/AdminMarksViewer.jsx
import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function AdminMarksViewer() {
  /* --------------------- Year / Class / Section --------------------- */
  const [years, setYears] = useState([]);   // [2025, 2024, ...]
  const [classes, setClasses] = useState([]); // array of class objects for selected year
  const [sections, setSections] = useState([]); // array of section objects for selected class

  const [year, setYear] = useState("");       // string/number
  const [classId, setClassId] = useState(""); // selected class id
  const [sectionId, setSectionId] = useState(""); // selected section id

  /* --------------------- Exams & marks --------------------- */
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");

  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(false);

  // subject -> teacher (for class/section)
  // shape: { [subjectId]: { id, name, teacher_name } }
  const [subjectTeachers, setSubjectTeachers] = useState({});

  // class/section roster map: { [studentId]: { roll, name? } }
  const [roster, setRoster] = useState({});

  // student detail panel
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);   // {id, name, roll}
  const [studentRows, setStudentRows] = useState([]);     // merged subjects (all) + marks (if any)
  const [loadingDetails, setLoadingDetails] = useState(false);

  // local edits for the open student (subject_id -> numeric score or "")
  const [editedMarks, setEditedMarks] = useState({});     // { [subject_id]: "87" }
  // keep mark ids for quick PATCH (subject_id -> markId)
  const [studentMarkIds, setStudentMarkIds] = useState({}); // { [subject_id]: markId|undefined }

  // track inline validation (subject_id -> error string | undefined)
  const [fieldErrors, setFieldErrors] = useState({});     // { [subject_id]: "Score must be 0-100" }

  /* --------------------- Helpers --------------------- */
  const isValidScore = (val) => {
    if (val === "" || val === null || val === undefined) return true; // empty is allowed in UI (means don't change)
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  };

  const normalizeOnBlur = (val) => {
    // Optional “clamp” behavior. If you prefer to reject instead of clamp, remove this.
    if (val === "" || val == null) return "";
    let n = Number(val);
    if (!Number.isFinite(n)) return "";
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    return String(n);
  };

  /* --------------------- Fetch years (like ExamsAdmin) --------------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await AxiosInstance.get("classes/years/");
        const serverYears = Array.isArray(res.data) ? res.data : [];
        setYears(serverYears);
        if (serverYears.length) {
          const latest = serverYears.slice().sort((a, b) => Number(b) - Number(a))[0];
          setYear(String(latest));
        }
      } catch {
        toast.error("Failed to load years");
        setYears([]);
      }
    })();
  }, []);

  /* --------------------- Fetch classes for selected year --------------------- */
  useEffect(() => {
    if (!year) {
      setClasses([]);
      setSections([]);
      setClassId("");
      setSectionId("");
      setExamId("");
      setExams([]);
      setMarks([]);
      setSelectedStudentId(null);
      setStudentInfo(null);
      setStudentRows([]);
      setSubjectTeachers({});
      setRoster({});
      setEditedMarks({});
      setStudentMarkIds({});
      setFieldErrors({});
      return;
    }
    (async () => {
      try {
        const { data } = await AxiosInstance.get("classes/", { params: { year } });
        const list = Array.isArray(data) ? data : data?.results || [];
        setClasses(list);
      } catch {
        toast.error("Failed to load classes");
        setClasses([]);
      }
    })();
  }, [year]);

  /* --------------------- Sections come from selected class --------------------- */
  useEffect(() => {
    const cls = classes.find((c) => String(c.id) === String(classId));
    const secs = (cls?.sections_detail || cls?.sections || []).map((s) => ({
      id: s.id,
      name: s.name,
    }));
    setSections(secs);
    setSectionId("");
    setExamId("");

    // clear downstream data
    setMarks([]);
    setSelectedStudentId(null);
    setStudentInfo(null);
    setStudentRows([]);
    setSubjectTeachers({});
    setRoster({});
    setEditedMarks({});
    setStudentMarkIds({});
    setFieldErrors({});
  }, [classId, classes]);

  /* --------------------- Load exams (year + class + section) --------------------- */
  useEffect(() => {
    (async () => {
      if (!year || !classId || !sectionId) {
        setExams([]);
        return;
      }
      try {
        const { data } = await AxiosInstance.get("exams/", {
          params: { year, class_name: Number(classId), section: Number(sectionId) },
        });
        setExams(Array.isArray(data) ? data : []);
      } catch {
        setExams([]);
      }
    })();
  }, [year, classId, sectionId]);

  /* --------------------- Subject→Teacher map (timetable/ then subjects/) --------------------- */
  useEffect(() => {
    (async () => {
      setSubjectTeachers({});
      if (!year || !classId || !sectionId) return;

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
        setSubjectTeachers(map);
      } catch {
        setSubjectTeachers({});
      }
    })();
  }, [year, classId, sectionId]);

  /* --------------------- Roster (year + class + section) --------------------- */
  useEffect(() => {
    (async () => {
      setRoster({});
      if (!year || !classId || !sectionId) return;
      try {
        const { data } = await AxiosInstance.get("students/", {
          params: { year, class_id: Number(classId), section_id: Number(sectionId) },
        });
        const list = Array.isArray(data) ? data : (data?.results || []);
        const map = {};
        for (const s of list) {
          const id = Number(s.id ?? s.student_id ?? s.student);
          if (!id) continue;
          const roll =
            s.roll_number ?? s.roll ?? s.student_roll ?? s?.student?.roll_number ?? "—";
          const name =
            s.full_name ?? s.name ?? s.student_name ?? s?.student?.full_name ?? undefined;
          map[id] = { roll, name };
        }
        setRoster(map);
      } catch {
        // okay to fail; will still show names/rolls from marks if present
      }
    })();
  }, [year, classId, sectionId]);

  /* --------------------- Load all marks for chosen exam --------------------- */
  useEffect(() => {
    (async () => {
      setSelectedStudentId(null);
      setStudentInfo(null);
      setStudentRows([]);
      setEditedMarks({});
      setStudentMarkIds({});
      setFieldErrors({});

      if (!examId) return setMarks([]);
      setLoading(true);
      try {
        const { data } = await AxiosInstance.get("exam-marks/", {
          params: { exam: Number(examId) },
        });
        setMarks(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Failed to load marks.");
        setMarks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  /* --------------------- Build unique students list --------------------- */
  const students = useMemo(() => {
    const map = new Map();
    for (const m of marks) {
      const sid = Number(m.student_id ?? m.student?.id ?? m.student);
      if (!sid || map.has(sid)) continue;

      const rosterEntry = roster[sid] || {};
      const rollFromRoster = rosterEntry.roll;
      const nameFromRoster = rosterEntry.name;

      map.set(sid, {
        id: sid,
        name:
          nameFromRoster ||
          m.student_name ||
          m.student?.full_name ||
          String(m.student_name ?? m.student ?? ""),
        roll:
          rollFromRoster ??
          m.student_roll ??
          m.student?.roll_number ??
          "—",
      });
    }
    // If marks empty but roster has students, show roster instead
    if (map.size === 0) {
      Object.entries(roster).forEach(([idStr, info]) => {
        const id = Number(idStr);
        map.set(id, {
          id,
          name: info.name || `Student ${id}`,
          roll: info.roll ?? "—",
        });
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.roll).localeCompare(String(b.roll))
    );
  }, [marks, roster]);

  /* --------------------- Open student detail --------------------- */
  const openStudent = async (stu) => {
    if (!examId) {
      toast.error("Pick an exam first.");
      return;
    }
    const rosterEntry = roster[Number(stu.id)];
    const mergedStu = {
      ...stu,
      roll: rosterEntry?.roll ?? stu.roll ?? "—",
      name: rosterEntry?.name ?? stu.name,
    };

    setSelectedStudentId(mergedStu.id);
    setStudentInfo(mergedStu);
    setStudentRows([]);
    setEditedMarks({});
    setStudentMarkIds({});
    setFieldErrors({});
    setLoadingDetails(true);

    try {
      const { data } = await AxiosInstance.get("exam-marks/", {
        params: { exam: Number(examId), student: Number(mergedStu.id) },
      });
      const arr = Array.isArray(data) ? data : [];

      const markBySubject = new Map();
      const idBySubject = {};
      for (const m of arr) {
        const sid = String(m.subject_id ?? m.subject?.id ?? m.subject);
        if (!sid) continue;
        idBySubject[sid] = m.id;
        markBySubject.set(sid, {
          id: m.id,
          score: m.score,
          letter: m.letter ?? m.grade_letter ?? "—",
          gpa: m.gpa ?? "—",
          teacher_name:
            m.teacher_name || m.teacher?.name || subjectTeachers[sid]?.teacher_name || "—",
          subject_name:
            m.subject_name || m.subject?.name || subjectTeachers[sid]?.name || sid,
        });
      }

      const allSubjectIds = new Set([
        ...Object.keys(subjectTeachers),
        ...Array.from(markBySubject.keys()),
      ]);

      const rows = Array.from(allSubjectIds).map((sid) => {
        const mark = markBySubject.get(sid);
        const meta = subjectTeachers[sid] || {};
        return {
          subject_id: sid,
          mark_id: mark?.id,
          subject_name: mark?.subject_name || meta.name || sid,
          teacher_name: mark?.teacher_name || meta.teacher_name || "—",
          score: mark?.score ?? "—",
          letter: mark?.letter ?? "—",
          gpa: mark?.gpa ?? "—",
        };
      });

      rows.sort((a, b) => String(a.subject_name).localeCompare(String(b.subject_name)));
      setStudentRows(rows);
      setStudentMarkIds(idBySubject);

      const init = {};
      for (const r of rows) {
        init[r.subject_id] = r.score === "—" ? "" : String(r.score);
      }
      setEditedMarks(init);
    } catch {
      toast.error("Failed to load this student's marks.");
      setStudentRows([]);
      setEditedMarks({});
      setStudentMarkIds({});
    } finally {
      setLoadingDetails(false);
    }
  };

  /* --------------------- Publish exam --------------------- */
  const publishExam = async () => {
    if (!examId) return;
    try {
      await AxiosInstance.patch(`exams/${examId}/`, { is_published: true });
      toast.success("Exam results published!");
      setExams((xs) =>
        xs.map((ex) => (ex.id === Number(examId) ? { ...ex, is_published: true } : ex))
      );
    } catch {
      toast.error("Failed to publish exam.");
    }
  };

  /* --------------------- Save edits (with HARD validation) --------------------- */
  const saveStudentEdits = async () => {
    if (!selectedStudentId || !examId) return;
    const entries = Object.entries(editedMarks).filter(([_, v]) => v !== "" && v != null);

    if (!entries.length) {
      toast("Nothing to save.");
      return;
    }

    // Validate all first: block save if *any* invalid.
    let localErrors = {};
    for (const [subjectIdStr, val] of entries) {
      if (!isValidScore(val)) {
        localErrors[subjectIdStr] = "Score must be a number between 0 and 100.";
      }
    }
    setFieldErrors(localErrors);
    const invalidCount = Object.keys(localErrors).length;
    if (invalidCount) {
      toast.error(`Fix ${invalidCount} invalid score${invalidCount > 1 ? "s" : ""} before saving.`);
      return;
    }

    const btn = toast.loading("Saving changes…");
    let ok = 0, fail = 0;

    for (const [subjectIdStr, val] of entries) {
      const subjectId = Number(subjectIdStr);
      const scoreNum = Number(val);
      // double safety
      if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        fail++;
        continue;
      }

      const markId = studentMarkIds[subjectIdStr];
      const payload = {
        exam: Number(examId),
        student: Number(selectedStudentId),
        subject: subjectId,
        score: scoreNum,
      };

      try {
        if (markId) {
          await AxiosInstance.patch(`exam-marks/${markId}/`, { score: scoreNum });
        } else {
          await AxiosInstance.post("exam-marks/", payload);
        }
        ok++;
      } catch {
        try {
          const g = await AxiosInstance.get("exam-marks/", {
            params: { exam: Number(examId), student: Number(selectedStudentId), subject: subjectId },
          });
          const id = Array.isArray(g.data) ? g.data[0]?.id : g.data?.results?.[0]?.id;
          if (id) {
            await AxiosInstance.patch(`exam-marks/${id}/`, { score: scoreNum });
            ok++;
          } else {
            fail++;
          }
        } catch {
          fail++;
        }
      }
    }

    toast.dismiss(btn);
    if (fail) toast.error(`Saved ${ok}, failed ${fail}.`);
    else toast.success(`Updated ${ok} marks.`);

    // Refresh only if we have a student open
    if (studentInfo) openStudent({ id: studentInfo.id, roll: studentInfo.roll, name: studentInfo.name });
  };

  /* --------------------- UI --------------------- */
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Admin Marks Viewer</h1>

      {/* Filters */}
      <div className="grid md:grid-cols-4 gap-3 bg-white border p-4 rounded">
        <div>
          <label className="text-sm font-semibold">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full border rounded px-2 py-1 bg-white"
          >
            {!years.length && <option value="">Loading…</option>}
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold">Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full border rounded px-2 py-1 bg-white"
            disabled={!year}
          >
            <option value="">{year ? "Select class…" : "Select a year first"}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold">Section</label>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="w-full border rounded px-2 py-1 bg-white"
            disabled={!year || !classId}
          >
            <option value="">Select section…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold">Exam</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="w-full border rounded px-2 py-1 bg-white"
            disabled={!year || !classId || !sectionId}
          >
            <option value="">Select exam…</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
                {ex.is_published ? " ✅" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Master–Detail */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Students (unique) */}
        <div className="bg-white border rounded overflow-hidden md:col-span-1">
          <div className="px-4 py-2 bg-slate-50 border-b text-sm font-semibold">
            Students {loading && "(loading…)"}
          </div>
          {students.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No students found.</div>
          ) : (
            <ul className="divide-y">
              {students.map((s) => {
                const active = String(s.id) === String(selectedStudentId);
                return (
                  <li
                    key={s.id}
                    className={`px-3 py-2 flex items-center justify-between cursor-pointer ${
                      active ? "bg-emerald-50" : ""
                    }`}
                    onClick={() => openStudent(s)}
                    title="View subjects & marks"
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

        {/* Student detail */}
        <div className="bg-white border rounded overflow-hidden md:col-span-2">
          <div className="px-4 py-2 bg-slate-50 border-b text-sm font-semibold">
            {studentInfo ? (
              <>
                {studentInfo.name} — Roll {studentInfo.roll}
              </>
            ) : (
              "Student details"
            )}
          </div>

          {!studentInfo ? (
            <div className="p-4 text-sm text-slate-500">Select a student to view subjects and marks.</div>
          ) : loadingDetails ? (
            <div className="p-4 text-sm">Loading marks…</div>
          ) : studentRows.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No subjects found.</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    <th className="px-2 py-1 text-left">Subject</th>
                    <th className="px-2 py-1 text-center">Marks</th>
                    <th className="px-2 py-1 text-center">Letter</th>
                    <th className="px-2 py-1 text-center">GPA</th>
                    <th className="px-2 py-1 text-left">Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((r, idx) => {
                    const val = editedMarks[r.subject_id] ?? "";
                    const invalid = !isValidScore(val);
                    return (
                      <tr key={idx} className="border-b align-top">
                        <td className="px-2 py-1">{r.subject_name}</td>
                        <td className="px-2 py-1 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            className={`w-24 border rounded px-2 py-1 text-center ${
                              invalid ? "border-red-500 focus:ring-red-200" : ""
                            }`}
                            value={val}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditedMarks((m) => ({ ...m, [r.subject_id]: v }));
                              setFieldErrors((fe) => {
                                const next = { ...fe };
                                if (!isValidScore(v)) next[r.subject_id] = "Score must be 0–100.";
                                else delete next[r.subject_id];
                                return next;
                              });
                            }}
                            onBlur={(e) => {
                              const clamped = normalizeOnBlur(e.target.value);
                              if (clamped !== e.target.value) {
                                setEditedMarks((m) => ({ ...m, [r.subject_id]: clamped }));
                                toast("Adjusted to 0–100 range.");
                              }
                            }}
                            placeholder={r.score === "—" ? "—" : String(r.score)}
                            title="Edit score (0–100)"
                          />
                          {fieldErrors[r.subject_id] && (
                            <div className="text-[11px] mt-1 text-red-600">
                              {fieldErrors[r.subject_id]}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1 text-center">{r.letter}</td>
                        <td className="px-2 py-1 text-center">{r.gpa}</td>
                        <td className="px-2 py-1">{r.teacher_name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="p-3 flex justify-end gap-2">
                <button
                  onClick={saveStudentEdits}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={
                    !Object.values(editedMarks).some((v) => v !== "" && v != null) ||
                    Object.keys(fieldErrors).length > 0
                  }
                  title={
                    Object.keys(fieldErrors).length > 0
                      ? "Fix invalid scores before saving"
                      : "Save changes"
                  }
                >
                  Save Changes
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer actions */}
      {examId && (
        <div className="flex gap-3">
          <button
            onClick={publishExam}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Publish Exam
          </button>
        </div>
      )}
    </div>
  );
}
