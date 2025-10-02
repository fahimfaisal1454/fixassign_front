// src/pages/DashboardPages/academics/ManagePeriods.jsx
import { useEffect, useState } from "react";
import AxiosInstance from "../../../components/AxiosInstance";

const emptyForm = { name: "", order: "", start_time: "", end_time: "" };

// time helpers
const toHHMM = (t) => (t ? String(t).slice(0, 5) : "");
const toMinutes = (hhmm) => {
  if (!hhmm) return NaN;
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};
const rangesOverlap = (aStart, aEnd, bStart, bEnd) => {
  // true if [aStart, aEnd) intersects [bStart, bEnd)
  return aStart < bEnd && bStart < aEnd;
};

export default function ManagePeriods() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await AxiosInstance.get("periods/", { params: { _ts: Date.now() } }); // GET /api/periods/
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setErr("Failed to load periods.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    const name = String(form.name || "").trim();
    const orderNum = Number(form.order);
    const start = toHHMM(form.start_time);
    const end = toHHMM(form.end_time);

    if (!name) return "Name is required";
    if (!String(form.order).trim() || isNaN(orderNum)) return "Order must be a number";
    if (!start || !end) return "Start and end time are required";
    if (start >= end) return "Start time must be before end time";

    const sMin = toMinutes(start);
    const eMin = toMinutes(end);

    // 1) Order uniqueness (exclude current editing row)
    const orderClash = rows.some(
      (r) => Number(r.order) === orderNum && String(r.id) !== String(editingId)
    );
    if (orderClash) return "Order is already used. Choose a different order.";

    // 2) Exact duplicate time range (exclude current editing row)
    const exactDuplicate = rows.some(
      (r) =>
        String(r.id) !== String(editingId) &&
        toHHMM(r.start_time) === start &&
        toHHMM(r.end_time) === end
    );
    if (exactDuplicate) return "This exact time range already exists.";

    // 3) Overlap detection (exclude current editing row)
    const overlap = rows.find((r) => {
      if (String(r.id) === String(editingId)) return false;
      const rs = toMinutes(toHHMM(r.start_time));
      const re = toMinutes(toHHMM(r.end_time));
      return rangesOverlap(sMin, eMin, rs, re);
    });
    if (overlap) {
      return `Time overlaps with "${overlap.name}" (${toHHMM(overlap.start_time)}–${toHHMM(
        overlap.end_time
      )}).`;
    }

    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setErr("");

    try {
      const payload = {
        name: String(form.name || "").trim(),
        order: Number(form.order),
        start_time: toHHMM(form.start_time),
        end_time: toHHMM(form.end_time),
      };

      if (editingId) {
        await AxiosInstance.patch(`periods/${editingId}/`, payload);
      } else {
        // Optional: if your backend mistakenly upserts on order, you can pre-block here.
        await AxiosInstance.post("periods/", payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (e) {
      console.error(e);
      setErr("Save failed. Make sure order is unique and time range does not overlap.");
    }
  };

  const onEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name ?? "",
      order: row.order ?? "",
      start_time: toHHMM(row.start_time),
      end_time: toHHMM(row.end_time),
    });
    setErr("");
  };

  const onCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErr("");
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this period?")) return;
    try {
      await AxiosInstance.delete(`periods/${id}/`);
      await load();
    } catch (e) {
      console.error(e);
      setErr("Delete failed.");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Manage Periods</h1>

      <form
        key={editingId ?? "new"}
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-5 gap-2 bg-white p-3 rounded border"
      >
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          placeholder="Name (e.g., 1st)"
          className="input input-bordered"
          required
        />
        <input
          name="order"
          type="number"
          value={form.order}
          onChange={onChange}
          placeholder="Order (e.g., 1)"
          className="input input-bordered"
          required
        />
        <input
          name="start_time"
          type="time"
          value={toHHMM(form.start_time)}
          onChange={onChange}
          className="input input-bordered"
          required
        />
        <input
          name="end_time"
          type="time"
          value={toHHMM(form.end_time)}
          onChange={onChange}
          className="input input-bordered"
          required
        />
        <div className="flex gap-2">
          <button className="btn btn-success" type="submit">
            {editingId ? "Update" : "Add"}
          </button>
          {editingId && (
            <button className="btn" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {err && <div className="alert alert-error text-sm">{err}</div>}

      <div className="bg-white rounded border overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Name</th>
              <th>Start</th>
              <th>End</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5}>No periods yet.</td></tr>
            ) : (
              rows
                .slice()
                .sort((a, b) => Number(a.order) - Number(b.order))
                .map((r) => (
                  <tr key={r.id}>
                    <td>{r.order}</td>
                    <td>{r.name}</td>
                    <td>{toHHMM(r.start_time)}</td>
                    <td>{toHHMM(r.end_time)}</td>
                    <td className="text-right">
                      <button className="btn btn-xs mr-2" onClick={() => onEdit(r)}>Edit</button>
                      <button className="btn btn-xs btn-error" onClick={() => onDelete(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
