// src/pages/Admin/StudentInfo.jsx
import { useEffect, useMemo, useState } from "react";
import axiosInstance from "../../../components/AxiosInstance" // <-- fixed path
import Select from "react-select";
import { Toaster, toast } from "react-hot-toast";

const required = (v) => v !== null && v !== undefined && String(v).trim() !== "";

// keep react-select menus above sticky table/header/overflows
const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

function AvatarCircle({ name, src, size = 36 }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name || "avatar"}
        className="rounded-full object-cover border"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = String(name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-full bg-slate-200 grid place-items-center text-xs text-slate-600 border"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

function slugifyName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

// absolute URL helper for media paths
const absUrl = (url) => {
  if (!url) return null;
  const isAbs = /^https?:\/\//i.test(url);
  const base = (axiosInstance.defaults?.baseURL || "").replace(/\/+$/, "");
  return isAbs ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function StudentInfo() {
  // data
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]); // [{id,name,year,sections:[{id,name}]}]
  const [classToSections, setClassToSections] = useState({});
  const [sectionsDict, setSectionsDict] = useState({});

  // ui
  const [loading, setLoading] = useState(true);
  const [tableBusy, setTableBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState(null);
  const [filterClassId, setFilterClassId] = useState(null);
  const [filterSectionId, setFilterSectionId] = useState(null);

  // form
  const [form, setForm] = useState({
    full_name: "",
    roll_number: "",
    class_name: null,
    section: null,
    date_of_birth: "",
    address: "",
    guardian_name: "",
    guardian_phone: "",
    contact_email: "",
    contact_phone: "",
    photo: null,
    user: null,
  });
  const [preview, setPreview] = useState(null);
  const [touched, setTouched] = useState({});

  // user form
  const [createLogin, setCreateLogin] = useState(false);
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    is_active: true,
    must_change_password: true,
  });
  const [userEditedUsername, setUserEditedUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameNote, setUsernameNote] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // ---- helpers for classes/years ----
  const years = useMemo(() => {
    const set = new Set();
    classes.forEach((c) => c.year && set.add(Number(c.year)));
    return Array.from(set).sort((a, b) => b - a);
  }, [classes]);

  const yearOptions = useMemo(
    () => years.map((y) => ({ value: y, label: String(y) })),
    [years]
  );

  const classesById = useMemo(() => {
    const m = {};
    classes.forEach((c) => (m[c.id] = { name: c.name, year: c.year }));
    return m;
  }, [classes]);

  const classOptions = useMemo(() => {
    const list = filterYear
      ? classes.filter((c) => Number(c.year) === Number(filterYear))
      : classes;
    return list.map((c) => ({ value: c.id, label: c.name }));
  }, [classes, filterYear]);

  const filterSectionOptions = useMemo(() => {
    if (!filterClassId) return [];
    const secs = classToSections[Number(filterClassId)] || [];
    return secs.map((s) => ({ value: s.id, label: s.name }));
  }, [filterClassId, classToSections]);

  const sectionOptionsForForm = useMemo(() => {
    if (!form.class_name) return [];
    const secs = classToSections[Number(form.class_name)] || [];
    return secs.map((s) => ({ value: s.id, label: s.name }));
  }, [form.class_name, classToSections]);

  const sectionNameById = useMemo(() => {
    const m = {};
    Object.values(classToSections).forEach((arr) =>
      arr.forEach((s) => (m[s.id] = s.name))
    );
    for (const [id, name] of Object.entries(sectionsDict)) {
      if (!m[id]) m[id] = name;
    }
    return m;
  }, [classToSections, sectionsDict]);

  // initial load
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Use existing endpoints from the rest of the app:
        // - students/
        // - class-names/ (includes embedded sections)
        const [studentsRes, classesRes] = await Promise.all([
          axiosInstance.get("students/"),
          axiosInstance.get("class-names/"), // <-- was "classes/"
        ]);

        // normalize students + absolute photo
        const studentsList = (Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data?.results || [])
          .map((s) => ({ ...s, photo: absUrl(s.photo) }));

        const clsRaw = Array.isArray(classesRes.data)
          ? classesRes.data
          : classesRes.data?.results || [];

        // if sections are objects -> use directly; if ids -> name via /sections/
        let sectionsMap = {};
        const anyIds =
          clsRaw.some(
            (c) =>
              Array.isArray(c.sections) &&
              c.sections.length &&
              typeof c.sections[0] !== "object"
          ) && clsRaw.length;

        if (anyIds) {
          try {
            const secRes = await axiosInstance.get("sections/");
            const arr = Array.isArray(secRes.data) ? secRes.data : secRes.data?.results || [];
            sectionsMap = Object.fromEntries(arr.map((s) => [String(s.id), s.name]));
          } catch {
            // ignore
          }
        }

        const map = {};
        clsRaw.forEach((c) => {
          const secs =
            Array.isArray(c.sections) && c.sections.length
              ? (typeof c.sections[0] === "object"
                  ? c.sections.map((s) => ({ id: s.id, name: s.name }))
                  : c.sections.map((id) => ({ id, name: sectionsMap[String(id)] || `#${id}` }))
                )
              : Array.isArray(c.sections_detail)
              ? c.sections_detail.map((s) => ({ id: s.id, name: s.name }))
              : [];
          map[c.id] = secs;
        });

        setSectionsDict(sectionsMap);
        setClasses(clsRaw);
        setClassToSections(map);
        setStudents(studentsList);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // derived list for table (year → class → section)
  const filtered = useMemo(() => {
    let out = Array.isArray(students) ? [...students] : [];

    if (searchTerm.trim()) {
      const needle = searchTerm.trim().toLowerCase();
      out = out.filter((s) => String(s.full_name || "").toLowerCase().includes(needle));
    }

    if (filterYear) {
      out = out.filter(
        (s) => Number(classesById[s.class_name]?.year) === Number(filterYear)
      );
    }
    if (filterClassId) out = out.filter((s) => Number(s.class_name) === Number(filterClassId));
    if (filterSectionId) out = out.filter((s) => Number(s.section) === Number(filterSectionId));

    return out;
  }, [students, searchTerm, filterYear, filterClassId, filterSectionId, classesById]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
    // eslint-disable-next-line
  }, [filtered, page]);

  // helpers
  const refreshStudents = async () => {
    setTableBusy(true);
    try {
      const res = await axiosInstance.get("students/");
      const list = (Array.isArray(res.data) ? res.data : res.data?.results || []).map((s) => ({
        ...s,
        photo: absUrl(s.photo),
      }));
      setStudents(list);
    } catch {
      toast.error("Refresh failed.");
    } finally {
      setTableBusy(false);
    }
  };

  const resetUsernameState = () => {
    setUserEditedUsername(false);
    setUsernameAvailable(null);
    setCheckingUsername(false);
    setUsernameNote("");
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      full_name: "",
      roll_number: "",
      class_name: null,
      section: null,
      date_of_birth: "",
      address: "",
      guardian_name: "",
      guardian_phone: "",
      contact_email: "",
      contact_phone: "",
      photo: null,
      user: null,
    });
    setUserForm({
      username: "",
      email: "",
      phone: "",
      password: "",
      is_active: true,
      must_change_password: true,
    });
    resetUsernameState();
    setCreateLogin(false);
    setPreview(null);
    setTouched({});
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      full_name: s.full_name || "",
      roll_number: s.roll_number || "",
      class_name: s.class_name != null ? Number(s.class_name) : null,
      section: s.section != null ? Number(s.section) : null,
      date_of_birth: s.date_of_birth || "",
      address: s.address || "",
      guardian_name: s.guardian_name || "",
      guardian_phone: s.guardian_phone || "",
      contact_email: s.contact_email || "",
      contact_phone: s.contact_phone || "",
      photo: null,
      user: s.user || null,
    });
    setPreview(absUrl(s.photo) || null);
    setCreateLogin(Boolean(s.user));
    setUserForm({
      username: (s.username || s.full_name || "").toLowerCase().replace(/\s+/g, ""),
      email: s.contact_email || "",
      phone: s.contact_phone || "",
      password: "",
      is_active: true,
      must_change_password: true,
    });
    resetUsernameState();
    setTouched({});
    setModalOpen(true);
  };

  const onChangeField = (e) => {
    const { name, value, type, files } = e.target;
    if (type === "file") {
      const file = files?.[0];
      if (file && file.size > 2 * 1024 * 1024) {
        toast.error("Photo must be 2MB or smaller.");
        return;
      }
      setForm((f) => ({ ...f, photo: file || null }));
      setPreview(file ? URL.createObjectURL(file) : null);
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };
  const onBlur = (key) => setTouched((t) => ({ ...t, [key]: true }));

  useEffect(() => {
    if (!createLogin) return;
    if (userEditedUsername) return;
    if (!form.full_name) {
      setUserForm((u) => ({ ...u, username: "" }));
      setUsernameAvailable(null);
      setUsernameNote("");
      return;
    }
    const suggestion = slugifyName(form.full_name);
    setUserForm((u) => (u.username === suggestion ? u : { ...u, username: suggestion }));
  }, [form.full_name, createLogin, userEditedUsername]);

  useEffect(() => {
    if (!createLogin) return;
    const uname = userForm.username?.trim();
    if (!uname) {
      setUsernameAvailable(null);
      setUsernameNote("");
      return;
    }
    let cancelled = false;
    setCheckingUsername(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await axiosInstance.get("users/check-username/", {
          params: { username: uname },
        });
        if (cancelled) return;
        const available = !!data?.available;
        setUsernameAvailable(available);
        if (!available) {
          const serverSug =
            (data?.suggestion && String(data.suggestion)) ||
            (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions[0]);
          if (!userEditedUsername) {
            setUserForm((u) => ({ ...u, username: serverSug || `${uname}${Math.floor(100 + Math.random() * 900)}` }));
            setUsernameNote("That username was taken. Suggested a free one.");
          } else {
            setUsernameNote("Username is taken. Please pick another.");
          }
        } else {
          setUsernameNote("");
        }
      } catch {
        setUsernameAvailable(null);
        setUsernameNote("");
      } finally {
        if (!cancelled) setCheckingUsername(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [userForm.username, createLogin, userEditedUsername]);

  const onDelete = async (id) => {
    if (!window.confirm("Delete this student?")) return;
    try {
      await axiosInstance.delete(`students/${id}/`);
      toast.success("Student deleted.");
      await refreshStudents();
    } catch {
      toast.error("Delete failed.");
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (
      !required(form.full_name) ||
      !required(form.roll_number) ||
      form.class_name === null ||
      form.section === null
    ) {
      setTouched((t) => ({
        ...t,
        full_name: true,
        roll_number: true,
        class_name: true,
        section: true,
      }));
      toast.error("Please fill Name, Roll, Class and Section.");
      setSubmitting(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append("full_name", form.full_name);
      fd.append("roll_number", String(form.roll_number));
      fd.append("class_name", String(Number(form.class_name)));
      fd.append("section", String(Number(form.section)));
      if (form.date_of_birth) fd.append("date_of_birth", form.date_of_birth);
      if (form.address) fd.append("address", form.address);
      if (form.guardian_name) fd.append("guardian_name", form.guardian_name);
      if (form.guardian_phone) fd.append("guardian_phone", form.guardian_phone);
      if (form.contact_email) fd.append("contact_email", form.contact_email);
      if (form.contact_phone) fd.append("contact_phone", form.contact_phone);
      if (form.photo) fd.append("photo", form.photo);

      let savedStudentId = editingId;
      let savedUserId = form.user;

      if (editingId) {
        await axiosInstance.put(`students/${editingId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        const res = await axiosInstance.post("students/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        savedStudentId = res?.data?.id;
        savedUserId = res?.data?.user || null;
      }

      if (createLogin) {
        if (!required(userForm.username)) {
          toast.error("Username is required for login.");
          setSubmitting(false);
          return;
        }
        if (savedUserId) {
          const patchPayload = {
            username: userForm.username,
            email: userForm.email,
            phone: userForm.phone,
            is_active: userForm.is_active,
            must_change_password: userForm.must_change_password,
          };
          if (userForm.password) patchPayload.password = userForm.password;
          await axiosInstance.patch(`admin/users/${savedUserId}/`, patchPayload);
        } else {
          const payload = {
            username: userForm.username,
            email: userForm.email,
            phone: userForm.phone,
            role: "Student",
            is_active: userForm.is_active,
            must_change_password: userForm.must_change_password,
          };
          if (userForm.password) payload.password = userForm.password;
          const ures = await axiosInstance.post("admin/users/", payload);
          const newUserId = ures?.data?.id;
          await axiosInstance.post(`students/${savedStudentId}/link-user/`, { user_id: newUserId });
        }
      }

      toast.success(editingId ? "Student updated." : "Student created.");
      await refreshStudents();
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      const detail =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "object" ? JSON.stringify(err.response.data) : "Save failed.");
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-slate-500">Manage student records. Class &amp; Section are required.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + Add Student
          </button>
          <button
            onClick={refreshStudents}
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border text-sm hover:bg-slate-50"
            disabled={tableBusy}
            title="Refresh list"
          >
            {tableBusy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-2xl p-3 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Search by name</label>
          <input
            className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
            placeholder="Type a name…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
          <Select
            options={yearOptions}
            isClearable
            placeholder="All years"
            value={yearOptions.find((o) => Number(o.value) === Number(filterYear)) || null}
            onChange={(opt) => {
              const y = opt ? Number(opt.value) : null;
              setFilterYear(y);
              setFilterClassId(null);
              setFilterSectionId(null);
              setPage(1);
            }}
            classNamePrefix="rs"
            menuPortalTarget={menuPortalTarget}
            menuPosition="fixed"
            styles={{
              control: (b) => ({ ...b, borderRadius: 12, paddingBlock: 2 }),
              menu: (b) => ({ ...b, borderRadius: 12 }),
              menuPortal: (b) => ({ ...b, zIndex: 9999 }),
            }}
          />
        </div>

        {/* Class */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
          <Select
            options={classOptions}
            isClearable
            placeholder={filterYear ? "All classes (year)" : "All classes"}
            value={classOptions.find((o) => Number(o.value) === Number(filterClassId)) || null}
            onChange={(opt) => {
              const cid = opt ? Number(opt.value) : null;
              setFilterClassId(cid);
              setFilterSectionId(null);
              setPage(1);
            }}
            classNamePrefix="rs"
            menuPortalTarget={menuPortalTarget}
            menuPosition="fixed"
            styles={{
              control: (b) => ({ ...b, borderRadius: 12, paddingBlock: 2 }),
              menu: (b) => ({ ...b, borderRadius: 12 }),
              menuPortal: (b) => ({ ...b, zIndex: 9999 }),
            }}
          />
        </div>

        {/* Section */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
          <Select
            options={filterSectionOptions}
            isClearable
            placeholder={filterClassId ? "All sections" : "Pick class first"}
            isDisabled={!filterClassId}
            value={filterSectionOptions.find((o) => Number(o.value) === Number(filterSectionId)) || null}
            onChange={(opt) => {
              setFilterSectionId(opt ? Number(opt.value) : null);
              setPage(1);
            }}
            classNamePrefix="rs"
            menuPortalTarget={menuPortalTarget}
            menuPosition="fixed"
            styles={{
              control: (b) => ({ ...b, borderRadius: 12, paddingBlock: 2 }),
              menu: (b) => ({ ...b, borderRadius: 12 }),
              menuPortal: (b) => ({ ...b, zIndex: 9999 }),
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="relative max-h-[70vh] overflow-auto rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-100">
            <tr className="text-slate-700">
              <th className="py-3 px-4 text-left font-semibold">#</th>
              <th className="py-3 px-4 text-left font-semibold">Name</th>
              <th className="py-3 px-4 text-left font-semibold">Roll</th>
              <th className="py-3 px-4 text-left font-semibold">Class</th>
              <th className="py-3 px-4 text-left font-semibold">Section</th>
              <th className="py-3 px-4 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-slate-50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="p-3"><div className="h-3 w-6 bg-slate-200 rounded" /></td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-200" />
                      <div className="h-3 w-32 bg-slate-200 rounded" />
                    </div>
                  </td>
                  <td className="p-3"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                  <td className="p-3"><div className="h-5 w-20 bg-slate-200 rounded" /></td>
                  <td className="p-3"><div className="h-5 w-20 bg-slate-200 rounded" /></td>
                  <td className="p-3"><div className="h-8 w-28 bg-slate-200 rounded" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  No students found. Click <span className="font-medium">“Add Student”</span> to create one.
                </td>
              </tr>
            ) : (
              pageRows.map((s, i) => (
                <tr key={s.id} className="border-t last:border-b-0">
                  <td className="py-3 px-4">{(page - 1) * pageSize + i + 1}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <AvatarCircle name={s.full_name} src={s.photo} />
                      <span className="font-medium">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">{s.roll_number ?? "-"}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium">
                      {s.class_name_label || classesById[s.class_name]?.name || "-"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium">
                      {s.section_label || sectionNameById[s.section] || "-"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex justify-center mt-6 gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 border rounded-lg ${page === p ? "bg-blue-600 text-white" : ""}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-3 right-3 p-2 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="p-6 overflow-y-auto">
              <h2 className="text-xl font-bold text-center mb-4">
                {editingId ? "Edit Student" : "Add Student"}
              </h2>

              <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Full name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="full_name"
                    value={form.full_name}
                    onChange={onChangeField}
                    onBlur={() => onBlur("full_name")}
                    className={`w-full border p-2 rounded-lg focus:ring-2 ${
                      touched.full_name && !required(form.full_name)
                        ? "border-red-500 focus:ring-red-200"
                        : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                    }`}
                    placeholder="e.g., Afsana Rahman"
                  />
                  {touched.full_name && !required(form.full_name) && (
                    <p className="text-xs text-red-600 mt-1">Name is required.</p>
                  )}
                </div>

                {/* Roll */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Roll Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="roll_number"
                    value={form.roll_number}
                    onChange={onChangeField}
                    onBlur={() => onBlur("roll_number")}
                    className={`w-full border p-2 rounded-lg focus:ring-2 ${
                      touched.roll_number && !required(form.roll_number)
                        ? "border-red-500 focus:ring-red-200"
                        : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                    }`}
                    placeholder="e.g., 23"
                  />
                  {touched.roll_number && !required(form.roll_number) && (
                    <p className="text-xs text-red-600 mt-1">Roll number is required.</p>
                  )}
                </div>

                {/* Class */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Class <span className="text-red-600">*</span>
                  </label>
                  <Select
                    options={classOptions}
                    value={classOptions.find((o) => Number(o.value) === Number(form.class_name)) || null}
                    onChange={(opt) => {
                      setForm((f) => ({
                        ...f,
                        class_name: opt ? Number(opt.value) : null,
                        section: null,
                      }));
                      setTouched((t) => ({ ...t, class_name: true, section: false }));
                    }}
                    onBlur={() => onBlur("class_name")}
                    placeholder="Select class"
                    classNamePrefix="rs"
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 12,
                        paddingBlock: 2,
                        borderColor:
                          touched.class_name && form.class_name === null ? "#ef4444" : base.borderColor,
                        boxShadow: "none",
                        "&:hover": { borderColor: "#60a5fa" },
                      }),
                      menu: (b) => ({ ...b, borderRadius: 12 }),
                      menuPortal: (b) => ({ ...b, zIndex: 9999 }),
                    }}
                  />
                  {touched.class_name && form.class_name === null && (
                    <p className="text-xs text-red-600 mt-1">Class is required.</p>
                  )}
                </div>

                {/* Section */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Section <span className="text-red-600">*</span>
                  </label>
                  <Select
                    options={sectionOptionsForForm}
                    value={
                      sectionOptionsForForm.find((o) => Number(o.value) === Number(form.section)) || null
                    }
                    onChange={(opt) => {
                      setForm((f) => ({ ...f, section: opt ? Number(opt.value) : null }));
                      setTouched((t) => ({ ...t, section: true }));
                    }}
                    onBlur={() => onBlur("section")}
                    placeholder={form.class_name ? "Select section" : "Pick class first"}
                    isDisabled={!form.class_name}
                    isClearable={false}
                    classNamePrefix="rs"
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: 12,
                        paddingBlock: 2,
                        borderColor:
                          touched.section && form.section === null ? "#ef4444" : base.borderColor,
                        boxShadow: "none",
                        "&:hover": { borderColor: "#60a5fa" },
                      }),
                      menu: (b) => ({ ...b, borderRadius: 12 }),
                      menuPortal: (b) => ({ ...b, zIndex: 9999 }),
                    }}
                  />
                  {touched.section && form.section === null && (
                    <p className="text-xs text-red-600 mt-1">Section is required.</p>
                  )}
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={form.date_of_birth}
                    onChange={onChangeField}
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                  />
                </div>

                {/* Guardian / Contacts */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Guardian Name</label>
                  <input
                    name="guardian_name"
                    value={form.guardian_name}
                    onChange={onChangeField}
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="e.g., Md. Karim"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Guardian Phone</label>
                  <input
                    name="guardian_phone"
                    value={form.guardian_phone}
                    onChange={onChangeField}
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    name="contact_email"
                    value={form.contact_email}
                    onChange={onChangeField}
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input
                    name="contact_phone"
                    value={form.contact_phone}
                    onChange={onChangeField}
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={onChangeField}
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    rows={3}
                    placeholder="Street, City, District"
                  />
                </div>

                {/* Photo */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Photo</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      name="photo"
                      accept="image/*"
                      onChange={onChangeField}
                      className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    />
                    {preview && (
                      <div className="flex items-center gap-3">
                        <img src={preview} alt="Preview" className="h-16 w-16 rounded-lg object-cover border" />
                        <button
                          type="button"
                          onClick={() => {
                            setPreview(null);
                            setForm((f) => ({ ...f, photo: null }));
                          }}
                          className="px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="md:col-span-2 h-px bg-slate-200 my-2" />

                {/* USER REGISTRATION */}
                <label className="md:col-span-2 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createLogin}
                    onChange={(e) => setCreateLogin(e.target.checked)}
                  />
                  <span className="text-sm font-medium">Create / update login for this student</span>
                </label>

                {createLogin && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Username <span className="text-red-600">*</span>
                      </label>
                      <input
                        value={userForm.username}
                        onChange={(e) => {
                          setUserForm((u) => ({ ...u, username: e.target.value }));
                          setUserEditedUsername(true);
                        }}
                        onBlur={() => setUserEditedUsername(true)}
                        className="w-full border p-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        placeholder="username"
                        required
                      />
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        {checkingUsername && <span className="text-slate-500">Checking…</span>}
                        {usernameAvailable === true && !checkingUsername && (
                          <span className="text-green-600">✅ Available</span>
                        )}
                        {usernameAvailable === false && !checkingUsername && (
                          <span className="text-red-600">❌ Taken</span>
                        )}
                        {usernameNote && <span className="text-slate-600">• {usernameNote}</span>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm((u) => ({ ...u, email: e.target.value }))}
                        className="w-full border p-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        placeholder="name@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                      <input
                        value={userForm.phone}
                        onChange={(e) => setUserForm((u) => ({ ...u, phone: e.target.value }))}
                        className="w-full border p-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        placeholder="01XXXXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {form.user ? "New Password (optional)" : "Password (optional)"}
                      </label>
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm((u) => ({ ...u, password: e.target.value }))}
                        className="w-full border p-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="flex items-center gap-4 md:col-span-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={userForm.is_active}
                          onChange={(e) => setUserForm((u) => ({ ...u, is_active: e.target.checked }))}
                        />
                        <span className="text-sm">Active</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={userForm.must_change_password}
                          onChange={(e) =>
                            setUserForm((u) => ({ ...u, must_change_password: e.target.checked }))
                          }
                        />
                        <span className="text-sm">Must change password on first login</span>
                      </label>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
                >
                  {submitting ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
