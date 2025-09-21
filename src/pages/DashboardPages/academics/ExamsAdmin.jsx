// src/pages/DashboardPages/academics/ExamsAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import AxiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function ExamsAdmin() {
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({
    year: null,       // {value,label}
    class_name: [],   // [{value,label}]
    section: [],      // [{value,label,classId}]
    name: "",
  });

  const [exams, setExams] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState(null); // {id}
  const [editingName, setEditingName] = useState("");

  /* --------------------- Fetch years --------------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await AxiosInstance.get("classes/years/");
        const serverYears = Array.isArray(res.data)
          ? res.data.map((y) => ({ value: y, label: String(y) }))
          : [];
        setYears(serverYears);
        if (serverYears.length) {
          const latest = serverYears.slice().sort((a, b) => Number(b.value) - Number(a.value))[0];
          setForm((p) => ({ ...p, year: latest }));
        }
      } catch {
        toast.error("Failed to load years");
      }
    })();
  }, []);

  /* --------------------- Fetch classes for year --------------------- */
  useEffect(() => {
    if (!form.year?.value) {
      setClasses([]);
      setForm((p) => ({ ...p, class_name: [], section: [] }));
      return;
    }
    (async () => {
      try {
        const { data } = await AxiosInstance.get("classes/", { params: { year: form.year.value } });
        setClasses(Array.isArray(data) ? data : data?.results || []);
      } catch {
        toast.error("Failed to load classes");
      }
    })();
  }, [form.year]);

  /* --------------------- Options & lookup maps --------------------- */
  const classOptions = useMemo(
    () => classes.map((cls) => ({ value: cls.id, label: cls.name })),
    [classes]
  );

  const classIdToName = useMemo(() => {
    const m = new Map();
    classes.forEach((c) => m.set(Number(c.id), c.name));
    return m;
  }, [classes]);

  const selectedClassIds = useMemo(
    () => form.class_name.map((c) => Number(c.value)),
    [form.class_name]
  );

  const allSectionOptions = useMemo(() => {
    let out = [];
    for (const cls of classes) {
      if (selectedClassIds.includes(Number(cls.id))) {
        const secs = (cls.sections_detail || cls.sections || []).map((s) => ({
          value: s.id,
          label: s.name,
          classId: Number(cls.id),
        }));
        out = out.concat(secs);
      }
    }
    return out;
  }, [classes, selectedClassIds]);

  const sectionIdToNameByClass = useMemo(() => {
    // Map<classId, Map<sectionId, sectionName>>
    const root = new Map();
    for (const cls of classes) {
      const m = new Map();
      const secs = (cls.sections_detail || cls.sections || []);
      secs.forEach((s) => m.set(Number(s.id), s.name));
      root.set(Number(cls.id), m);
    }
    return root;
  }, [classes]);

  /* --------------------- Load exams (for chosen pairs) --------------------- */
  const load = async () => {
    if (!form.year?.value || !form.class_name.length || !form.section.length) {
      setExams([]);
      return;
    }
    setLoading(true);
    try {
      const collected = new Map();
      for (const cls of form.class_name) {
        for (const sec of form.section.filter((s) => Number(s.classId) === Number(cls.value))) {
          const { data } = await AxiosInstance.get("exams/", {
            params: {
              class_name: Number(cls.value),
              section: Number(sec.value),
              year: form.year.value,
            },
          });
          (Array.isArray(data) ? data : []).forEach((ex) => collected.set(ex.id, ex));
        }
      }
      setExams(Array.from(collected.values()));
    } catch {
      toast.error("Failed to load exams");
      setExams([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [form.year, form.class_name, form.section]);

  /* --------------------- Create exams --------------------- */
  const createExam = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!form.year?.value || !form.class_name.length || !form.section.length || !name) {
      return toast.error("Fill Year, Classes, Sections, Exam name");
    }
    const pairs = [];
    for (const cls of form.class_name) {
      for (const sec of form.section.filter((s) => Number(s.classId) === Number(cls.value))) {
        pairs.push({ class_name: Number(cls.value), section: Number(sec.value) });
      }
    }
    if (!pairs.length) return toast.error("No valid class–section pairs");

    setCreating(true);
    try {
      let ok = 0, fail = 0;
      for (const p of pairs) {
        try {
          await AxiosInstance.post("exams/", {
            class_name: p.class_name,
            section: p.section,
            year: form.year.value,
            name,
          });
          ok++;
        } catch {
          fail++;
        }
      }
      if (fail === 0) toast.success(`Created ${ok} exam${ok > 1 ? "s" : ""}`);
      else toast(`Created ${ok}, failed ${fail}. Check duplicates/permissions.`);
      setForm((prev) => ({ ...prev, name: "" }));
      await load();
    } finally {
      setCreating(false);
    }
  };

  /* --------------------- Actions --------------------- */
  const togglePublish = async (ex) => {
    try {
      await AxiosInstance.patch(`exams/${ex.id}/`, { is_published: !ex.is_published });
      toast.success(!ex.is_published ? "Published" : "Unpublished");
      await load();
    } catch {
      toast.error("Update failed");
    }
  };

  const openEdit = (ex) => {
    setEditing({ id: ex.id });
    setEditingName(ex.name || "");
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    const name = editingName.trim();
    if (!name) return toast.error("Name required");
    try {
      await AxiosInstance.patch(`exams/${editing.id}/`, { name });
      toast.success("Updated");
      setEditing(null);
      await load();
    } catch {
      toast.error("Update failed");
    }
  };

  const removeExam = async (ex) => {
    if (!window.confirm(`Delete "${ex.name}"?`)) return;
    try {
      await AxiosInstance.delete(`exams/${ex.id}/`);
      toast.success("Deleted");
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* --------------------- Grouping & labels --------------------- */
  // year -> classKey -> sectionKey -> [exams]
  const grouped = useMemo(() => {
    const byYear = new Map();
    for (const ex of exams) {
      const yr = ex.year ?? "—";
      const clsId = Number(ex.class_name?.id ?? ex.class_name);
      const secId = Number(ex.section?.id ?? ex.section);

      if (!byYear.has(yr)) byYear.set(yr, new Map());
      const byClass = byYear.get(yr);
      if (!byClass.has(clsId)) byClass.set(clsId, new Map());
      const bySec = byClass.get(clsId);
      if (!bySec.has(secId)) bySec.set(secId, []);
      bySec.get(secId).push(ex);
    }
    return byYear;
  }, [exams]);

  const yearsSorted = useMemo(
    () => Array.from(grouped.keys()).sort((a, b) => String(b).localeCompare(String(a))),
    [grouped]
  );

  const labelClass = (clsIdOrObj) => {
    if (clsIdOrObj?.name) return clsIdOrObj.name;
    const id = Number(clsIdOrObj);
    return classIdToName.get(id) || `Class ID: ${id}`;
  };

  const labelSection = (clsId, secIdOrObj) => {
    if (secIdOrObj?.name) return secIdOrObj.name;
    const sid = Number(secIdOrObj);
    const m = sectionIdToNameByClass.get(Number(clsId));
    return m?.get(sid) || `Section ID: ${sid}`;
  };

  /* --------------------- UI --------------------- */
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Exams (Admin)</h1>

      {/* Create form */}
      <form onSubmit={createExam} className="bg-white border p-4 rounded-md space-y-3">
        <div className="grid md:grid-cols-5 gap-3">
          <div>
            <label className="text-sm font-semibold">Year</label>
            <Select
              options={years}
              value={form.year}
              onChange={(val) =>
                setForm((p) => ({ ...p, year: val, class_name: [], section: [] }))
              }
              placeholder="Select year"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Classes</label>
            <Select
              isMulti
              options={classOptions}
              value={form.class_name}
              onChange={(val) => setForm((p) => ({ ...p, class_name: val, section: [] }))}
              isDisabled={!form.year}
              placeholder="Select classes"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-semibold">Sections</label>
            <Select
              isMulti
              options={allSectionOptions}
              value={form.section}
              onChange={(val) => setForm((p) => ({ ...p, section: val }))}
              isDisabled={!form.class_name.length}
              placeholder="Select sections"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Exam name</label>
            <input
              className="w-full border rounded px-2 py-1"
              placeholder="e.g., 1st term / Annual 2025"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
        </div>

        <button className="bg-[#2c8e3f] text-white rounded px-3 py-1" disabled={creating}>
          {creating ? "Creating..." : "Create Exam(s)"}
        </button>
      </form>

      {/* Organized list */}
      <div className="bg-white border p-4 rounded-md">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Exams</h2>
          {loading && <span className="text-xs text-gray-500">Loading…</span>}
        </div>

        {!exams.length ? (
          <p className="text-sm text-gray-600 mt-2">No exams.</p>
        ) : (
          <div className="mt-3 space-y-6">
            {yearsSorted.map((yr) => {
              const classMap = grouped.get(yr);
              const classIds = Array.from(classMap.keys());
              const total = Array.from(classMap.values()).reduce(
                (acc, m) => acc + Array.from(m.values()).reduce((a, arr) => a + arr.length, 0),
                0
              );

              return (
                <section key={yr} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-700">Year {yr}</h3>
                    <span className="text-[10px] text-gray-500">
                      {total} exam{total > 1 ? "s" : ""}
                    </span>
                  </div>

                  {classIds.map((cid) => {
                    const bySection = classMap.get(cid);
                    const allForClass = Array.from(bySection.values()).flat();
                    const sample = allForClass[0];
                    const classText = labelClass(sample?.class_name ?? cid);

                    return (
                      <div key={`${yr}-${cid}`} className="rounded-lg border bg-gray-50">
                        <div className="px-3 py-2 border-b flex items-center justify-between">
                          <div className="text-sm font-medium">{classText}</div>
                          <span className="text-xs text-gray-500">
                            {allForClass.length} item{allForClass.length > 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="p-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {Array.from(bySection.keys()).map((sid) => {
                            const list = bySection.get(sid);
                            const sampleSec = list[0];
                            const secText = labelSection(cid, sampleSec?.section ?? sid);

                            return (
                              <div key={`${yr}-${cid}-${sid}`} className="rounded-md border bg-white">
                                <div className="px-3 py-2 border-b flex items-center justify-between">
                                  <div className="text-xs font-semibold text-gray-700">
                                    {secText}
                                  </div>
                                  <span className="text-[10px] text-gray-500">
                                    {list.length} exam{list.length > 1 ? "s" : ""}
                                  </span>
                                </div>

                                <ul className="divide-y">
                                  {list
                                    .slice()
                                    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                                    .map((ex) => (
                                      <li
                                        key={ex.id}
                                        className="px-3 py-2 flex items-center justify-between"
                                      >
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium">{ex.name}</div>
                                          <div className="text-[11px] text-gray-500">ID: {ex.id}</div>
                                          <span
                                            className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded border ${
                                              ex.is_published
                                                ? "bg-green-50 text-green-700 border-green-200"
                                                : "bg-gray-50 text-gray-600 border-gray-200"
                                            }`}
                                          >
                                            {ex.is_published ? "Published" : "Draft"}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            onClick={() => togglePublish(ex)}
                                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                            title={ex.is_published ? "Unpublish" : "Publish"}
                                          >
                                            {ex.is_published ? "Unpublish" : "Publish"}
                                          </button>
                                          <button
                                            onClick={() => openEdit(ex)}
                                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                            title="Edit"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => removeExam(ex)}
                                            className="text-xs px-2 py-1 rounded border hover:bg-rose-50 text-rose-600"
                                            title="Delete"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="bg-white rounded-2xl w-[94%] max-w-md shadow-xl border">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="text-base font-semibold">Edit Exam</h3>
              <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-800">
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="e.g., 1st term"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded border">
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
