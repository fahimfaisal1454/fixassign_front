import React, { useState, useEffect, useMemo } from "react";
import AxiosInstance from "../../../components/AxiosInstance";

const CATEGORY_OPTIONS = ["Public", "Internal"];
const INTERNAL_EXAM_OPTIONS = ["Half Yearly", "Year Final"];
const PUBLIC_EXAM_OPTIONS = ["JSC", "SSC", "HSC"];

export default function ResultManager() {
  const [results, setResults] = useState([]);
  const [classNames, setClassNames] = useState([]);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    year: "",
    category: "",
    class_name: "",
    exam_name: "",
    file: null, // File | null
  });
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [filePreviewUrl, setFilePreviewUrl] = useState(null); // for image preview

  const getClassLabel = (idOrName) => {
    if (!idOrName) return "N/A";
    if (typeof idOrName === "string" && isNaN(Number(idOrName))) return idOrName;
    const id = Number(idOrName);
    const found = classNames.find((c) => c.id === id);
    return found?.name || String(idOrName);
  };

  const getWhen = (r) => r?.created_at || r?.updated_at || null;

  const fetchResults = async () => {
    const res = await AxiosInstance.get("results/");
    const data = Array.isArray(res.data) ? res.data : [];
    const sorted = [...data].sort((a, b) => {
      const ya = Number(a?.year) || 0;
      const yb = Number(b?.year) || 0;
      if (yb !== ya) return yb - ya;
      const da = new Date(getWhen(a) || 0).getTime();
      const db = new Date(getWhen(b) || 0).getTime();
      return db - da;
    });
    setResults(sorted);
  };

  const fetchClassNames = async () => {
    const res = await AxiosInstance.get("classes/");
    setClassNames(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    fetchResults();
    fetchClassNames();
  }, []);

  // Dynamic exam options based on category
  const getExamOptions = (category) => {
    if (category === "Public") return PUBLIC_EXAM_OPTIONS;
    if (category === "Internal") return INTERNAL_EXAM_OPTIONS;
    return [];
  };

  // Ensure exam_name stays valid when category changes
  useEffect(() => {
    const valid = getExamOptions(formData.category);
    if (!valid.includes(formData.exam_name)) {
      setFormData((p) => ({ ...p, exam_name: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.category]);

  // Simple helper to tell if a URL looks like an image (for existing files)
  const isImageUrl = (url) => /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(url || "");

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "file") {
      const file = files?.[0] || null;
      if (!file) {
        setFormData((p) => ({ ...p, file: null }));
        setFilePreviewUrl(null);
        return;
      }

      // Accept only PDF or images
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) {
        // Basic guard; you can swap for a toast if you use one in this page.
        window.alert("Only PDF or image files are allowed.");
        e.target.value = "";
        setFormData((p) => ({ ...p, file: null }));
        setFilePreviewUrl(null);
        return;
      }

      setFormData((p) => ({ ...p, file }));
      // Show preview only for images
      if (isImage) {
        const url = URL.createObjectURL(file);
        setFilePreviewUrl(url);
      } else {
        setFilePreviewUrl(null);
      }
    } else if (name === "category") {
      // Update category; exam_name will be validated/reset in the effect above
      setFormData((p) => ({ ...p, category: value }));
    } else {
      setFormData((p) => ({ ...p, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const form = new FormData();
    form.append("year", formData.year);
    form.append("category", formData.category);
    form.append("class_name", formData.class_name);
    form.append("exam_name", formData.exam_name);
    if (formData.file instanceof File) form.append("file", formData.file);

    if (editing) {
      await AxiosInstance.put(`results/${formData.id}/`, form);
    } else {
      await AxiosInstance.post("results/", form);
    }

    resetForm();
    await fetchResults();
  };

  const handleEdit = (result) => {
    setFormData({
      id: result.id,
      year: result.year ?? "",
      category: result.category ?? "",
      class_name: String(result.class_name ?? result.className ?? ""),
      exam_name: result.exam_name ?? "",
      file: null,
    });
    setExistingFileUrl(result.file || "");
    setFilePreviewUrl(null);
    setEditing(true);
    // also clear any existing file input
    const f = document.getElementById("result_file_input");
    if (f) f.value = "";
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this result?")) return;
    await AxiosInstance.delete(`results/${id}/`);
    fetchResults();
  };

  const resetForm = () => {
    setFormData({
      id: null,
      year: "",
      category: "",
      class_name: "",
      exam_name: "",
      file: null,
    });
    setExistingFileUrl("");
    setFilePreviewUrl(null);
    setEditing(false);
    const f = document.getElementById("result_file_input");
    if (f) f.value = "";
  };

  const formattedResults = useMemo(() => results, [results]);
  const currentExamOptions = getExamOptions(formData.category);
  const examPlaceholder =
    formData.category === "Public"
      ? "Exam (JSC/SSC/HSC)"
      : formData.category === "Internal"
      ? "Exam (Half Yearly/Year Final)"
      : "Select Category first";

  return (
    <div
      className="min-h-screen p-6 md:p-8"
      style={{ backgroundColor: "#D2D3D4", color: "#111" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl md:text-4xl font-extrabold">
            {editing ? "Edit Result" : "Add Result"}
          </h2>
          {editing && (
            <button onClick={resetForm} className="btn btn-md font-semibold">
              Cancel Edit
            </button>
          )}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 border border-gray-400 bg-white rounded-2xl p-5 shadow"
          style={{ color: "#111" }}
        >
          <input
            type="number"
            name="year"
            placeholder="Year"
            value={formData.year}
            onChange={handleChange}
            className="input input-bordered input-md bg-white text-black placeholder-gray-500"
            min="2000"
            max="2099"
            required
          />

          {/* Category */}
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="select select-bordered select-md bg-white text-black"
            required
          >
            <option value="">Category (Public/Internal)</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* Class */}
          <select
            name="class_name"
            value={formData.class_name}
            onChange={handleChange}
            className="select select-bordered select-md bg-white text-black"
            required
          >
            <option value="">Select Class</option>
            {classNames.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          {/* Exam (dependent on Category) */}
          <select
            name="exam_name"
            value={formData.exam_name}
            onChange={handleChange}
            className="select select-bordered select-md bg-white text-black"
            required
            disabled={!formData.category}
          >
            <option value="">{examPlaceholder}</option>
            {currentExamOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* Existing file preview when editing */}
          {editing && existingFileUrl && !formData.file && (
            <div className="md:col-span-2 border border-gray-300 rounded-xl p-3 flex items-center justify-between bg-gray-50 gap-4">
              <div className="flex items-center gap-4">
                {isImageUrl(existingFileUrl) ? (
                  <img
                    src={existingFileUrl}
                    alt="Result file"
                    className="w-16 h-16 object-cover rounded-md border"
                  />
                ) : (
                  <div className="text-sm opacity-80">Existing file:</div>
                )}
                <a
                  href={existingFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-800 font-semibold"
                >
                  View current file
                </a>
              </div>
              <span className="text-sm opacity-80">
                (Uploading a new file will replace it)
              </span>
            </div>
          )}

          {/* New file input (PDF or Image) */}
          <div className="md:col-span-2">
            <input
              id="result_file_input"
              type="file"
              name="file"
              onChange={handleChange}
              className="file-input file-input-bordered file-input-md bg-white text-black w-full"
              accept="application/pdf,image/*"
            />
            <p className="text-xs text-gray-500 mt-1">
              Allowed: PDF or image (PNG, JPG, JPEG, WEBP, GIF, etc.)
            </p>

            {/* New image preview (only if selected file is an image) */}
            {filePreviewUrl && (
              <div className="mt-3">
                <div className="text-sm font-medium mb-1">Preview:</div>
                <img
                  src={filePreviewUrl}
                  alt="Selected preview"
                  className="w-24 h-24 object-cover rounded-md border"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-md font-bold md:col-span-2"
          >
            {editing ? "Update Result" : "Add Result"}
          </button>
        </form>

        {/* List */}
        <div className="mb-3">
          <h3 className="text-2xl font-bold">Result List</h3>
        </div>

        <div className="border border-gray-400 rounded-2xl overflow-x-auto shadow bg-white">
          <table className="table text-base">
            <thead className="bg-gray-200">
              <tr>
                <th className="text-lg font-extrabold text-black px-4 py-3">
                  Year
                </th>
                <th className="text-lg font-extrabold text-black px-4 py-3">
                  Category
                </th>
                <th className="text-lg font-extrabold text-black px-4 py-3">
                  Class
                </th>
                <th className="text-lg font-extrabold text-black px-4 py-3">
                  Exam
                </th>
                <th className="text-lg font-extrabold text-black px-4 py-3">
                  File
                </th>
                <th className="text-lg font-extrabold text-black px-4 py-3 text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {formattedResults.map((res) => (
                <tr
                  key={res.id}
                  className="hover:bg-gray-100 transition-colors border-t border-gray-300"
                >
                  <td className="px-4 py-3 font-medium">{res.year}</td>
                  <td className="px-4 py-3">{res.category}</td>
                  <td className="px-4 py-3">
                    {getClassLabel(res.class_name ?? res.className)}
                  </td>
                  <td className="px-4 py-3">{res.exam_name}</td>
                  <td className="px-4 py-3">
                    {res.file ? (
                      <a
                        href={res.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-blue-800 font-semibold"
                      >
                        View / Download
                      </a>
                    ) : (
                      <span className="opacity-70">No File</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(res)}
                        className="btn btn-sm btn-outline btn-warning font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(res.id)}
                        className="btn btn-sm btn-outline btn-error font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {formattedResults.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 opacity-80">
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
            {formattedResults.length > 0 && (
              <tfoot>
                <tr>
                  <td
                    colSpan={6}
                    className="text-right text-sm p-3 opacity-80 bg-gray-100 border-t border-gray-300"
                  >
                    Total: {formattedResults.length}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
