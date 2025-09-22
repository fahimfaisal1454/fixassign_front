// src/pages/Teachers/MyProfile.jsx
import { useEffect, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function MyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ email: "", phone: "" });
  const [avatarFile, setAvatarFile] = useState(null);

  const [pw, setPw] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  // Load profile
  useEffect(() => {
    (async () => {
      try {
        const { data } = await AxiosInstance.get("user/"); // GET /api/user/
        setMe(data);
        setForm({
          email: data?.email || "",
          phone: data?.phone || "",
        });
      } catch (e) {
        console.error(e);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onChange = (e) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  // Save profile (email, phone, picture)
  const submitProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      if (form.email) payload.append("email", form.email);
      if (form.phone) payload.append("phone", form.phone);
      if (avatarFile) payload.append("profile_picture", avatarFile);

      await AxiosInstance.patch("update-profile/", payload); // PATCH /api/update-profile/
      toast.success("Profile updated");

      // Refresh user
      const { data } = await AxiosInstance.get("user/");
      setMe(data);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.detail || "Update failed";
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  // Change password
  const submitPassword = async (e) => {
    e.preventDefault();
    if (!pw.current_password || !pw.new_password) {
      toast.error("Please fill current and new password");
      return;
    }
    if (pw.new_password !== pw.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    setPwSaving(true);
    try {
      await AxiosInstance.post("change-password/", {
        current_password: pw.current_password,
        new_password: pw.new_password,
      }); // POST /api/change-password/
      toast.success("Password changed");
      setPw({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      console.error(err);
      const data = err?.response?.data;
      const firstMsg =
        typeof data === "string" ? data : Object.values(data || {})[0];
      toast.error(String(firstMsg || "Password change failed"));
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading profile…</div>;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Profile info + form */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold mb-5">My Profile</h2>
        <div className="flex items-center gap-4 mb-6">
          <img
            src={me?.profile_picture || "/default-avatar.png"}
            className="w-16 h-16 rounded-full object-cover border"
            alt="Profile"
            onError={(e) => {
              e.currentTarget.src = "/default-avatar.png";
            }}
          />
          <div>
            <div className="text-lg font-medium">{me?.username}</div>
            <div className="text-slate-500">{me?.role}</div>
          </div>
        </div>

        <form
          onSubmit={submitProfile}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
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

      {/* Change password */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold mb-5">Change Password</h2>
        <form
          onSubmit={submitPassword}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <label className="block">
            <span className="text-sm text-slate-600">Current Password</span>
            <input
              type="password"
              value={pw.current_password}
              onChange={(e) =>
                setPw((s) => ({ ...s, current_password: e.target.value }))
              }
              className="input input-bordered w-full"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">New Password</span>
            <input
              type="password"
              value={pw.new_password}
              onChange={(e) =>
                setPw((s) => ({ ...s, new_password: e.target.value }))
              }
              className="input input-bordered w-full"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-slate-600">Confirm New Password</span>
            <input
              type="password"
              value={pw.confirm_password}
              onChange={(e) =>
                setPw((s) => ({ ...s, confirm_password: e.target.value }))
              }
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
          • Must enter your current password. • New password must be at least 6
          characters. (Backend enforces these checks.)
        </p>
      </div>
    </div>
  );
}
