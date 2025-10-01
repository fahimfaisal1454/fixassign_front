import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";

export default function StudentAssignments() {
  const [subs, setSubs] = useState([]);     // subjects from my timetable
  const [active, setActive] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  // load my subjects from timetable
  useEffect(() => {
    (async () => {
      try {
        const r = await AxiosInstance.get("timetable/", { params: { student: "me" } });
        const rows = Array.isArray(r.data) ? r.data : (r.data?.results || []);
        const uniqueSubs = [];
        const seen = new Set();
        rows.forEach(t => {
          const id = t.subject_id || t.subject;
          const name = t.subject_label || t.subject_name || t.subject;
          if (id && !seen.has(id)) {
            seen.add(id);
            uniqueSubs.push({ id, name });
          }
        });
        setSubs(uniqueSubs);
        setActive(uniqueSubs[0]?.id ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const r = await AxiosInstance.get("assignments/", { params: { student: "me", subject: active } });
      setList(Array.isArray(r.data) ? r.data : (r.data?.results || []));
    })();
  }, [active]);

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">My Assignments</h2>

      <div className="tabs tabs-boxed bg-white">
        {subs.map(s => (
          <button key={s.id}
                  className={`tab ${active===s.id ? "tab-active" : ""}`}
                  onClick={()=>setActive(s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-4">
        {list.length ? (
          <ul className="space-y-2">
            {list.map(a => (
              <li key={a.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-sm opacity-70">
                    {a.instructions ? a.instructions.slice(0,120) : ""} {a.due_date ? `• Due: ${a.due_date}` : ""}
                  </div>
                </div>
                <a className="link" href={a.file} target="_blank" rel="noreferrer">Download PDF</a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="opacity-70">No assignments for this subject.</div>
        )}
      </div>
    </div>
  );
}
