// src/pages/DashboardPages/Master/AddSubject.jsx
import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Toaster, toast } from "react-hot-toast";
import axiosInstance from "../../../components/AxiosInstance";

const Chip = ({ children }) => (
  <span className="inline-flex items-center justify-center h-6 px-2 text-xs rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 mr-1">
    {children}
  </span>
);

export default function AddSubject() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  // year controls (like AddClass)
  const nowYear = new Date().getFullYear();
  const [years, setYears] = useState([nowYear]);
  const [selectedYear, setSelectedYear] = useState(nowYear);

  const [loading, setLoading] = useState(true);

  // in-flight flags
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // form state (create/edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    // create uses class_ids (multi), edit uses class_name (single)
    class_ids: [],
    class_name: "",
    is_theory: true,
    is_practical: false,
  });

  // filters
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState(null);

  const classOptions = useMemo(
    () =>
      (classes || []).map((c) => ({
        value: c.id,
        label: `${c.name}`, // name already tied to selectedYear
      })),
    [classes]
  );

  const classNameById = useMemo(() => {
    const map = new Map();
    classes.forEach((c) => map.set(String(c.id), c.name));
    return map;
  }, [classes]);

  // -------- Year-aware loaders (like AddClass) --------
  const loadYears = async () => {
    try {
      const res = await axiosInstance.get("classes/years/");
      const serverYearsRaw = Array.isArray(res.data) ? res.data : [];
      const serverYears = serverYearsRaw.map((y) => Number(y)).filter((y) => !isNaN(y));
      const allYears = Array.from(new Set([...serverYears, nowYear])).sort((a, b) => b - a);
      setYears(allYears);
      setSelectedYear((prev) => (allYears.includes(prev) ? prev : allYears[0]));
    } catch (e) {
      console.error(e);
      // fall back to current year
      setYears([nowYear]);
      setSelectedYear(nowYear);
    }
  };

  const loadYearData = async (year) => {
    // fetch both subjects and classes for the chosen year
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        axiosInstance.get("subjects/", { params: { year } }),
        axiosInstance.get("classes/", { params: { year } }),
      ]);

      // classes sorted alpha
      const clss = (Array.isArray(cRes.data) ? cRes.data : cRes.data?.results || []).sort(
        (a, b) => (a.name || "").localeCompare(b.name || "")
      );

      // subjects sorted alpha
      const subs = (Array.isArray(sRes.data) ? sRes.data : sRes.data?.results || []).sort(
        (a, b) => (a.name || "").localeCompare(b.name || "")
      );

      setClasses(clss);
      setSubjects(subs);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // initial + years
  useEffect(() => {
    (async () => {
      await loadYears();
    })();
  }, []);

  // whenever selectedYear changes, load that year's data and reset class filter
  useEffect(() => {
    setClassFilter(null);
    if (selectedYear) loadYearData(selectedYear);
  }, [selectedYear]);

  const filtered = useMemo(() => {
    let data = [...subjects];
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      data = data.filter((s) => (s.name || "").toLowerCase().includes(n));
    }
    if (classFilter?.value) {
      data = data.filter((s) => String(s.class_name) === String(classFilter.value));
    }
    return data;
  }, [subjects, q, classFilter]);

  const openCreate = () => {
    setForm({
      name: "",
      class_ids: [],
      class_name: "",
      is_theory: true,
      is_practical: false,
    });
    setIsEditing(false);
    setCurrentId(null);
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      name: row.name || "",
      class_ids: [], // not used in edit
      class_name: row.class_name || "",
      is_theory: !!row.is_theory,
      is_practical: !!row.is_practical,
    });
    setIsEditing(true);
    setCurrentId(row.id);
    setIsModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const nameTrim = form.name.trim();
    if (!nameTrim) return toast.error("Subject name is required");

    if (isEditing) {
      if (!form.class_name) return toast.error("Please select a class");
      setUpdating(true);
      try {
        const payload = {
          name: nameTrim,
          class_name: form.class_name, // numeric class id
          is_theory: !!form.is_theory,
          is_practical: !!form.is_practical,
        };
        await axiosInstance.put(`subjects/${currentId}/`, payload);
        toast.success("Subject updated");
        setIsModalOpen(false);
        await loadYearData(selectedYear);
      } catch (e) {
        console.error(e);
        const msg =
          e?.response?.data?.detail ||
          (Array.isArray(e?.response?.data?.name)
            ? e.response.data.name.join(", ")
            : e?.response?.data?.name) ||
          "Update failed";
        toast.error(msg);
      } finally {
        setUpdating(false);
      }
      return;
    }

    // Create (multi-class) — classes are from the selected year
    if (!form.class_ids.length) {
      return toast.error("Please select at least one class");
    }

    setSaving(true);
    try {
      // prevent duplicates for current year: (subject name, class) pair
      const existingKey = new Set(
        subjects.map(
          (s) => `${String(s.class_name)}::${(s.name || "").toLowerCase()}`
        )
      );

      const targets = form.class_ids.map((opt) => opt?.value).filter(Boolean);
      const toCreate = targets.filter(
        (cid) => !existingKey.has(`${String(cid)}::${nameTrim.toLowerCase()}`)
      );

      if (toCreate.length === 0) {
        toast("Nothing to create — all selected classes already have this subject.", { icon: "ℹ️" });
      } else {
        await Promise.all(
          toCreate.map((cid) =>
            axiosInstance.post("subjects/", {
              name: nameTrim,
              class_name: cid,
              is_theory: !!form.is_theory,
              is_practical: !!form.is_practical,
            })
          )
        );
        const skipped = targets.length - toCreate.length;
        toast.success(
          `Created ${toCreate.length} ${toCreate.length > 1 ? "subjects" : "subject"}${
            skipped ? `, skipped ${skipped} duplicate${skipped > 1 ? "s" : ""}` : ""
          }`
        );
      }

      setIsModalOpen(false);
      await loadYearData(selectedYear);
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.detail ||
        (Array.isArray(e?.response?.data?.name)
          ? e.response.data.name.join(", ")
          : e?.response?.data?.name) ||
        e?.message ||
        "Save failed";
      toast.error(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const destroy = async (id) => {
    if (!confirm("Delete this subject?")) return;
    setDeletingId(id);
    try {
      await axiosInstance.delete(`subjects/${id}/`);
      toast.success("Subject deleted");
      await loadYearData(selectedYear);
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.detail || "Delete failed";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4">
      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Subject Management</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          Add Subject
        </button>
      </div>

      {/* View Year (like AddClass) */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-slate-600">View Year:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-2 max-w-2xl mb-4">
        <div>
          <label className="block text-sm mb-1 text-slate-700">Search by name</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type subject name…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-700">Filter by class</label>
          <Select
            isClearable
            options={classOptions}
            value={classFilter}
            onChange={setClassFilter}
            placeholder="All classes"
            classNamePrefix="select"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left text-sm text-slate-600 w-16">#</th>
              <th className="px-3 py-2 text-left text-sm text-slate-600">Subject</th>
              <th className="px-3 py-2 text-left text-sm text-slate-600">Class</th>
              <th className="px-3 py-2 text-left text-sm text-slate-600">Type</th>
              <th className="px-3 py-2 text-right text-sm text-slate-600 w-44">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                  No subjects found
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => {
                const clsName = classNameById.get(String(s.class_name)) || "-";
                const typeLabels = [
                  s.is_theory ? "Theoretical" : null,
                  s.is_practical ? "Practical" : null,
                ].filter(Boolean);
                const isDeleting = deletingId === s.id;
                return (
                  <tr key={s.id} className="border-t hover:bg-slate-50/50">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{s.name || "-"}</td>
                    <td className="px-3 py-2">{clsName}</td>
                    <td className="px-3 py-2">{typeLabels.length ? typeLabels.join(", ") : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => destroy(s.id)}
                          disabled={isDeleting}
                          className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                        >
                          {isDeleting ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="bg-white rounded-xl w-[94%] max-w-md shadow-xl border">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {isEditing ? "Edit Subject" : "Add Subject"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={save} className="px-5 py-5 grid gap-4">
              <div>
                <label className="block text-sm mb-1 text-slate-700">Subject name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Mathematics, Physics"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Class picker (year-scoped) */}
              <div>
                <label className="block text-sm mb-1 text-slate-700">
                  {isEditing ? "Class *" : "Classes *"}
                </label>

                {isEditing ? (
                  <Select
                    options={classOptions}
                    value={
                      classOptions.find((o) => String(o.value) === String(form.class_name)) || null
                    }
                    onChange={(opt) => setForm((f) => ({ ...f, class_name: opt?.value || "" }))}
                    placeholder="Select class…"
                    classNamePrefix="select"
                    isDisabled={updating}
                  />
                ) : (
                  <>
                    <Select
                      isMulti
                      options={classOptions}
                      value={form.class_ids}
                      onChange={(opts) => setForm((f) => ({ ...f, class_ids: opts || [] }))}
                      placeholder="Select one or more classes…"
                      classNamePrefix="select"
                      isDisabled={saving}
                    />
                    {!!form.class_ids.length && (
                      <div className="mt-2 flex flex-wrap">
                        {form.class_ids.map((o) => (
                          <Chip key={o.value}>{o.label}</Chip>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm mb-2 text-slate-700">Subject type</label>
                <div className="flex items-center gap-5">
                  <label className="inline-flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_theory}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          is_theory: e.target.checked,
                        }))
                      }
                      disabled={saving || updating}
                    />
                    <span>Theoretical</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_practical}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          is_practical: e.target.checked,
                        }))
                      }
                      disabled={saving || updating}
                    />
                    <span>Practical</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded border"
                  disabled={saving || updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={saving || updating}
                >
                  {isEditing ? (updating ? "Updating…" : "Update") : saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
