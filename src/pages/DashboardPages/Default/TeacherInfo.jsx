// src/pages/DashboardPages/academics/TeacherInfo.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import { toast, Toaster } from "react-hot-toast";
import AxiosInstance from "../../../components/AxiosInstance";

/* ------------------------------ Defaults ------------------------------ */

const emptyTeacher = {
  full_name: "",
  designation: "",
  contact_email: "",
  contact_phone: "",
  subject: "", // stores subject ID (number or "")
  profile: "",
  photo: null,
};

/* ---------------- Username helpers (FIRST NAME + 3 DIGITS) -------------- */

// Always build the base from the **first name**
const firstNameBase = (fullName = "") => {
  const cleaned = fullName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" ").filter(Boolean);
  const first = parts[0] || "user";
  const base = first.replace(/[^a-z0-9]/g, "");
  return base.length ? base : "user";
};

// 3-digit suffix (100–999)
const rand3 = () => Math.floor(100 + Math.random() * 900);

// Suggestion: firstName + 3 digits (e.g., karim345)
const suggestUsername = (fullName = "") => `${firstNameBase(fullName)}${rand3()}`;

/* -------------------------------- Component ------------------------------- */

export default function TeacherInfo() {
  const navigate = useNavigate();

  // Abort for username check; timers for debounced checks
  const usernameAbortRef = useRef(null);
  const emailTimerRef = useRef(null);
  const phoneTimerRef = useRef(null);
  // Sequence guards to ignore stale async validation responses
  const emailCheckSeq = useRef(0);
  const phoneCheckSeq = useRef(0);

  // UI
  const [loading, setLoading] = useState(false);
  const [tableBusy, setTableBusy] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [subjects, setSubjects] = useState([]); // [{id, name, class_name, class_name_label, ...}]
  const [rawTeachers, setRawTeachers] = useState([]); // keep raw; normalize in memo

  // Filters
  const [search, setSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState(null);

  // Subject options mode
  const [showSubjectsByClass, setShowSubjectsByClass] = useState(false);

  // Teacher Form
  const [form, setForm] = useState(emptyTeacher);

  // Inline create user (like StudentInfo)
  const [createLogin, setCreateLogin] = useState(false);
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    must_change_password: true,
    is_active: true,
  });

  // Username check state
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle | checking | available
  const [usernameHint, setUsernameHint] = useState("");

  // Email/Phone availability UI state
  const [emailState, setEmailState] = useState({ status: "idle", message: "" }); // idle|checking|ok|taken
  const [phoneState, setPhoneState] = useState({ status: "idle", message: "" }); // idle|checking|ok|taken

  const onUserChange = (k, v) => {
    setUserForm((s) => ({ ...s, [k]: v }));
    if (k === "username") {
      setUsernameStatus("idle");
      setUsernameHint("");
    }
  };

  /* ----------------------------- Fetch Helpers ----------------------------- */

  const loadSubjects = async () => {
    try {
      const res = await AxiosInstance.get("subjects/");
      setSubjects(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load subjects");
      setSubjects([]);
    }
  };

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const res = await AxiosInstance.get("teachers/");
      setRawTeachers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load teachers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadSubjects();
      await loadTeachers();
    })();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    };
  }, []);

  /* ----------------------------- Normalization ----------------------------- */

  const subjectName = (s) => (s?.name || s?.title || `Subject #${s?.id}`).trim();

  // Deduped options (one label per subject name, first ID wins)
  const subjectOptionsDeduped = useMemo(() => {
    const map = new Map(); // lower(label) -> {value,label}
    for (const s of subjects) {
      const label = subjectName(s);
      const key = label.toLowerCase();
      if (!map.has(key)) map.set(key, { value: s.id, label });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [subjects]);

  // By-class options (“Bangla — Class 5”)
  const subjectOptionsByClass = useMemo(() => {
    return (subjects || [])
      .map((s) => ({
        value: s.id,
        label: `${subjectName(s)}${
          s.class_name_label ? ` — ${s.class_name_label}` : s.class_name ? ` — Class #${s.class_name}` : ""
        }`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [subjects]);

  const subjectOptions = showSubjectsByClass ? subjectOptionsByClass : subjectOptionsDeduped;

  const isLinked = (t) => Boolean(t?.user || t?.user_id || t?.user_username);

  const subjectLabelById = useMemo(() => {
    const m = {};
    for (const s of subjects) m[String(s.id)] = subjectName(s);
    return m;
  }, [subjects]);

  const teachers = useMemo(() => {
    return (rawTeachers || []).map((t) => {
      const subjId = t.subject?.id ?? t.subject ?? null;
      const subjLabel =
        t.subject_name ||
        t.subject?.name ||
        (subjId != null ? subjectLabelById[String(subjId)] : null) ||
        (typeof t.subject === "string" ? t.subject : "-");

      return {
        id: t.id,
        full_name: t.full_name || "-",
        designation: String(t.designation || ""),
        subject_id: subjId,
        subject_label: subjLabel,
        contact_email: t.contact_email || "-",
        contact_phone: t.contact_phone || "-",
        profile: t.profile || "",
        photo: t.photo || null,
        user: t.user ?? null,
        user_id: t.user_id ?? null,
        user_username: t.user_username ?? null,
      };
    });
  }, [rawTeachers, subjectLabelById]);

  const designationOptions = useMemo(() => {
    const set = new Set(teachers.map((t) => (t.designation ? t.designation : "Teacher")));
    return Array.from(set)
      .map((d) => ({ value: d, label: d }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    let data = [...teachers];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (t) =>
          (t.full_name || "").toLowerCase().includes(q) ||
          (t.subject_label || "").toLowerCase().includes(q) ||
          (t.contact_email || "").toLowerCase().includes(q) ||
          (t.designation || "").toLowerCase().includes(q) ||
          (t.contact_phone || "").toLowerCase().includes(q)
      );
    }
    if (designationFilter?.value) {
      data = data.filter((t) => (t.designation || "") === designationFilter.value);
    }
    return data;
  }, [teachers, search, designationFilter]);

  /* ------------------------- Username availability ------------------------- */

  // Checks if a username already exists on server.
  // Supports:
  //  - GET admin/users/exists/?username=<u> -> {exists: boolean}
  //  - GET admin/users/?username=<u>       -> [...]
  //  - GET admin/users/?search=<u>         -> [...]
  const usernameExists = async (u) => {
    if (!u) return false;

    if (usernameAbortRef.current) usernameAbortRef.current.abort();
    const controller = new AbortController();
    usernameAbortRef.current = controller;

    try {
      // 1) Dedicated endpoint
      try {
        const res = await AxiosInstance.get("admin/users/exists/", {
          params: { username: u },
          signal: controller.signal,
        });
        if (typeof res?.data?.exists === "boolean") return !!res.data.exists;
      } catch {
        /* ignore */
      }

      // 2) Exact query
      try {
        const res = await AxiosInstance.get("admin/users/", {
          params: { username: u },
          signal: controller.signal,
        });
        if (Array.isArray(res.data)) {
          return res.data.some((it) => (it?.username || "").toLowerCase() === u.toLowerCase());
        }
      } catch {
        /* ignore */
      }

      // 3) Search fallback
      const res = await AxiosInstance.get("admin/users/", {
        params: { search: u },
        signal: controller.signal,
      });
      if (Array.isArray(res.data)) {
        return res.data.some((it) => (it?.username || "").toLowerCase() === u.toLowerCase());
      }
    } catch {
      return false; // fail-open
    } finally {
      if (usernameAbortRef.current === controller) usernameAbortRef.current = null;
    }
    return false;
  };

  // Always stick to FIRST-NAME base for retries
  const findAvailableUsername = async (preferred) => {
    let attempt = preferred?.trim();
    if (!attempt) attempt = suggestUsername(form.full_name);
    if (!(await usernameExists(attempt))) return attempt;

    const base = firstNameBase(form.full_name);
    for (let i = 0; i < 8; i++) {
      const candidate = `${base}${rand3()}`;
      if (!(await usernameExists(candidate))) return candidate;
    }
    return `${base}${Date.now().toString().slice(-5)}`;
  };

  const checkAndFixUsername = async () => {
    const u = (userForm.username || "").trim();
    if (!u) {
      const generated = await findAvailableUsername("");
      onUserChange("username", generated);
      setUsernameStatus("available");
      setUsernameHint("Suggested a unique username.");
      return;
    }

    setUsernameStatus("checking");
    setUsernameHint("Checking availability…");

    const exists = await usernameExists(u);
    if (!exists) {
      setUsernameStatus("available");
      setUsernameHint("Username is available.");
    } else {
      const next = await findAvailableUsername(u);
      onUserChange("username", next);
      setUsernameStatus("available");
      setUsernameHint(`That username was taken — suggested "${next}".`);
    }
  };

  /* -------- Email / Phone uniqueness (teachers & users) + debounce -------- */

  // Utility to test if value is used by another teacher (excluding currentId when editing).
  // IMPORTANT: Strict comparisons only (no fuzzy search), normalized cases/spaces.
  const valueUsedByAnotherTeacher = async (field, value, excludeId) => {
    if (!value) return false;
    try {
      const params = field === "email" ? { contact_email: value } : { contact_phone: value };
      const res = await AxiosInstance.get("teachers/", { params });
      if (Array.isArray(res.data)) {
        return res.data.some((t) => {
          // When editing, ignore the current record
          if (excludeId && String(t.id) === String(excludeId)) return false;
          return field === "email"
            ? (t.contact_email || "").toLowerCase() === value.toLowerCase()
            : (t.contact_phone || "").trim() === value.trim();
        });
      }
    } catch {
      // No fuzzy fallback here on purpose to avoid false positives
      return false; // fail-open; backend still enforces
    }
    return false;
  };

  // Also check against users (avoid duplicate email/phone in accounts)
  const valueUsedByUser = async (field, value) => {
    if (!value) return false;
    try {
      const params = field === "email" ? { email: value } : { phone: value };
      const res = await AxiosInstance.get("admin/users/", { params });
      if (Array.isArray(res.data)) {
        return res.data.some((u) =>
          field === "email"
            ? (u.email || "").toLowerCase() === value.toLowerCase()
            : (u.phone || "").trim() === value.trim()
        );
      }
    } catch {
      // No search fallback to keep it strict
      return false; // fail-open
    }
    return false;
  };

  // Returns boolean and updates state (sequence guarded)
  const checkEmailUnique = async () => {
    const email = (form.contact_email || "").trim();
    const mySeq = ++emailCheckSeq.current;
    if (!email) {
      if (mySeq === emailCheckSeq.current) {
        setEmailState({ status: "idle", message: "" });
      }
      return true;
    }
    if (mySeq === emailCheckSeq.current) {
      setEmailState({ status: "checking", message: "Checking…" });
    }
    const usedByTeacher = await valueUsedByAnotherTeacher(
      "email",
      email,
      isEditing ? currentId : null
    );
    const usedByUser = await valueUsedByUser("email", email);

    if (mySeq !== emailCheckSeq.current) return true; // stale response

    if (usedByTeacher || usedByUser) {
      setEmailState({ status: "taken", message: "Email is already in use." });
      return false;
    } else {
      setEmailState({ status: "ok", message: "Email is available." });
      return true;
    }
  };

  // Returns boolean and updates state (sequence guarded)
  const checkPhoneUnique = async () => {
    const phone = (form.contact_phone || "").trim();
    const mySeq = ++phoneCheckSeq.current;
    if (!phone) {
      if (mySeq === phoneCheckSeq.current) {
        setPhoneState({ status: "idle", message: "" });
      }
      return true;
    }
    if (mySeq === phoneCheckSeq.current) {
      setPhoneState({ status: "checking", message: "Checking…" });
    }
    const usedByTeacher = await valueUsedByAnotherTeacher(
      "phone",
      phone,
      isEditing ? currentId : null
    );
    const usedByUser = await valueUsedByUser("phone", phone);

    if (mySeq !== phoneCheckSeq.current) return true; // stale response

    if (usedByTeacher || usedByUser) {
      setPhoneState({ status: "taken", message: "Phone number is already in use." });
      return false;
    } else {
      setPhoneState({ status: "ok", message: "Phone number is available." });
      return true;
    }
  };

  // Debounced triggers on change (no immediate "checking" flicker)
  const scheduleEmailCheck = () => {
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    emailTimerRef.current = setTimeout(() => {
      checkEmailUnique();
    }, 400);
  };
  const schedulePhoneCheck = () => {
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    phoneTimerRef.current = setTimeout(() => {
      checkPhoneUnique();
    }, 400);
  };

  /* --------------------------------- CRUD ---------------------------------- */

  const openCreate = () => {
    setForm(emptyTeacher);
    setCurrentId(null);
    setIsEditing(false);
    setIsModalOpen(true);

    setCreateLogin(false);
    setUserForm({
      username: "",
      email: "",
      phone: "",
      password: "",
      must_change_password: true,
      is_active: true,
    });
    setUsernameStatus("idle");
    setUsernameHint("");
    setEmailState({ status: "idle", message: "" });
    setPhoneState({ status: "idle", message: "" });
  };

  const openEdit = (row) => {
    setForm({
      full_name: row.full_name || "",
      designation: row.designation || "",
      contact_email: row.contact_email || "",
      contact_phone: row.contact_phone || "",
      subject: row.subject_id || "",
      profile: row.profile || "",
      photo: null,
    });
    setCurrentId(row.id);
    setIsEditing(true);
    setIsModalOpen(true);

    setCreateLogin(false);
    setUserForm((u) => ({
      ...u,
      username: "",
      email: row.contact_email || "",
      phone: row.contact_phone || "",
    }));
    setUsernameStatus("idle");
    setUsernameHint("");
    setEmailState({ status: "idle", message: "" });
    setPhoneState({ status: "idle", message: "" });
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Delete this teacher?")) return;
    try {
      await AxiosInstance.delete(`teachers/${row.id}/`);
      toast.success("Deleted");
      await loadTeachers();
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.full_name?.trim()) {
      toast.error("Full name is required");
      return;
    }

    // Ensure latest result (don’t rely on possibly stale UI state)
    const [emailOK, phoneOK] = await Promise.all([checkEmailUnique(), checkPhoneUnique()]);
    if (!emailOK || !phoneOK) {
      toast.error("Fix duplicate email/phone before saving.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Create / update teacher
      const fd = new FormData();
      fd.append("full_name", form.full_name.trim());
      if (form.designation) fd.append("designation", form.designation);
      if (form.contact_email) fd.append("contact_email", form.contact_email);
      if (form.contact_phone) fd.append("contact_phone", form.contact_phone);
      if (form.profile) fd.append("profile", form.profile);
      if (form.subject) fd.append("subject", String(form.subject)); // send ID
      if (form.photo) fd.append("photo", form.photo);

      let teacherId = currentId;
      if (isEditing) {
        await AxiosInstance.put(`teachers/${currentId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Updated");
      } else {
        const res = await AxiosInstance.post("teachers/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        teacherId = res?.data?.id ?? teacherId;
        toast.success("Created");
      }

      // 2) Optionally create + link login (Teacher role)
      if (createLogin && teacherId) {
        // ensure username is unique
        const finalUsername = await findAvailableUsername(userForm.username);

        // guard against account-level email/phone duplicates
        const emailTaken = await valueUsedByUser("email", userForm.email || form.contact_email);
        const phoneTaken = await valueUsedByUser("phone", userForm.phone || form.contact_phone);
        if (emailTaken) throw new Error("User email already in use.");
        if (phoneTaken) throw new Error("User phone already in use.");

        const payload = {
          username: finalUsername,
          email: userForm.email || form.contact_email || "",
          phone: userForm.phone || form.contact_phone || "",
          role: "Teacher",
          password: userForm.password || undefined, // server can generate temp
          must_change_password: !!userForm.must_change_password,
          is_active: !!userForm.is_active,
        };

        const uRes = await AxiosInstance.post("admin/users/", payload);
        const newUser = uRes?.data;

        await AxiosInstance.post(`teachers/${teacherId}/link-user/`, {
          user_id: newUser?.id,
        });

        if (newUser?.temp_password) {
          toast.success(
            `Login "${finalUsername}" created & linked. Temp password: ${newUser.temp_password}`
          );
        } else {
          toast.success(`Login "${finalUsername}" created & linked.`);
        }
      }

      setIsModalOpen(false);
      setForm(emptyTeacher);
      await loadTeachers();
    } catch (e2) {
      const msg =
        e2?.response?.data && typeof e2.response.data === "object"
          ? JSON.stringify(e2.response.data)
          : e2?.message || "Save failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------ Create Login (legacy button path kept) ----------------------------- */

  const goCreateLogin = (t) => {
    if (isLinked(t)) {
      toast("Already linked to a login.", { icon: "ℹ️" });
      return;
    }
    navigate("/dashboard/users", { state: { teacherId: t.id } });
  };

  /* ---------------------------------- UI ----------------------------------- */

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-center" />

      {/* Header + filters */}
      <div className="bg-white border rounded-2xl p-3 mb-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 w-72 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Search name / subject / email / phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="w-56">
              <Select
                isClearable
                placeholder="Filter by designation"
                value={designationFilter}
                onChange={setDesignationFilter}
                options={designationOptions}
                classNamePrefix="rs"
                styles={{
                  control: (base) => ({ ...base, borderRadius: 12, paddingBlock: 2 }),
                  menu: (base) => ({ ...base, borderRadius: 12 }),
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700"
            >
              + Add Teacher
            </button>
            <button
              onClick={async () => {
                setTableBusy(true);
                await loadTeachers();
                setTableBusy(false);
              }}
              className="px-3 py-2 rounded-xl border text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={tableBusy}
              title="Refresh"
            >
              {tableBusy ? "Refreshing…" : "Refresh"}
            </button>
            <span className="text-sm text-slate-500">Total: {filteredTeachers.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border rounded-2xl shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr className="text-slate-700">
              <th className="px-3 py-2 text-left font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">Photo</th>
              <th className="px-3 py-2 text-left font-semibold">Name</th>
              <th className="px-3 py-2 text-left font-semibold">Designation</th>
              <th className="px-3 py-2 text-left font-semibold">Subject</th>
              <th className="px-3 py-2 text-left font-semibold">Email</th>
              <th className="px-3 py-2 text-left font-semibold">Phone</th>
              <th className="px-3 py-2 text-left font-semibold">Login</th>
              <th className="px-3 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-slate-50">
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                  Loading…
                </td>
              </tr>
            ) : filteredTeachers.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                  No data
                </td>
              </tr>
            ) : (
              filteredTeachers.map((t, i) => (
                <tr key={t.id} className="border-t hover:bg-slate-50/60">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2">
                    {t.photo ? (
                      <img
                        src={t.photo}
                        alt={t.full_name}
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-200"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-700">
                        {t.full_name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{t.full_name}</td>
                  <td className="px-3 py-2">{t.designation || "-"}</td>
                  <td className="px-3 py-2">{t.subject_label || "-"}</td>
                  <td className="px-3 py-2">{t.contact_email || "-"}</td>
                  <td className="px-3 py-2">{t.contact_phone || "-"}</td>
                  <td className="px-3 py-2">
                    {isLinked(t) ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        linked
                      </span>
                    ) : (
                      <button
                        onClick={() => goCreateLogin(t)}
                        className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Create Login
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="px-3 py-1 rounded bg-slate-600 text-white hover:bg-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700"
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

      {/* Modal (scrollable content) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative max-h-[90vh] flex flex-col border">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 p-2 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="px-6 pt-6 pb-3 border-b">
              <h3 className="text-lg font-semibold">
                {isEditing ? "Edit Teacher" : "Add Teacher"}
              </h3>
            </div>

            {/* Scrollable form body */}
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Full name <span className="text-red-600">*</span>
                  </label>
                  <input
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="Full name"
                    value={form.full_name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, full_name: v }));
                      // prefill username only if empty
                      if (!userForm.username) {
                        onUserChange("username", suggestUsername(v));
                      }
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Designation</label>
                  <input
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="e.g., Lecturer"
                    value={form.designation}
                    onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>

                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-500">
                      {showSubjectsByClass
                        ? "Showing subjects with class labels"
                        : "Showing unique subject names"}
                    </span>
                    <label className="inline-flex items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={showSubjectsByClass}
                        onChange={(e) => setShowSubjectsByClass(e.target.checked)}
                      />
                      Show by class
                    </label>
                  </div>

                  <Select
                    classNamePrefix="rs"
                    placeholder="Select subject"
                    value={
                      subjectOptions.find((o) => String(o.value) === String(form.subject)) || null
                    }
                    onChange={(opt) => setForm((f) => ({ ...f, subject: opt ? opt.value : "" }))}
                    options={subjectOptions}
                    isClearable
                    styles={{
                      control: (base) => ({ ...base, borderRadius: 12, paddingBlock: 2 }),
                      menu: (base) => ({ ...base, borderRadius: 12 }),
                    }}
                  />
                </div>

                {/* Email with live availability */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="Email"
                    value={form.contact_email}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, contact_email: e.target.value }));
                      // Debounced; "Checking…" flips when the check actually runs
                      scheduleEmailCheck();
                    }}
                    onBlur={checkEmailUnique}
                  />
                  {emailState.status !== "idle" && (
                    <p
                      className={
                        "text-[11px] mt-1 " +
                        (emailState.status === "ok"
                          ? "text-emerald-600"
                          : emailState.status === "taken"
                          ? "text-rose-600"
                          : "text-slate-500")
                      }
                    >
                      {emailState.message}
                    </p>
                  )}
                </div>

                {/* Phone with live availability */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="Phone"
                    value={form.contact_phone}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, contact_phone: e.target.value }));
                      // Debounced; "Checking…" flips when the check actually runs
                      schedulePhoneCheck();
                    }}
                    onBlur={checkPhoneUnique}
                  />
                  {phoneState.status !== "idle" && (
                    <p
                      className={
                        "text-[11px] mt-1 " +
                        (phoneState.status === "ok"
                          ? "text-emerald-600"
                          : phoneState.status === "taken"
                          ? "text-rose-600"
                          : "text-slate-500")
                      }
                    >
                      {phoneState.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full border border-slate-300 p-2 rounded-lg"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, photo: e.target.files?.[0] || null }))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Profile</label>
                  <textarea
                    rows={4}
                    className="w-full border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 rounded-lg"
                    placeholder="Short bio / profile"
                    value={form.profile}
                    onChange={(e) => setForm((f) => ({ ...f, profile: e.target.value }))}
                  />
                </div>

                {/* ===== Inline user create (like StudentInfo) ===== */}
                <div className="md:col-span-2 mt-2 border-t pt-3">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold mb-2">
                    <input
                      type="checkbox"
                      checked={createLogin}
                      onChange={(e) => setCreateLogin(e.target.checked)}
                    />
                    Create login for this teacher
                  </label>

                  {createLogin && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Username
                        </label>
                        <div className="flex gap-2">
                          <input
                            className="w-full border border-slate-300 p-2 rounded-lg"
                            placeholder="username"
                            value={userForm.username}
                            onChange={(e) => onUserChange("username", e.target.value)}
                            onBlur={checkAndFixUsername}
                          />
                          <button
                            type="button"
                            onClick={checkAndFixUsername}
                            className="px-3 py-2 rounded-lg border hover:bg-slate-50"
                            title="Check availability"
                          >
                            Check
                          </button>
                        </div>
                        {usernameStatus !== "idle" && (
                          <p
                            className={
                              "text-[11px] mt-1 " +
                              (usernameStatus === "available"
                                ? "text-emerald-600"
                                : "text-slate-500")
                            }
                          >
                            {usernameStatus === "checking" ? "Checking…" : usernameHint}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500">
                          Leave blank to auto-suggest from first name (e.g., karim345).
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          className="w-full border border-slate-300 p-2 rounded-lg"
                          placeholder="teacher@email.com"
                          value={userForm.email || form.contact_email}
                          onChange={(e) => onUserChange("email", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Phone
                        </label>
                        <input
                          className="w-full border border-slate-300 p-2 rounded-lg"
                          placeholder="01XXXXXXXXX"
                          value={userForm.phone || form.contact_phone}
                          onChange={(e) => onUserChange("phone", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Password (optional)
                        </label>
                        <input
                          type="text"
                          className="w-full border border-slate-300 p-2 rounded-lg"
                          placeholder="Leave empty to auto-generate"
                          value={userForm.password}
                          onChange={(e) => onUserChange("password", e.target.value)}
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          If empty, a temporary password will be generated.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={userForm.must_change_password}
                            onChange={(e) => onUserChange("must_change_password", e.target.checked)}
                          />
                          Must change password on first login
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={userForm.is_active}
                            onChange={(e) => onUserChange("is_active", e.target.checked)}
                          />
                          Active
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    emailState.status === "taken" ||
                    phoneState.status === "taken" ||
                    emailState.status === "checking" ||
                    phoneState.status === "checking"
                  }
                  className="w-full mt-2 bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2 disabled:opacity-50"
                  title={
                    emailState.status === "taken" || phoneState.status === "taken"
                      ? "Resolve duplicate email/phone"
                      : ""
                  }
                >
                  {submitting ? "Saving..." : isEditing ? "Update" : "Save"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
