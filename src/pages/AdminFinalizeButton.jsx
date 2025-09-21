// import { useEffect, useMemo, useState } from "react";
// import AxiosInstance from "../components/AxiosInstance";
// import { toast } from "react-hot-toast";

// export default function AdminFinalizeFinal({ classId, sectionId, year }) {
//   // 1) default year if not provided
//   const computedYear = useMemo(() => year ?? new Date().getFullYear(), [year]);

//   const [busy, setBusy] = useState(false);
//   const [exams, setExams] = useState([]);         // all exams for this class/section (optionally filtered)
//   const [weights, setWeights] = useState({});     // { [examId]: number }
//   const [name, setName] = useState(`Final Result ${computedYear}`);

//   // keep name in sync if year/prop changes
//   useEffect(() => {
//     setName((prev) => {
//       // if admin already edited the name, don't overwrite
//       if (!prev || prev.startsWith("Final Result ")) {
//         return `Final Result ${computedYear}`;
//       }
//       return prev;
//     });
//   }, [computedYear]);

//   // load exams
//   useEffect(() => {
//     let cancelled = false;
//     (async () => {
//       if (!classId || !sectionId) {
//         setExams([]);
//         setWeights({});
//         return;
//       }
//       try {
//         const { data } = await AxiosInstance.get("exams/", {
//           params: { class_name: classId, section: sectionId },
//         });
//         const list = Array.isArray(data) ? data : [];

//         // Only filter by year if exam has created_at and we know the year.
//         const filtered = list.filter((ex) => {
//           if (!ex.created_at || !computedYear) return true; // keep if no date
//           const d = new Date(ex.created_at);
//           return Number.isFinite(d.getTime()) ? d.getFullYear() === computedYear : true;
//         });

//         if (!cancelled) {
//           setExams(filtered);
//           // init weights to 0 for each exam
//           const init = {};
//           filtered.forEach((e) => {
//             init[e.id] = 0;
//           });
//           setWeights(init);
//         }
//       } catch (e) {
//         console.error(e);
//         if (!cancelled) {
//           setExams([]);
//           setWeights({});
//         }
//         toast.error("Couldn't load exams.");
//       }
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, [classId, sectionId, computedYear]);

//   // total %
//   const total = useMemo(
//     () => Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0),
//     [weights]
//   );

//   const run = async () => {
//     if (!classId || !sectionId) {
//       toast.error("Select class & section first.");
//       return;
//     }
//     if (total !== 100) {
//       toast.error("Total weight must equal 100%");
//       return;
//     }
//     const parts = Object.entries(weights)
//       .filter(([_, w]) => Number(w) > 0)
//       .map(([exam_id, weight]) => ({ exam_id: Number(exam_id), weight: Number(weight) }));

//     if (!parts.length) {
//       toast.error("Set weights for at least one exam.");
//       return;
//     }

//     setBusy(true);
//     try {
//       const { data } = await AxiosInstance.post("finals/finalize_publish/", {
//         class_id: Number(classId),
//         section_id: Number(sectionId),
//         year: Number(computedYear),
//         parts,
//         name,
//         publish: true,
//       });
//       toast.success(`Published: ${data.final_exam_name} (rows: ${data.upserts})`);
//     } catch (e) {
//       console.error(e);
//       const msg = e?.response?.data?.detail || e?.response?.data || "Failed to publish";
//       toast.error(
//         typeof msg === "string" ? msg : JSON.stringify(msg)
//       );
//     } finally {
//       setBusy(false);
//     }
//   };

//   return (
//     <div className="space-y-4 border rounded p-4">
//       <div className="flex items-center justify-between">
//         <h3 className="font-semibold">Finalize & Publish Final Results</h3>
//         <div className="text-sm text-slate-600">
//           Class ID: <b>{classId || "—"}</b> • Section ID: <b>{sectionId || "—"}</b> • Year: <b>{computedYear}</b>
//         </div>
//       </div>

//       <div className="flex gap-2 items-center">
//         <label className="text-sm">Final Exam Name</label>
//         <input
//           className="border rounded px-2 py-1 text-sm w-64"
//           value={name}
//           onChange={(e) => setName(e.target.value)}
//           placeholder={`Final Result ${computedYear}`}
//         />
//         <span className={`ml-3 text-xs px-2 py-0.5 rounded ${total === 100 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>
//           Total: {total}%
//         </span>
//       </div>

//       <div className="overflow-x-auto">
//         <table className="min-w-[520px] w-full text-sm border">
//           <thead>
//             <tr className="bg-slate-50 border-b">
//               <th className="text-left px-2 py-1">Include</th>
//               <th className="text-left px-2 py-1">Exam</th>
//               <th className="text-right px-2 py-1">Weight %</th>
//               <th className="text-center px-2 py-1">Published</th>
//             </tr>
//           </thead>
//           <tbody>
//             {exams.length === 0 ? (
//               <tr>
//                 <td colSpan={4} className="px-2 py-4 text-center text-slate-500">
//                   No exams found for this class/section{year ? ` in ${computedYear}` : ""}.
//                 </td>
//               </tr>
//             ) : (
//               exams.map((e) => {
//                 const w = Number(weights[e.id] || 0);
//                 return (
//                   <tr key={e.id} className="border-b">
//                     <td className="px-2 py-1">
//                       <input
//                         type="checkbox"
//                         checked={w > 0}
//                         onChange={(ev) =>
//                           setWeights((m) => ({ ...m, [e.id]: ev.target.checked ? 10 : 0 }))
//                         }
//                         title="Quick toggle: sets 10% when enabled"
//                       />
//                     </td>
//                     <td className="px-2 py-1">{e.name}</td>
//                     <td className="px-2 py-1 text-right">
//                       <input
//                         type="number"
//                         min={0}
//                         max={100}
//                         className="w-20 border rounded px-2 py-1 text-right"
//                         value={Number.isFinite(w) ? w : 0}
//                         onChange={(ev) =>
//                           setWeights((m) => ({ ...m, [e.id]: Number(ev.target.value) }))
//                         }
//                       />
//                     </td>
//                     <td className="px-2 py-1 text-center">
//                       <span
//                         className={`text-xs px-2 py-0.5 rounded ${
//                           e.is_published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
//                         }`}
//                       >
//                         {e.is_published ? "Yes" : "No"}
//                       </span>
//                     </td>
//                   </tr>
//                 );
//               })
//             )}
//           </tbody>
//         </table>
//       </div>

//       <button
//         onClick={run}
//         disabled={busy || total !== 100 || !exams.length}
//         className="px-3 py-1 rounded bg-black text-white disabled:opacity-60"
//       >
//         {busy ? "Publishing…" : "Finalize & Publish"}
//       </button>
//     </div>
//   );
// }
