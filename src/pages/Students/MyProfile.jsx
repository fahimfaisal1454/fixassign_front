// src/pages/Students/MyProfile.jsx
import { useEffect, useState, useMemo } from "react";
import Axios from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function MyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // merged view of auth user + student record
  const [me, setMe] = useState(null);

  // editable fields (email/phone/photo like teacher)
  const [form, setForm] = useState({ email: "", phone: "" });
  const [avatarFile, setAvatarFile] = useState(null);

  // change password
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm_password: "" });

  // --- helpers --------------------------------------------------------------
  const onChange = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const mediaUrl = useMemo(() => {
    const raw = me?.profile_picture || "";
    if (!raw) return "/default-avatar.png";
    // prefix relative paths with API base
    const isAbsolute = /^https?:\/\//i.test(raw);
    const base = Axios.defaults?.baseURL?.replace(/\/+$/, "") || "";
    const full = isAbsolute ? raw : `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
    return full;
  }, [me?.profile_picture]);

  // --- load profile (same pattern as teachers) -----------------------------
  useEffect(() => {
    (async () => {
      try {
        // 1) always get auth user (email/phone/photo live here)
        const u = await Axios.get("user/");
        const user = u.data || {};

        // 2) try to get academic record for the logged-in student
        //    (won’t throw if 404/permission denied)
        let student = {};
        try {
          const s = await Axios.get("people/students/me/");
          student = s.data || {};
        } catch (e) {
          // okay if missing; we still render user info
          if (e?.response?.status !== 404) console.warn("students/me failed", e);
        }

        // 3) merge for UI
        const merged = {
          // auth user bits
          id: user.id,
          username: user.username,
          role: user.role || "Student",
          email: user.email || "",
          phone: user.phone || "",
          profile_picture: user.profile_picture || student.profile_picture || "",
          // student bits
          full_name: student.full_name || user.username,
          roll_number: student.roll_number,
          class_name:
            student.class_name_label || student.class_name || student.class || "",
          section:
            student.section_label || student.section || "",
        };

        setMe(merged);
        setForm({ email: merged.email || "", phone: merged.phone || "" });
      } catch (e) {
        console.error(e);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- update profile (email/phone/photo) -----------------------------------
  const submitProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      if (form.email) payload.append("email", form.email);
      if (form.phone) payload.append("phone", form.phone);
      if (avatarFile) payload.append("profile_picture", avatarFile);

      await Axios.patch("update-profile/", payload);
      toast.success("Profile updated");

      // refresh from server just like teachers
      const { data } = await Axios.get("user/");
      setMe((m) => ({ ...m, email: data?.email, phone: data?.phone, profile_picture: data?.profile_picture }));
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.detail || "Update failed";
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  // --- change password (same endpoint as teachers) --------------------------
  const submitPassword = async (e) => {
    e.preventDefault();
    if (!pw.current_password || !pw.new_password) return toast.error("Fill current and new password");
    if (pw.new_password !== pw.confirm_password) return toast.error("Passwords do not match");
    if (pw.new_password.length < 6) return toast.error("New password must be at least 6 characters");

    setPwSaving(true);
    try {
      await Axios.post("change-password/", {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      toast.success("Password changed");
      setPw({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      console.error(err);
      const data = err?.response?.data;
      const firstMsg = typeof data === "string" ? data : Object.values(data || {})[0];
      toast.error(String(firstMsg || "Password change failed"));
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header card */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold mb-5">My Profile</h2>

        <div className="flex items-center gap-4 mb-6">
          <img
            src={mediaUrl}
            className="w-16 h-16 rounded-full object-cover border"
            alt="Profile"
            onError={(e) => {
              e.currentTarget.src = "/default-avatar.png";
            }}
          />
          <div>
            <div className="text-lg font-medium">{me?.full_name || me?.username}</div>
            <div className="text-slate-500">
              Student{me?.roll_number ? ` • Roll ${me.roll_number}` : ""}
            </div>
            <div className="text-slate-500">
              {(me?.class_name || "")} {me?.section ? `• ${me.section}` : ""}
            </div>
          </div>
        </div>

        <form onSubmit={submitProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-slate-600">Email</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              className="input input-bordered w-full"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-600">Phone</span>
            <input
              name="phone"
              type="text"
              value={form.phone}
              onChange={onChange}
              className="input input-bordered w-full"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm text-slate-600">Profile Picture</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              className="file-input file-input-bordered w-full"
            />
          </label>

          <div className="md:col-span-2">
            <button disabled={saving} className="btn btn-success">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Change password card */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold mb-5">Change Password</h2>
        <form onSubmit={submitPassword} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-slate-600">Current Password</span>
            <input
              type="password"
              value={pw.current_password}
              onChange={(e) => setPw((s) => ({ ...s, current_password: e.target.value }))}
              className="input input-bordered w-full"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">New Password</span>
            <input
              type="password"
              value={pw.new_password}
              onChange={(e) => setPw((s) => ({ ...s, new_password: e.target.value }))}
              className="input input-bordered w-full"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-slate-600">Confirm New Password</span>
            <input
              type="password"
              value={pw.confirm_password}
              onChange={(e) => setPw((s) => ({ ...s, confirm_password: e.target.value }))}
              className="input input-bordered w-full md:max-w-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button disabled={pwSaving} className="btn btn-primary">
              {pwSaving ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          • Must enter your current password. • New password must be at least 6 characters. (Backend enforces these
          checks.)
        </p>
      </div>
    </div>
  );
}
