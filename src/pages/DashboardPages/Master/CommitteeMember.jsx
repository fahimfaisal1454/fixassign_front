import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import AxiosInstance from "../../../components/AxiosInstance";

const CommitteeMembers = () => {
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    full_name: "",
    role: "",
    contact_email: "",
    contact_phone: "",
    photo: null,
  });
  const [preview, setPreview] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [filters, setFilters] = useState({ name: "", role: "" });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
  });

  const fetchData = async () => {
    try {
      const res = await AxiosInstance.get("committee-members/");
      setMembers(res.data);
    } catch (err) {
      toast.error("Failed to load data");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "photo") {
      setFormData({ ...formData, [name]: files[0] });
      setPreview(URL.createObjectURL(files[0]));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    for (let key in formData) {
      if (formData[key]) data.append(key, formData[key]);
    }

    try {
      if (isEditing) {
        await AxiosInstance.put(`committee-members/${currentId}/`, data);
        toast.success("Member updated");
      } else {
        await AxiosInstance.post("committee-members/", data);
        toast.success("Member added");
      }
      fetchData();
      resetForm();
    } catch (err) {
      toast.error("Something went wrong, please try again");
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      role: "",
      contact_email: "",
      contact_phone: "",
      photo: null,
    });
    setPreview(null);
    setIsModalOpen(false);
    setIsEditing(false);
    setCurrentId(null);
  };

  const handleEdit = (member) => {
    setFormData({
      full_name: member.full_name,
      role: member.role,
      contact_email: member.contact_email,
      contact_phone: member.contact_phone,
      photo: null,
    });
    setPreview(member.photo);
    setCurrentId(member.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure?")) return;
    try {
      await AxiosInstance.delete(`committee-members/${id}/`);
      toast.success("Member deleted");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete member");
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(filters.name.toLowerCase()) &&
      m.role.toLowerCase().includes(filters.role.toLowerCase())
  );

  const paginatedMembers = filteredMembers.slice(
    (pagination.currentPage - 1) * pagination.itemsPerPage,
    pagination.currentPage * pagination.itemsPerPage
  );

  const totalPages = Math.ceil(
    filteredMembers.length / pagination.itemsPerPage
  );

  const handlePageChange = (page) => {
    setPagination({ ...pagination, currentPage: page });
  };

  return (
    <div className="p-4">
      <Toaster />
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
        Managing Committee
      </h2>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-48">
            <input
              type="text"
              placeholder="Search by name"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          <div className="relative w-full md:w-48">
            <input
              type="text"
              placeholder="Search by role"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Add Member
        </button>
      </div>

      {/* DaisyUI Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg text-center font-bold">
                {isEditing ? "Update Member" : "Add New Member"}
              </h3>
              <button onClick={resetForm} className="btn btn-sm btn-circle">
                ✕
              </button>
            </div>

            {preview && (
              <div className="flex justify-center">
                <img
                  src={preview}
                  alt="preview"
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-1">
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-300 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-300 mb-1">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-300 mb-1">
                  Photo
                </label>
                <input
                  type="file"
                  name="photo"
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg file:bg-gray-200 file:text-gray-700 file:text-sm file:px-4 file:py-1 file:border-none file:rounded-full dark:file:bg-gray-800 dark:file:text-gray-200 dark:text-gray-300 placeholder-gray-400/70 dark:placeholder-gray-500 focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-40 dark:border-gray-600 dark:bg-gray-900"
                />
              </div>

              <div className="modal-action mt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead className="bg-blue-500 text-white text-sm text-center dark:bg-gray-700">
            <tr>
              <th className="py-3 px-4">#</th>
              <th className="py-3 px-4">Photo</th>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedMembers.length > 0 ? (
              paginatedMembers.map((m, index) => (
                <tr
                  key={m.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400">
                    {(pagination.currentPage - 1) * pagination.itemsPerPage +
                      index +
                      1}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center">
                      {m.photo ? (
                        <img
                          src={m.photo}
                          alt={m.full_name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              m.full_name
                            )}&background=random`;
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                              m.full_name
                            )}&background=random`}
                            alt={m.full_name}
                            className="rounded-full w-full h-full"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-center text-gray-900 dark:text-white">
                    {m.full_name}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">
                    {m.role}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">
                    {m.contact_email || "-"}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">
                    {m.contact_phone || "-"}
                  </td>
                  <td className="py-3 px-4 flex items-center justify-center space-x-2">
                    <button
                      onClick={() => handleEdit(m)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors dark:bg-red-500 dark:hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="py-4 text-center text-gray-500 dark:text-gray-400"
                >
                  No members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 rounded ${
                  pagination.currentPage === page
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "border border-gray-300 dark:border-gray-600"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === totalPages}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default CommitteeMembers;
