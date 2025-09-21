import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Axios from "../../components/AxiosInstance";

/**
 * Bigger Attendance Sheet (Monthly)
 * - Wider/taller modal
 * - Larger table sizing
 * - Keeps full-name normalization (via students/ endpoint)
 */
export default function AttendanceSheet({
  open,
  onClose,
  classId,          // required
  sectionId,        // required
  subjectId = "",   // optional
  classLabel,       // optional pretty labels from parent
  sectionLabel,     // optional
  subjectLabel,     // optional
}) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(String(today.getMonth() + 1)); // "1".."12"
  const [year, setYear]   = useState(String(today.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { meta, students }

  if (!open) return null;

  const load = async () => {
    if (!classId || !sectionId || !month || !year) return;
    setLoading(true);
    try {
      // 1) Monthly attendance
      const repReq = Axios.get("attendance/report/", {
        params: {
          class_id: classId,
          section_id: sectionId,
          subject_id: subjectId || undefined,
          month,
          year,
        },
      });

      // 2) Students (to pull full_name)
      const stuReq = Axios.get("students/", {
        params: { class_id: classId, section_id: sectionId },
      });

      const [repRes, stuRes] = await Promise.all([repReq, stuReq]);
      const repData = repRes.data || null;

      const studentList = Array.isArray(stuRes.data)
        ? stuRes.data
        : (stuRes.data?.results || []);
      const nameMap = new Map(
        studentList.map(s => [String(s.id), s.full_name || s.name || ""])
      );

      if (repData?.students?.length) {
        repData.students = repData.students.map(s => ({
          ...s,
          name: nameMap.get(String(s.id)) || s.name || "",
        }));
      }

      // Prefer labels passed from parent (if any)
      if (repData?.meta) {
        repData.meta.class   = classLabel   ?? repData.meta.class;
        repData.meta.section = sectionLabel ?? repData.meta.section;
        repData.meta.subject = subjectLabel ?? repData.meta.subject;
      }

      setData(repData);
    } catch (e) {
      console.error("Report load failed", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadXlsx = () => {
    if (!data) return;
    const { meta, students } = data;
    const header = [
      "Student",
      "%P","%A","%L","%E","%Blank",
      "P","A","L","E",
      ...meta.day_headers,
    ];
    const body = students.map((s) => [
      s.name,
      s.percent.P, s.percent.A, s.percent.L, s.percent.E, s.percent.Blank,
      s.counts.P,  s.counts.A,  s.counts.L,  s.counts.E,
      ...s.days,
    ]);
    const title = [
      `Class: ${meta.class || "-"}`,
      `Section: ${meta.section || "-"}`,
      `Subject: ${meta.subject || "-"}`,
      `Month: ${meta.month || month}/${meta.year || year}`,
    ];
    const aoa = [title, [], header, ...body];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 28 }, // Student
      { wch: 6 },{ wch: 6 },{ wch: 6 },{ wch: 8 },{ wch: 8 }, // percents
      { wch: 4 },{ wch: 4 },{ wch: 4 },{ wch: 4 },             // counts
      ...Array(data.meta.days).fill({ wch: 6 }),               // days
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    const fname = `attendance_${(meta.class || "class").replace(/\s+/g, "_")}_${(meta.section || "sec").replace(/\s+/g, "_")}_${meta.year || year}-${String(meta.month || month).padStart(2, "0")}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  useEffect(() => {
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sectionId, subjectId, month, year, open]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* BIGGER modal container */}
      <div className="relative bg-white rounded-xl shadow-xl w-[98vw] max-w-[1500px] h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex flex-wrap items-center gap-2 justify-between">
          <h2 className="text-lg font-semibold">Attendance Sheet (Monthly)</h2>
          <div className="flex items-center gap-2">
            <select
              className="select select-bordered select-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString(undefined, { month: "long" })}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="input input-bordered input-sm w-24"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
            <button className="btn btn-sm" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button className="btn btn-sm btn-secondary" onClick={downloadXlsx} disabled={!data}>
              Download (.xlsx)
            </button>
            <button className="btn btn-sm btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Meta row (slightly larger text) */}
        <div className="p-3 text-base text-gray-700 border-b">
          {data ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div><b>Class:</b> {data.meta.class || "-"}</div>
              <div><b>Section:</b> {data.meta.section || "-"}</div>
              {data.meta.subject ? <div><b>Subject:</b> {data.meta.subject}</div> : null}
              <div><b>Window:</b> {data.meta.start} → {data.meta.end}</div>
              <div><b>Students:</b> {data.students.length}</div>
              <div><b>Days:</b> {data.meta.days}</div>
            </div>
          ) : (
            <span>Select month/year then Refresh.</span>
          )}
        </div>

        {/* Bigger scrollable area */}
        <div className="overflow-auto p-4 h-[calc(92vh-120px)]">
          {loading ? (
            <div className="p-4">Loading…</div>
          ) : !data ? (
            <div className="p-4 text-gray-500">No data yet.</div>
          ) : (
            <table className="table table-sm text-[13px] md:text-sm">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>%P</th><th>%A</th><th>%L</th><th>%E</th><th>%Blank</th>
                  <th>P</th><th>A</th><th>L</th><th>E</th>
                  {data.meta.day_headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap">{s.name}</td>
                    <td>{s.percent.P}</td>
                    <td>{s.percent.A}</td>
                    <td>{s.percent.L}</td>
                    <td>{s.percent.E}</td>
                    <td>{s.percent.Blank}</td>
                    <td>{s.counts.P}</td>
                    <td>{s.counts.A}</td>
                    <td>{s.counts.L}</td>
                    <td>{s.counts.E}</td>
                    {s.days.map((d, i) => (
                      <td
                        key={i}
                        className={d === "A" ? "text-red-600" : d === "P" ? "text-green-700" : ""}
                      >
                        {d}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
