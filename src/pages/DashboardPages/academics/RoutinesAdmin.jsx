import { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import AxiosInstance from "../../../components/AxiosInstance";

export default function RoutinesAdmin() {
  const [form, setForm] = useState({
    class_name: "",
    category: "Academic",
    file: null,
  });
  const [classes, setClasses] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterCat, setFilterCat] = useState("Academic");

  // Load classes for dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await AxiosInstance.get("classes/");
        setClasses(Array.isArray(res.data) ? res.data : []);
      } catch {
        setClasses([]);
      }
    })();
  }, []);

  // Load routines
  const loadRoutines = async (cat = filterCat) => {
    try {
      setLoading(true);
      const res = await AxiosInstance.get("routines/", { params: { category: cat } });
      setRoutines(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (e) {
      toast.error("Failed to load routines");
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutines(filterCat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCat]);

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const onFile = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) return setField("file", null);
    const okSize = f.size <= 10 * 1024 * 1024;
    if (!okSize) return toast.error("File must be ≤ 10MB");
    setField("file", f);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.class_name) return toast.error("Class is required");
    if (!form.file) return toast.error("File is required");

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("class_name", form.class_name); // ✅ backend expects string
      fd.append("category", form.category);     // ✅ Academic or Exam
      fd.append("file", form.file);             // ✅ file upload

      await AxiosInstance.post("routines/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Routine uploaded");
      setForm({ class_name: "", category: "Academic", file: null });
      await loadRoutines(form.category);
    } catch (e) {
      console.error("Upload failed:", e?.response?.data);
      toast.error("Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this routine?")) return;
    try {
      await AxiosInstance.delete(`routines/${id}/`);
      toast.success("Deleted");
      await loadRoutines(filterCat);
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Toaster position="top-center" />
      <h1 className="text-2xl font-bold mb-4">Routines Admin</h1>

      {/* Upload form */}
      <form
        onSubmit={onSubmit}
        className="bg-white p-4 border rounded-xl mb-6 grid gap-4 md:grid-cols-2"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Class</label>
          <select
            className="select select-bordered w-full"
            value={form.class_name}
            onChange={(e) => setField("class_name", e.target.value)}
            required
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            className="select select-bordered w-full"
            value={form.category}
            onChange={(e) => setField("category", e.target.value)}
          >
            <option value="Academic">Academic</option>
            <option value="Exam">Exam</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Routine File</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={onFile}
            className="file-input file-input-bordered w-full"
          />
        </div>

        <div className="md:col-span-2">
          <button disabled={submitting} className="btn btn-primary">
            {submitting ? "Uploading…" : "Upload Routine"}
          </button>
        </div>
      </form>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["Academic", "Exam"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`btn ${filterCat === cat ? "btn-active" : ""}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border rounded-xl">
        {loading ? (
          <div className="p-6 text-center">Loading…</div>
        ) : routines.length === 0 ? (
          <div className="p-6 text-center">No routines for {filterCat}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Class</th>
                <th>Category</th>
                <th>File</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {routines.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.class_name}</td>
                  <td>{r.category}</td>
                  <td>
                    <a
                      href={r.file}
                      target="_blank"
                      rel="noreferrer"
                      className="link link-primary"
                    >
                      View / Download
                    </a>
                  </td>
                  <td>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="btn btn-sm btn-error"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
