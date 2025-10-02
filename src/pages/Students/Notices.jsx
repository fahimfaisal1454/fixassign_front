// src/pages/Student/Notices.jsx
import React, { useEffect, useMemo, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance"

const getNoticeDate = (n) => n?.date || n?.created_at || n?.updated_at || null;

const formatDate = (dStr) => {
  if (!dStr) return "N/A";
  const d = new Date(dStr);
  if (isNaN(d)) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
};

const isNew = (dStr) => {
  if (!dStr) return false;
  const d = new Date(dStr);
  if (isNaN(d)) return false;
  return Date.now() - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
};

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const res = await AxiosInstance.get("notices/");
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      const sorted = [...list].sort((a, b) => {
        const da = new Date(getNoticeDate(a) || 0).getTime();
        const db = new Date(getNoticeDate(b) || 0).getTime();
        return db - da;
      });
      setNotices(sorted);
    } catch (err) {
      console.error("Failed to load notices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notices;
    return notices.filter((n) => {
      const t = (n?.title || "").toLowerCase();
      const d = (n?.description || "").toLowerCase();
      return t.includes(q) || d.includes(q);
    });
  }, [search, notices]);

  const truncate = (text, max = 80) =>
    text?.length > max ? `${text.slice(0, max)}…` : text || "N/A";

  /* --- CSV Download --- */
  const onDownloadCsv = () => {
    const headers = ["#", "Title", "Category", "Date", "Description", "PDF"];
    const rows = filtered.map((n, i) => [
      i + 1,
      n.title || "",
      n.category || "",
      formatDate(getNoticeDate(n)),
      n.description || "",
      n.pdf_file || "",
    ]);

    const csv =
      [headers, ...rows]
        .map((r) =>
          r
            .map((cell) => {
              const v = String(cell ?? "");
              if (v.includes(",") || v.includes('"') || v.includes("\n")) {
                return `"${v.replace(/"/g, '""')}"`;
              }
              return v;
            })
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notices_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-base-100 text-base-content text-lg">
      {/* Header */}
      <div className="sticky top-0 z-10 mb-4 bg-base-100/80 backdrop-blur border border-base-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
        <div>
          <h2 className="text-3xl font-bold text-primary">📢 Notices</h2>
          <p className="text-base opacity-70">
            View latest school/college notices here
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search notices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-bordered w-full md:w-72 text-base"
          />
          <button
            onClick={onDownloadCsv}
            disabled={!filtered.length}
            className="btn btn-outline text-base"
          >
            Download
          </button>
          <button
            onClick={onPrint}
            disabled={!filtered.length}
            className="btn btn-outline text-base"
          >
            Print
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-base-300 rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-10 text-center opacity-70 text-xl">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-xl font-semibold">No notices found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table text-lg">
              <thead className="bg-primary text-primary-content">
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => {
                  const dStr = getNoticeDate(n);
                  return (
                    <tr
                      key={n.id ?? i}
                      className="hover:bg-base-200 transition-colors"
                    >
                      <td>{i + 1}</td>
                      <td className="font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{n.title}</span>
                          {isNew(dStr) && (
                            <span className="badge badge-success">NEW</span>
                          )}
                        </div>
                      </td>
                      <td>{n.category || "—"}</td>
                      <td>{formatDate(dStr)}</td>
                      <td>{truncate(n.description)}</td>
                      <td className="text-center">
                        {n.pdf_file ? (
                          <a
                            href={n.pdf_file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link link-primary"
                          >
                            View
                          </a>
                        ) : (
                          <span className="opacity-50">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="text-right p-3 opacity-70 text-base">
                    Total: {filtered.length} notices
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
