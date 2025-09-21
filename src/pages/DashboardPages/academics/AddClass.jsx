import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import AxiosInstance from "../../../components/AxiosInstance";

/** -------- Reusable Multi-select Dropdown with Checkboxes -------- */
function SectionMultiSelect({ sections, value, onChange, label = "Select Sections" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? sections.filter((s) => (s.name || "").toLowerCase().includes(needle))
      : sections;
  }, [q, sections]);

  const selectedCount = value.length;
  const selectedPreview = useMemo(() => {
    const names = sections
      .filter((s) => value.includes(s.id))
      .map((s) => s.name);
    if (names.length <= 2) {
      return names.join(", ") || "None";
    }
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [sections, value]);

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const selectAll = () => onChange(filtered.map((s) => s.id));
  const clearAll = () => onChange([]);

  return (
    <div className="relative" ref={rootRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <div className="flex items-center justify-between">
          <span className="text-slate-700">{selectedPreview}</span>
          <span className="ml-2 inline-flex items-center gap-2 text-xs text-slate-500">
            {selectedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {selectedCount} selected
              </span>
            )}
            <svg
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
            </svg>
          </span>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border bg-white shadow-lg">
          <div className="p-2 border-b">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sections…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-600 border-b">
            <div className="space-x-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-2 py-1 rounded border hover:bg-slate-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="px-2 py-1 rounded border hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
            <span className="text-slate-500">{filtered.length} found</span>
          </div>
          <div className="max-h-60 overflow-auto p-2">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-sm">No sections</div>
            ) : (
              filtered.map((s) => {
                const checked = value.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 px-2 py-2 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={() => toggle(s.id)}
                    />
                    <span className="text-slate-700 text-sm">{s.name}</span>
                  </label>
                );
              })
            )}
          </div>
          <div className="px-3 py-2 border-t">
            <button
              type="button"
              className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** --------------------------- Page --------------------------- */
export default function AddClass() {
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  const nowYear = new Date().getFullYear();
  const [years, setYears] = useState([nowYear]);
  const [selectedYear, setSelectedYear] = useState(nowYear);

  const [className, setClassName] = useState("");
  const [classYear, setClassYear] = useState(nowYear);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editYear, setEditYear] = useState(nowYear);
  const [editPicked, setEditPicked] = useState([]);
  const [updating, setUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const loadSections = async () => {
    try {
      const res = await AxiosInstance.get("sections/");
      const secs = (res.data || []).sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );
      setSections(secs);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load sections");
    }
  };

  const loadYears = async () => {
    try {
      const res = await AxiosInstance.get("classes/years/");
      const serverYearsRaw = Array.isArray(res.data) ? res.data : [];
      const serverYears = serverYearsRaw.map((y) => Number(y)).filter((y) => !isNaN(y));
      const allYears = Array.from(new Set([...serverYears, nowYear])).sort((a, b) => b - a);
      setYears(allYears);
      // if previously selected year is in allYears, keep it, else default to newest
      setSelectedYear((prev) => (allYears.includes(prev) ? prev : allYears[0]));
      setClassYear((prev) => (allYears.includes(prev) ? prev : allYears[0]));
    } catch (e) {
      console.error(e);
      setYears([nowYear]);
      setSelectedYear(nowYear);
      setClassYear(nowYear);
    }
  };

  const loadClassesForYear = async (year) => {
    setLoading(true);
    try {
      const res = await AxiosInstance.get("classes/", { params: { year } });
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setClasses(list);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadSections(), loadYears()]);
    })();
  }, []);

  useEffect(() => {
    loadClassesForYear(selectedYear);
  }, [selectedYear]);

  const filteredClasses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return classes;
    return classes.filter((c) =>
      String(c.year || "")
        .includes(needle) ||
      (c.name || "").toLowerCase().includes(needle) ||
      (c.sections_detail || []).some((s) =>
        (s.name || "").toLowerCase().includes(needle)
      )
    );
  }, [classes, q]);

  const save = async (e) => {
    e.preventDefault();
    const name = className.trim();
    if (!name) {
      toast.error("Class name is required");
      return;
    }
    if (!picked.length) {
      toast.error("Pick at least one section");
      return;
    }
    if (!classYear || isNaN(Number(classYear))) {
      toast.error("Year is required");
      return;
    }

    setSaving(true);
    try {
      await AxiosInstance.post("classes/", {
        name,
        year: Number(classYear),
        sections: picked,
      });
      toast.success("Class saved");
      setClassName("");
      setPicked([]);
      // Refresh classes for current view or switch year if new
      if (Number(classYear) !== Number(selectedYear)) {
        setSelectedYear(Number(classYear));
      } else {
        await loadClassesForYear(selectedYear);
      }
      // Refresh years list
      await loadYears();
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.detail ||
        (Array.isArray(e?.response?.data?.name)
          ? e.response.data.name.join(", ")
          : e?.response?.data?.name) ||
        e?.response?.data?.year ||
        "Save failed";
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setEditName(row.name || "");
    setEditYear(row.year || nowYear);
    setEditPicked((row.sections_detail || []).map((s) => s.id));
    setShowEdit(true);
  };

  const update = async () => {
    const name = editName.trim();
    if (!name) {
      toast.error("Class name is required");
      return;
    }
    if (!editPicked.length) {
      toast.error("Pick at least one section");
      return;
    }
    if (!editYear || isNaN(Number(editYear))) {
      toast.error("Year is required");
      return;
    }

    setUpdating(true);
    try {
      await AxiosInstance.patch(`classes/${editId}/`, {
        name,
        year: Number(editYear),
        sections: editPicked,
      });
      toast.success("Updated");
      setShowEdit(false);
      if (Number(editYear) !== Number(selectedYear)) {
        setSelectedYear(Number(editYear));
      } else {
        await loadClassesForYear(selectedYear);
      }
      await loadYears();
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.year ||
        (Array.isArray(e?.response?.data?.name)
          ? e.response.data.name.join(", ")
          : e?.response?.data?.name) ||
        "Update failed";
      toast.error(String(msg));
    } finally {
      setUpdating(false);
    }
  };

  const destroy = async (id) => {
    if (!window.confirm("Delete this class?")) return;
    setDeletingId(id);
    try {
      await AxiosInstance.delete(`classes/${id}/`);
      toast.success("Deleted");
      await loadClassesForYear(selectedYear);
      await loadYears();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.detail || "Delete failed";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Toaster position="top-center" />
      <div className="bg-white rounded-2xl border shadow-sm">
        <div className="px-6 pt-6 pb-3 border-b">
          <h2 className="text-2xl font-semibold text-slate-800">Class Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create a class (with academic year) and choose its sections.
          </p>
        </div>

        {/* View Year filter */}
        <div className="px-6 py-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-600">View Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Create */}
        <form onSubmit={save} className="px-6 py-5 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Class Name
            </label>
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g., One, Two, Three"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
            <input
              type="number"
              value={classYear}
              onChange={(e) => setClassYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              min="2000"
              max="2100"
            />
          </div>

          <div className="md:col-span-1">
            <SectionMultiSelect
              sections={sections}
              value={picked}
              onChange={setPicked}
              label="Sections"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={loading || saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>

        {/* Search */}
        <div className="px-6 pb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by year, class, or section…"
            className="w-full md:w-80 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* List */}
        <div className="px-6 pb-6">
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-medium text-slate-600 w-16">#</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-slate-600">Class</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-slate-600 w-28">Year</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-slate-600">Sections</th>
                  <th className="px-3 py-2 text-right text-sm font-medium text-slate-600 w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                      Loading…
                    </td>
                  </tr>
                ) : filteredClasses.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                      No data
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((row, i) => (
                    <tr key={row.id} className="border-t hover:bg-slate-50/50">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2">{row.year}</td>
                      <td className="px-3 py-2">
                        {(row.sections_detail || []).length ? (
                          <div className="flex flex-wrap gap-1">
                            {row.sections_detail.map((s) => (
                              <span
                                key={s.id}
                                className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => destroy(row.id)}
                            className="px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                            disabled={deletingId === row.id}
                          >
                            {deletingId === row.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="bg-white rounded-2xl w-[94%] max-w-2xl shadow-xl border">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Class</h3>
              <button
                onClick={() => setShowEdit(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Class Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  min="2000"
                  max="2100"
                />
              </div>
              <div className="md:col-span-2">
                <SectionMultiSelect
                  sections={sections}
                  value={editPicked}
                  onChange={setEditPicked}
                  label="Sections"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => setShowEdit(false)}
                  className="px-4 py-2 rounded-lg border"
                >
                  Cancel
                </button>
                <button
                  onClick={update}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  disabled={updating}
                >
                  {updating ? "Updating…" : "Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
