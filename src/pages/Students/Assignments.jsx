// src/pages/Students/StudentAssignments.jsx
import { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";

export default function StudentAssignments() {
  const [subs, setSubs] = useState([]);        // {id, name}
  const [active, setActive] = useState(null);  // subject id
  const [list, setList] = useState([]);        // assignments
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);

  // Keep the student's class/section we infer from timetable
  const [classId, setClassId] = useState(null);
  const [sectionId, setSectionId] = useState(null);

  // ---------- Load my timetable → derive class/section + unique subjects ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await AxiosInstance.get("timetable/", { params: { student: "me" } });
        const rows = Array.isArray(r.data) ? r.data : (r.data?.results || []);

        // Find class & section (most students have one; if multiple, we take the most common)
        const classCount = new Map();
        const sectionCount = new Map();

        const pushCount = (m, key) => {
          if (!key) return;
          m.set(key, (m.get(key) || 0) + 1);
        };

        rows.forEach(t => {
          const cId = t.class_id || t.class_name_id || t.class_name || t.class;
          const sId = t.section_id || t.section;
          pushCount(classCount, cId);
          pushCount(sectionCount, sId);
        });

        const pickMostCommon = (m) => {
          let best = null, max = -1;
          for (const [k, v] of m.entries()) {
            if (v > max && k != null && k !== "") { best = k; max = v; }
          }
          return best;
        };

        const pickedClassId = pickMostCommon(classCount);
        const pickedSectionId = pickMostCommon(sectionCount);
        setClassId(pickedClassId || null);
        setSectionId(pickedSectionId || null);

        // Build unique subjects
        const seen = new Set();
        const uniqueSubs = [];
        rows.forEach(t => {
          const id = t.subject_id || t.subject;
          const name = t.subject_label || t.subject_name || t.subject;
          if (!id || seen.has(String(id))) return;
          seen.add(String(id));
          uniqueSubs.push({ id: String(id), name: String(name || id) });
        });

        // Sort tabs by name (optional)
        uniqueSubs.sort((a, b) => a.name.localeCompare(b.name));

        setSubs(uniqueSubs);
        setActive(uniqueSubs[0]?.id ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- Load assignments when subject changes ----------
  useEffect(() => {
    if (!active || !classId || !sectionId) return; // wait until we know class/section
    (async () => {
      setLoadingList(true);
      try {
        // Filter on backend by class + section + subject
        const r = await AxiosInstance.get("assignments/", {
          params: {
            class_id: classId,
            section_id: sectionId,
            subject: active,
          },
        });
        setList(Array.isArray(r.data) ? r.data : (r.data?.results || []));
      } catch (e) {
        console.error("Assignments load failed:", e?.response?.data || e);
        setList([]);
      } finally {
        setLoadingList(false);
      }
    })();
  }, [active, classId, sectionId]);

  if (loading) return <div className="p-4">Loading…</div>;

  const isImageUrl = (url) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url || "");
  const isPdfUrl = (url) => /\.pdf(\?.*)?$/i.test(url || "");

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">My Assignments</h2>

      {/* Subject tabs */}
      {subs.length ? (
        <div className="tabs tabs-boxed bg-white flex-wrap">
          {subs.map(s => (
            <button
              key={s.id}
              className={`tab ${String(active) === String(s.id) ? "tab-active" : ""}`}
              onClick={() => setActive(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="opacity-70">No subjects found from your timetable.</div>
      )}

      {/* Assignments list */}
      <div className="bg-white rounded-xl border p-4">
        {loadingList ? (
          <div>Loading assignments…</div>
        ) : list.length ? (
          <ul className="space-y-2">
            {list.map(a => {
              const fileUrl = a.file || "";
              const showImg = isImageUrl(fileUrl);
              const showPdf = isPdfUrl(fileUrl);

              return (
                <li key={a.id} className="flex items-center justify-between border rounded p-2">
                  <div className="flex items-center gap-3">
                    {showImg && (
                      <img
                        src={fileUrl}
                        alt={a.title}
                        style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }}
                      />
                    )}
                    <div>
                      <div className="font-semibold">{a.title}</div>
                      <div className="text-sm opacity-70">
                        {a.instructions ? a.instructions.slice(0, 120) : ""}
                        {a.due_date ? ` • Due: ${a.due_date}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {fileUrl ? (
                      <a className="link" href={fileUrl} target="_blank" rel="noreferrer">
                        {showPdf ? "Open PDF" : showImg ? "Open Image" : "Open file"}
                      </a>
                    ) : (
                      <span className="opacity-60 text-sm">No file</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="opacity-70">No assignments for this subject.</div>
        )}
      </div>
    </div>
  );
}
