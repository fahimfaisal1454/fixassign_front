// src/pages/Student/MyTimetable.jsx
import { useEffect, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";

export default function MyTimetable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // HH:MM from "HH:MM:SS"
  const fmtTime = (t) => (t ? String(t).slice(0, 5) : "");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await AxiosInstance.get("timetable/", {
          params: { student: "me" },
        });
        const list = Array.isArray(data) ? data : data?.results || [];
        setRows(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onDownloadCsv = () => {
    const headers = [
      "#",
      "Day",
      "Period",
      "Start",
      "End",
      "Subject",
      "Teacher",
      "Room",
    ];

    const csvRows = rows.map((r, i) => [
      i + 1,
      r.day_of_week_display || r.day_of_week || "",
      r.period ?? "",
      fmtTime(r.start_time),
      fmtTime(r.end_time),
      r.subject_label || r.subject || "",
      r.teacher_label || "",
      r.classroom_label || r.room || "",
    ]);

    const csv =
      [headers, ...csvRows]
        .map((arr) =>
          arr
            .map((cell) => {
              const v = String(cell ?? "");
              return v.includes(",") || v.includes('"') || v.includes("\n")
                ? `"${v.replace(/"/g, '""')}"`
                : v;
            })
            .join(",")
        )
        .join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadPdf = () => {
    window.print(); // Browser native print dialog (user can "Save as PDF")
  };

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 space-y-4 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-xl font-semibold">My Timetable</h2>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50"
            onClick={onDownloadCsv}
            disabled={!rows.length}
          >
            Download CSV
          </button>
          <button
            className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50"
            onClick={onDownloadPdf}
            disabled={!rows.length}
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="min-w-full table-fixed border-collapse">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-700">
              <th className="w-12 px-3 py-2 border">#</th>
              <th className="w-32 px-3 py-2 border">Day</th>
              <th className="w-28 px-3 py-2 border">Period</th>
              <th className="w-24 px-3 py-2 border text-right">Start</th>
              <th className="w-24 px-3 py-2 border text-right">End</th>
              <th className="px-3 py-2 border">Subject</th>
              <th className="w-48 px-3 py-2 border">Teacher</th>
              <th className="w-32 px-3 py-2 border">Room</th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {rows.length ? (
              rows.map((r, i) => (
                <tr key={r.id ?? `${r.day_of_week}-${i}`}>
                  <td className="px-3 py-2 border">{i + 1}</td>
                  <td className="px-3 py-2 border">
                    {r.day_of_week_display || r.day_of_week || "—"}
                  </td>
                  <td className="px-3 py-2 border">{r.period ?? "—"}</td>
                  <td className="px-3 py-2 border text-right">
                    {fmtTime(r.start_time) || "—"}
                  </td>
                  <td className="px-3 py-2 border text-right">
                    {fmtTime(r.end_time) || "—"}
                  </td>
                  <td className="px-3 py-2 border">
                    {r.subject_label || r.subject || "—"}
                  </td>
                  <td className="px-3 py-2 border">
                    {r.teacher_label || "—"}
                  </td>
                  <td className="px-3 py-2 border">
                    {r.classroom_label || r.room || "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-slate-500 border"
                >
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
