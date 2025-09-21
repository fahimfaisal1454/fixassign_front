import { useEffect, useMemo, useState } from "react";
import Axios from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

const byName = (a, b) => (a.name || "").localeCompare(b.name || "");

// --- API helpers ---
async function getYears() {
  try {
    const { data } = await Axios.get("classes/years/");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
async function getClasses(year) {
  const { data } = await Axios.get("classes/", { params: { year } });
  const list = Array.isArray(data) ? data : data?.results || [];
  return list.sort(byName);
}
async function getStudents({ class_id, section_id }) {
  const { data } = await Axios.get("students/", { params: { class_id, section_id } });
  return Array.isArray(data) ? data : data?.results || [];
}
async function postPromote(body) {
  const { data } = await Axios.post("students/promote/", body);
  return data;
}

export default function StudentPromotion() {
  // Years
  const [years, setYears] = useState([]);
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");

  // Left (current)
  const [fromClasses, setFromClasses] = useState([]);
  const [fromClassId, setFromClassId] = useState("");
  const [fromSections, setFromSections] = useState([]);
  const [fromSectionId, setFromSectionId] = useState("");

  // Right (next)
  const [toClasses, setToClasses] = useState([]);
  const [toClassId, setToClassId] = useState("");
  const [toSections, setToSections] = useState([]);
  const [toSectionId, setToSectionId] = useState("");

  // Lists & selection
  const [left, setLeft] = useState([]);           // {id, name, roll, section, eligible}
  const [right, setRight] = useState([]);
  const [selLeft, setSelLeft] = useState(new Set());
  const [selRight, setSelRight] = useState(new Set());

  // Eligibility filter: ALL | ELIGIBLE | NOT_ELIGIBLE
  const [eligibility, setEligibility] = useState("ALL");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Init years (prefer latest -> next year = +1)
useEffect(() => {
  (async () => {
    const ys = await getYears();
    setYears(ys);
    if (ys.length) {
      const current = Math.min(...ys);   // 👈 running year
      setFromYear(String(current));
      setToYear(String(current + 1));
    }
  })();
}, []);

  // Load classes when year changes
  useEffect(() => {
    (async () => {
      if (!fromYear) return;
      const cl = await getClasses(fromYear);
      setFromClasses(cl);
      setFromClassId(""); setFromSections([]); setFromSectionId("");
      setLeft([]); setSelLeft(new Set());
    })();
  }, [fromYear]);

  useEffect(() => {
    (async () => {
      if (!toYear) return;
      const cl = await getClasses(toYear);
      setToClasses(cl);
      setToClassId(""); setToSections([]); setToSectionId("");
      setRight([]); setSelRight(new Set());
    })();
  }, [toYear]);

  // Sections based on chosen class
  useEffect(() => {
    const c = fromClasses.find(x => String(x.id) === String(fromClassId));
    setFromSections(c?.sections_detail || c?.sections || []);
    setFromSectionId("");
    setLeft([]); setSelLeft(new Set());
  }, [fromClassId, fromClasses]);

  useEffect(() => {
    const c = toClasses.find(x => String(x.id) === String(toClassId));
    setToSections(c?.sections_detail || c?.sections || []);
    setToSectionId("");
  }, [toClassId, toClasses]);

  const loadLeft = async () => {
    if (!fromClassId) return toast.error("Select current Class.");
    setLoading(true);
    try {
      const list = await getStudents({
        class_id: fromClassId,
        section_id: fromSectionId || undefined,
      });
      const rows = list.map(s => ({
        id: s.id,
        name: s.full_name || s.student_name || s.name || String(s.id),
        roll: s.roll_number ?? "",
        section: s.section_name || s.section?.name || "",
        eligible: s.eligible !== undefined ? !!s.eligible : true, // default true
      }));
      setLeft(rows);
      setSelLeft(new Set());
    } catch (e) {
      console.error(e);
      toast.error("Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  // Filter by eligibility
  const leftFiltered = useMemo(() => {
    if (eligibility === "ALL") return left;
    if (eligibility === "ELIGIBLE") return left.filter(s => s.eligible);
    return left.filter(s => !s.eligible);
  }, [left, eligibility]);

  // Select helpers
  const toggleSelLeft = (id) => setSelLeft(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleSelRight = (id) => setSelRight(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // Move
  const moveRight = () => {
    if (!selLeft.size) return;
    const add = leftFiltered.filter(s => selLeft.has(s.id));
    const existing = new Set(right.map(r => r.id));
    setRight(prev => [...prev, ...add.filter(a => !existing.has(a.id))]);
    setSelLeft(new Set());
  };
  const moveLeft = () => {
    if (!selRight.size) return;
    setRight(prev => prev.filter(r => !selRight.has(r.id)));
    setSelRight(new Set());
  };

  const bodyBase = useMemo(() => ({
    from_class_id: fromClassId ? Number(fromClassId) : null,
    from_section_id: fromSectionId ? Number(fromSectionId) : null,
    to_class_id: toClassId ? Number(toClassId) : null,
    to_section_id: toSectionId ? Number(toSectionId) : null,
    student_ids: right.map(r => r.id),
  }), [fromClassId, fromSectionId, toClassId, toSectionId, right]);

  const preview = async () => {
    if (!bodyBase.from_class_id || !bodyBase.to_class_id) return toast.error("Pick both current and next classes.");
    if (!bodyBase.student_ids.length) return toast.error("Move some students to the next list.");
    try {
      const res = await postPromote({ ...bodyBase, dry_run: true });
      toast.success(`Preview: ${res.summary.count} student(s)`);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Preview failed");
    }
  };

  const save = async () => {
    if (!bodyBase.from_class_id || !bodyBase.to_class_id) return toast.error("Pick both current and next classes.");
    if (!bodyBase.student_ids.length) return toast.error("Move some students to the next list.");
    setSaving(true);
    try {
      const res = await postPromote({ ...bodyBase, dry_run: false });
      toast.success(`Promoted ${res.moved} student(s)`);
      setRight([]); setSelRight(new Set());
      await loadLeft();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Promotion failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Student Promotion</h1>

      {/* Top row: choose years */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
        <div className="p-3 border rounded-lg">
          <div className="font-medium mb-2">Academic Year (Current)</div>
          <select className="select select-bordered w-full"
                  value={fromYear}
                  onChange={e => setFromYear(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="p-3 border rounded-lg">
          <div className="font-medium mb-2">Next Academic Year</div>
          <select className="select select-bordered w-full"
                  value={toYear}
                  onChange={e => setToYear(e.target.value)}>
            {[...years, Math.max(0, ...(years||[])) + 1]
              .filter((v,i,self) => self.indexOf(v)===i)
              .sort((a,b)=>a-b)
              .map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Main panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* LEFT: current */}
        <div className="p-3 border rounded-lg">
          <div className="font-semibold mb-2">Current</div>

          <label className="block text-sm">Class</label>
          <select className="select select-bordered w-full mb-2"
                  value={fromClassId}
                  onChange={e => setFromClassId(e.target.value)}>
            <option value="">Select</option>
            {fromClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <label className="block text-sm">Section</label>
          <select className="select select-bordered w-full mb-2"
                  value={fromSectionId}
                  onChange={e => setFromSectionId(e.target.value)}
                  disabled={!fromSections.length}>
            <option value="">All sections</option>
            {fromSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* Eligibility filter */}
          <div className="flex items-center gap-4 my-2 text-sm">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="elig" checked={eligibility==="ALL"} onChange={()=>setEligibility("ALL")} />
              All
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="elig" checked={eligibility==="ELIGIBLE"} onChange={()=>setEligibility("ELIGIBLE")} />
              Eligible
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="elig" checked={eligibility==="NOT_ELIGIBLE"} onChange={()=>setEligibility("NOT_ELIGIBLE")} />
              Not eligible
            </label>
            <button className="btn btn-xs ml-auto" onClick={loadLeft} disabled={!fromClassId || loading}>
              {loading ? "Loading…" : "Load"}
            </button>
          </div>

          <div className="overflow-auto max-h-80 border rounded">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th></th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                {leftFiltered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <input type="checkbox"
                             checked={selLeft.has(s.id)}
                             onChange={()=>toggleSelLeft(s.id)} />
                    </td>
                    <td className="whitespace-nowrap">{s.name}</td>
                    <td>{/* current class name not needed; video shows; omit to keep simple */}</td>
                    <td>{s.section}</td>
                  </tr>
                ))}
                {(!leftFiltered.length && !loading) && (
                  <tr><td colSpan={4} className="p-3 text-slate-500">No students</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CENTER arrows */}
        <div className="flex flex-col items-center justify-center gap-3">
          <button className="btn" onClick={moveRight}>&rarr;</button>
          <button className="btn" onClick={moveLeft}>&larr;</button>
        </div>

        {/* RIGHT: next */}
        <div className="p-3 border rounded-lg">
          <div className="font-semibold mb-2">Next</div>

          <label className="block text-sm">Class</label>
          <select className="select select-bordered w-full mb-2"
                  value={toClassId}
                  onChange={e => setToClassId(e.target.value)}>
            <option value="">Select</option>
            {toClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <label className="block text-sm">Section</label>
          <select className="select select-bordered w-full mb-2"
                  value={toSectionId}
                  onChange={e => setToSectionId(e.target.value)}
                  disabled={!toSections.length}>
            <option value="">-- choose --</option>
            {toSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <div className="overflow-auto max-h-80 border rounded">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th></th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                {right.map(s => (
                  <tr key={s.id}>
                    <td>
                      <input type="checkbox"
                             checked={selRight.has(s.id)}
                             onChange={()=>toggleSelRight(s.id)} />
                    </td>
                    <td className="whitespace-nowrap">{s.name}</td>
                    <td></td>
                    <td>{toSections.find(x => String(x.id)===String(toSectionId))?.name || "-"}</td>
                  </tr>
                ))}
                {(!right.length) && (
                  <tr><td colSpan={4} className="p-3 text-slate-500">No students selected</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 mt-3 justify-end">
            <button className="btn btn-outline" onClick={preview} disabled={!right.length}>Preview</button>
            <button className="btn btn-primary" onClick={save} disabled={!right.length || saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
