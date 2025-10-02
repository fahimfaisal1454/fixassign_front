// src/pages/Teachers/Notices.jsx
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileText, Search } from "lucide-react";
import { toast } from "react-hot-toast";
import AxiosInstance from "../../components/AxiosInstance";

const RESULTS_PER_PAGE = 6;

const formatDate = (str) => {
  if (!str) return "N/A";
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
};

const getNoticeDate = (n) => n?.date || n?.created_at || n?.updated_at || null;

const isNewWithinDays = (str, days = 7) => {
  if (!str) return false;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  return Date.now() - d.getTime() <= ms;
};

export default function TeacherNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Fetch ONLY teacher notices. If your backend auto-filters by role,
  // this explicit category param is still fine and future-proof.
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await AxiosInstance.get("notices/", {
          params: { category: "teacher" },
        });
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.results || [];

        const normalized = raw
          .map((n) => {
            const dStr = getNoticeDate(n);
            const dt = dStr ? new Date(dStr) : null;
            return {
              id: n.id,
              title: n.title || "No title",
              description: n.description || "",
              pdf: n.pdf_file || "",
              dateStr: dStr,
              dateLabel: formatDate(dStr),
              rawTime: dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : 0,
              // keep the original category intact in case backend returns others
              category: n.category || "teacher",
            };
          })
          .sort((a, b) => b.rawTime - a.rawTime);

        setNotices(normalized);
      } catch (e) {
        console.error("Failed to load teacher notices:", e?.response?.data || e);
        toast.error("Failed to load notices");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Client-side search on title+description
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notices;
    return notices.filter((n) =>
      (n.title + " " + n.description).toLowerCase().includes(q)
    );
  }, [search, notices]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / RESULTS_PER_PAGE));
  const start = (page - 1) * RESULTS_PER_PAGE;
  const current = filtered.slice(start, start + RESULTS_PER_PAGE);

  // Reset to page 1 when search changes
  useEffect(() => setPage(1), [search]);

  return (
    <div className="py-6">
      <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-purple-600 px-6 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white text-center">
            Teacher Notices
          </h1>
          <p className="text-white/80 text-center mt-1">
            Only notices categorized as <b>Teacher</b> are shown here.
          </p>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4">
          <div className="relative w-full md:w-1/2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search notices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 
                         bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 
                         placeholder-slate-400 dark:placeholder-slate-500 
                         focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-2 pb-6">
          {loading ? (
            <SkeletonList />
          ) : current.length ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 px-4">
              {current.map((n) => (
                <li
                  key={n.id}
                  className="group rounded-xl border border-slate-200 dark:border-slate-700 
                             bg-white dark:bg-slate-800/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center text-slate-600 dark:text-slate-300 text-sm">
                        <CalendarDays className="w-4 h-4 mr-2" />
                        <span>{n.dateLabel}</span>
                      </div>

                      {/* Category chip (Teacher) */}
                      <span
                        className="text-xs px-2.5 py-1 rounded-full
                                   bg-purple-50 text-purple-700 ring-1 ring-purple-200
                                   dark:bg-purple-900/30 dark:text-purple-300"
                      >
                        Teacher
                      </span>
                    </div>

                    <h3 className="mt-2.5 text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                      {n.title}
                    </h3>

                    {n.description ? (
                      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                        {n.description}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 italic flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        No description attached
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>Last updated:</span>
                        <span className="font-medium">{n.dateLabel}</span>
                        {isNewWithinDays(n.dateStr) && (
                          <span className="badge badge-success badge-sm">NEW</span>
                        )}
                      </div>

                      {n.pdf ? (
                        <a
                          href={n.pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-3 py-2 
                                     text-white text-sm font-medium hover:bg-purple-800 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          No file attached
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-3 py-1.5 rounded-lg border text-sm ${
                  page === 1
                    ? "text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                    : "text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                Prev
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const p = idx + 1;
                const active = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${
                      active
                        ? "bg-purple-700 text-white border-purple-700"
                        : "text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-3 py-1.5 rounded-lg border text-sm ${
                  page === totalPages
                    ? "text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                    : "text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 px-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 shadow-sm p-4 md:p-5"
        >
          <div className="animate-pulse space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>
            <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-10 flex flex-col items-center justify-center text-center">
      <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <FileText className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        No teacher notices
      </h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
        When an admin posts a notice with the <b>Teacher</b> category, it will appear here.
      </p>
    </div>
  );
}
