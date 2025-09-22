import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Toaster, toast } from "react-hot-toast";
import AxiosInstance from "../../../components/AxiosInstance";

// Small badge for section chips
const Chip = ({ children }) => (
  <span className="inline-flex items-center justify-center h-6 px-2 text-xs rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 mr-1">
    {children}
  </span>
);

export default function AssignedSubjects() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // NEW: year filter
  const [selectedYear, setSelectedYear] = useState(null);

  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSections, setSelectedSections] = useState([]); // for "Assign"
  const [selectedSubjects, setSelectedSubjects] = useState([]); // for "Assign"

  const [loading, setLoading] = useState(false);

  // Edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSubjectId, setEditSubjectId] = useState(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSections, setEditSections] = useState([]);

  // ------------- Loaders -------------
  const loadClasses = async () => {
    const res = await AxiosInstance.get("classes/");
    setClasses(res.data || []);
  };

  const loadSubjectsForClass = async (classId) => {
    const res = await AxiosInstance.get(`subjects/?class=${classId}`);
    setSubjects(res.data || []);
  };

  const loadAssignments = async (classId) => {
    const res = await AxiosInstance.get(`class-subjects/?class_id=${classId}`);
    setAssignments(res.data || []);
  };

  useEffect(() => {
    loadClasses().catch(console.error);
  }, []);

  // Reset dependent picks when year changes
  useEffect(() => {
    setSelectedClass(null);
    setSelectedSections([]);
    setSelectedSubjects([]);
    setSubjects([]);
    setAssignments([]);
  }, [selectedYear]);

  useEffect(() => {
    if (selectedClass?.value) {
      loadSubjectsForClass(selectedClass.value).catch(console.error);
      loadAssignments(selectedClass.value).catch(console.error);
      setSelectedSections([]);
      setSelectedSubjects([]);
    }
  }, [selectedClass]);

  // ------------- Options -------------
  const years = useMemo(() => {
    const s = new Set();
    (classes || []).forEach((c) => c.year && s.add(Number(c.year)));
    return Array.from(s).sort((a, b) => b - a);
  }, [classes]);

  const yearOptions = useMemo(
    () => years.map((y) => ({ value: y, label: String(y) })),
    [years]
  );

  const classOptions = useMemo(() => {
    const list = selectedYear
      ? (classes || []).filter((c) => Number(c.year) === Number(selectedYear))
      : classes || [];
    return list.map((c) => ({ value: c.id, label: c.name }));
  }, [classes, selectedYear]);

  const currentClass = useMemo(() => {
    if (!selectedClass) return null;
    return (classes || []).find((c) => c.id === selectedClass.value) || null;
  }, [selectedClass, classes]);

  const sectionOptions = useMemo(() => {
    if (!currentClass) return [];
    // prefer sections_detail (objects), else build from sections ids if present
    const details = currentClass.sections_detail || currentClass.sections || [];
    return details.map((s) =>
      typeof s === "object" ? { value: s.id, label: s.name } : { value: s, label: String(s) }
    );
  }, [currentClass]);

  const subjectOptions = useMemo(
    () =>
      (subjects || []).map((s) => ({
        value: s.id,
        label: s.name + (s.is_practical ? " (Practical)" : s.is_theory ? " (Theory)" : ""),
      })),
    [subjects]
  );

  // ------------- Assign (bulk add) -------------
  const assign = async () => {
    if (!selectedClass?.value) return toast.error("Select a class.");
    if (!selectedSections.length) return toast.error("Select at least one section.");
    if (!selectedSubjects.length) return toast.error("Select at least one subject.");

    try {
      setLoading(true);
      const payload = {
        class_id: selectedClass.value,
        section_ids: selectedSections.map((s) => s.value),
        subject_ids: selectedSubjects.map((s) => s.value),
      };
      const res = await AxiosInstance.post("class-subjects/bulk-assign/", payload);
      toast.success(`Assigned: ${res.data?.created ?? 0}`);
      await loadAssignments(selectedClass.value);
      setSelectedSections([]);
      setSelectedSubjects([]);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Assignment failed");
    } finally {
      setLoading(false);
    }
  };

  // ------------- Group assignments by subject -------------
  const grouped = useMemo(() => {
    const bySub = {};
    for (const a of assignments) {
      const sid = a.subject;
      if (!bySub[sid]) {
        bySub[sid] = {
          subjectId: sid,
          subjectName: a.subject_name,
          sectionNames: [],
          isPractical: false,
          isTheory: false,
          rows: [],
        };
      }
      bySub[sid].sectionNames.push(a.section_name);
      bySub[sid].rows.push(a);
    }
    for (const key of Object.keys(bySub)) {
      const s = subjects.find((x) => x.id === Number(key));
      if (s) {
        bySub[key].isPractical = !!s.is_practical;
        bySub[key].isTheory = !!s.is_theory;
      }
    }
    return Object.values(bySub).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [assignments, subjects]);

  // ------------- Edit modal -------------
  const openEdit = (subjectId) => {
    if (!currentClass) return;

    const g = grouped.find((x) => x.subjectId === subjectId);
    const initial = (g?.sectionNames || [])
      .map((name) => sectionOptions.find((o) => o.label === name) || null)
      .filter(Boolean);

    setEditSubjectId(subjectId);
    setEditSubjectName(subjects.find((s) => s.id === subjectId)?.name || "Subject");
    setEditSections(initial);
    setIsEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      if (!selectedClass?.value || !editSubjectId) return;
      const payload = {
        class_id: selectedClass.value,
        subject_id: editSubjectId,
        section_ids: editSections.map((s) => s.value),
      };
      await AxiosInstance.post("class-subjects/bulk-replace/", payload);
      toast.success("Updated");
      setIsEditOpen(false);
      await loadAssignments(selectedClass.value);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Update failed");
    }
  };

  // ------------- Delete (remove all for subject in class) -------------
  const removeAllForSubject = async (subjectId) => {
    if (!window.confirm("Remove this subject from all sections?")) return;
    try {
      const toRemove = assignments.filter((a) => a.subject === subjectId).map((a) => a.id);
      for (const id of toRemove) {
        await AxiosInstance.delete(`class-subjects/${id}/`);
      }
      toast.success("Removed");
      if (selectedClass?.value) await loadAssignments(selectedClass.value);
    } catch (e) {
      console.error(e);
      toast.error("Remove failed");
    }
  };

  return (
    <div className="p-4">
      <Toaster position="top-center" />

      {/* ------------ Assign panel ------------ */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Assign Subjects to Class Sections</h2>

        <div className="grid md:grid-cols-4 gap-3">
          {/* NEW: Year */}
          <div>
            <label className="block text-sm mb-1">Year</label>
            <Select
              isClearable
              options={yearOptions}
              value={yearOptions.find((o) => Number(o.value) === Number(selectedYear)) || null}
              onChange={(opt) => setSelectedYear(opt ? Number(opt.value) : null)}
              placeholder="All years"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Class</label>
            <Select
              options={classOptions}
              value={selectedClass}
              onChange={setSelectedClass}
              placeholder={selectedYear ? "Select class (year)" : "Select class"}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Sections</label>
            <Select
              isMulti
              options={sectionOptions}
              value={selectedSections}
              onChange={setSelectedSections}
              isDisabled={!selectedClass}
              placeholder="Select sections"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Subjects</label>
            <Select
              isMulti
              options={subjectOptions}
              value={selectedSubjects}
              onChange={setSelectedSubjects}
              isDisabled={!selectedClass}
              placeholder="Select subjects"
            />
          </div>
        </div>

        <div className="mt-3">
          <button
            onClick={assign}
            disabled={loading}
            className="px-5 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>

      {/* ------------ Grouped table ------------ */}
      <div className="bg-white rounded shadow p-4">
        <h3 className="text-lg font-semibold mb-3">
          Current Assignments
          {selectedClass ? ` — ${selectedClass.label}` : ""}
          {selectedYear ? ` (Year ${selectedYear})` : ""}
        </h3>

        {!selectedClass ? (
          <div className="text-slate-500">Select a class to view assignments.</div>
        ) : grouped.length === 0 ? (
          <div className="text-slate-500">No assignments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left w-1/4">Subject</th>
                  <th className="px-3 py-2 text-left w-1/4">Type</th>
                  <th className="px-3 py-2 text-left">Sections</th>
                  <th className="px-3 py-2 text-right w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => (
                  <tr key={g.subjectId} className="border-t">
                    <td className="px-3 py-2">{g.subjectName}</td>
                    <td className="px-3 py-2">
                      {g.isPractical ? "Practical" : g.isTheory ? "Theory" : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap">
                        {g.sectionNames.sort().map((n, i) => (
                          <Chip key={n + i}>{n}</Chip>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => openEdit(g.subjectId)}
                        className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeAllForSubject(g.subjectId)}
                        className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------ Edit Modal ------------ */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Edit sections for <span className="text-blue-600">{editSubjectName}</span>
              </h2>

              <label className="block text-sm mb-1">Sections</label>
              <Select
                isMulti
                options={sectionOptions}
                value={editSections}
                onChange={setEditSections}
                placeholder="Select sections"
              />

              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setIsEditOpen(false)} className="px-4 py-2 rounded border">
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
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
