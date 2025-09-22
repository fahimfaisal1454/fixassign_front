import { useEffect, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";

export default function MyTimetable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // simple HH:MM formatter for "HH:MM:SS" strings
  const fmt = (t) => (t ? String(t).slice(0, 5) : "");

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

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">My Timetable</h2>

      <div className="bg-white border rounded-xl overflow-hidden">
        {/* header */}
        <div className="grid grid-cols-5 gap-3 p-3 text-sm font-medium bg-slate-50 border-b">
          <div>Day</div>
          <div>Period (Time)</div>
          <div>Subject</div>
          <div>Teacher</div>
          <div>Room</div>
        </div>

        {/* rows */}
        {rows.length ? (
          rows.map((r, i) => {
            const time =
              r.start_time && r.end_time
                ? ` (${fmt(r.start_time)}–${fmt(r.end_time)})`
                : "";
            return (
              <div
                key={r.id ?? i}
                className="grid grid-cols-5 gap-3 p-3 text-sm border-b last:border-b-0"
              >
                <div>{r.day_of_week_display || r.day_of_week}</div>
                <div>
                  {r.period || "—"}
                  {time}
                </div>
                <div>{r.subject_label || r.subject}</div>
                <div>{r.teacher_label || "—"}</div>
                <div>{r.classroom_label || r.room || "—"}</div>
              </div>
            );
          })
        ) : (
          <div className="p-4 text-sm text-slate-500">No entries found.</div>
        )}
      </div>
    </div>
  );
}
