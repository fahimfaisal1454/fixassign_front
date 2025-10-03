import { useState, useEffect } from "react";
import { toast, Toaster } from "react-hot-toast";
import Select from "react-select";
import axiosInstance from "../../../components/AxiosInstance";

export default function StaffInfo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffs, setStaffs] = useState([]);
  const [filteredStaffs, setFilteredStaffs] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    designation: "",
    contact_email: "",
    contact_phone: "",
    photo: null,
    profile: "",
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
  });
  const [preview, setPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("");
  const [nameOptions, setNameOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch staff data
  useEffect(() => {
    const fetchStaffs = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get("staff/");
        setStaffs(response.data || []);
        setFilteredStaffs(response.data || []);
      } catch (error) {
        console.error("Failed to load staff data");
        setStaffs([]);
        setFilteredStaffs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaffs();
  }, []);

  // Update filtered staff list when search or designation changes
  useEffect(() => {
    let results = staffs;

    if (searchTerm) {
      results = results.filter((staff) =>
        staff.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedDesignation) {
      results = results.filter(
        (staff) => staff.designation === selectedDesignation
      );
    }

    setFilteredStaffs(results);
  }, [searchTerm, selectedDesignation, staffs]);

  // Prepare name options for react-select
  useEffect(() => {
    const options = staffs.map((staff) => ({
      value: staff.id,
      label: staff.full_name,
    }));
    setNameOptions(options);
  }, [staffs]);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === "file") {
      const file = files[0];
      setFormData({ ...formData, photo: file });
      setPreview(URL.createObjectURL(file));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("full_name", formData.full_name);
      formDataToSend.append("designation", formData.designation);
      formDataToSend.append("contact_email", formData.contact_email);
      formDataToSend.append("contact_phone", formData.contact_phone);
      formDataToSend.append("profile", formData.profile || "");

      if (formData.photo) {
        formDataToSend.append("photo", formData.photo);
      }

      if (isEditing) {
        await axiosInstance.put(`staff/${currentStaffId}/`, formDataToSend);
        toast.success("Staff information updated successfully");
      } else {
        await axiosInstance.post("staff/", formDataToSend);
        toast.success("Staff information added successfully");
      }

      const response = await axiosInstance.get("staff/");
      setStaffs(response.data || []);
      setFilteredStaffs(response.data || []);
      resetForm();
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (staff) => {
    setFormData({
      full_name: staff.full_name || "",
      designation: staff.designation || "",
      contact_email: staff.contact_email || "",
      contact_phone: staff.contact_phone || "",
      photo: null,
      profile: staff.profile || "",
    });
    setCurrentStaffId(staff.id);
    setIsEditing(true);
    setIsModalOpen(true);
    if (staff.photo) {
      setPreview(staff.photo);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this staff?")) {
      try {
        await axiosInstance.delete(`staff/${id}/`);
        toast.success("Staff information deleted successfully");
        const response = await axiosInstance.get("staff/");
        setStaffs(response.data || []);
        setFilteredStaffs(response.data || []);
      } catch (error) {
        toast.error("Failed to delete staff");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      designation: "",
      contact_email: "",
      contact_phone: "",
      photo: null,
      profile: "",
    });
    setPreview(null);
    setIsModalOpen(false);
    setIsEditing(false);
    setCurrentStaffId(null);
  };

  // Pagination logic
  const paginatedStaffs = filteredStaffs.slice(
    (pagination.currentPage - 1) * pagination.itemsPerPage,
    pagination.currentPage * pagination.itemsPerPage
  );

  const totalPages = Math.ceil(filteredStaffs.length / pagination.itemsPerPage);

  const handlePageChange = (page) => {
    if (page > 0 && page <= totalPages) {
      setPagination({ ...pagination, currentPage: page });
    }
  };

  // Get unique designations
  const getUniqueDesignations = () => {
    const designations = [...new Set(staffs.map((staff) => staff.designation))];
    return designations.map((desig) => ({ value: desig, label: desig }));
  };

  return (
    <div className="p-4">
      <Toaster position="top-center" />

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Staff List</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
        >
          Add Staff
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-4 max-w-md grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search by Name
          </label>
          <Select
            options={nameOptions}
            isClearable
            placeholder="Enter staff name..."
            onChange={(selectedOption) =>
              setSearchTerm(selectedOption?.label || "")
            }
            onInputChange={(inputValue) => setSearchTerm(inputValue)}
            className="basic-single"
            classNamePrefix="select"
            styles={{
              control: (provided) => ({
                ...provided,
                minHeight: "32px",
                height: "32px",
              }),
              placeholder: (provided) => ({
                ...provided,
                fontSize: "0.875rem",
              }),
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Designation
          </label>
          <select
            value={selectedDesignation}
            onChange={(e) => setSelectedDesignation(e.target.value)}
            className="block w-full h-8 px-3 text-sm border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Designations</option>
            {getUniqueDesignations().map((desig) => (
              <option key={desig.value} value={desig.value}>
                {desig.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staffs Table */}
      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2">Loading data...</p>
        </div>
      ) : filteredStaffs.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No staff found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Click the button above to add a new staff
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden">
              <thead className="bg-blue-500 text-white text-sm text-center">
                <tr>
                  <th className="py-3 px-4 ">#</th>
                  <th className="py-3 px-4">Photo</th>
                  <th className="py-3 px-4 ">Name</th>
                  <th className="py-3 px-4 ">Designation</th>
                  <th className="py-3 px-4 ">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedStaffs.map((staff, index) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-center text-gray-500">
                      {(pagination.currentPage - 1) * pagination.itemsPerPage +
                        index +
                        1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        {staff.photo ? (
                          <img
                            src={staff.photo}
                            alt={staff.full_name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                staff.full_name
                              )}&background=random`;
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                staff.full_name
                              )}&background=random`}
                              alt={staff.full_name}
                              className="rounded-full w-full h-full"
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-center text-gray-900">
                      {staff.full_name}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700">
                      {staff.designation}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700">
                      {staff.contact_email}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700">
                      {staff.contact_phone}
                    </td>
                    <td className="py-3 px-4 flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleEdit(staff)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(staff.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
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
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 rounded ${
                        pagination.currentPage === page
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === totalPages}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </>
      )}

      {/* Staff Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative">
            <button
              onClick={resetForm}
              className="absolute top-3 right-3 p-1 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>

            <div className="p-6">
              <h2 className="text-xl font-semibold text-center mb-4 text-blue-600">
                {isEditing ? "Edit Staff Information" : "Staff Information Form"}
              </h2>

              {/* Image Preview */}
              <div className="flex justify-center mb-4">
                {preview ? (
                  <img
                    src={preview}
                    alt="Staff Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-400"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                    👤
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Enter staff full name"
                    required
                    className="block w-full py-1.5 text-sm border rounded-lg px-4"
                  />
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="e.g., Office Assistant, Librarian"
                    required
                    className="block w-full py-1.5 text-sm border rounded-lg px-4"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    placeholder="Enter email"
                    className="block w-full py-1.5 text-sm border rounded-lg px-4"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    placeholder="01XXXXXXXXX"
                    pattern="[0-9]{11}"
                    className="block w-full py-1.5 text-sm border rounded-lg px-4"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be 11 digits (01XXXXXXXXX)
                  </p>
                </div>

                {/* Photo */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Staff Photo
                  </label>
                  <input
                    type="file"
                    name="photo"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleChange}
                    className="block w-full px-3 py-1 text-sm border rounded-lg"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    (JPG, PNG, WEBP, JPEG)
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-2 mt-4 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 ${
                    isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isSubmitting
                    ? "Processing..."
                    : isEditing
                    ? "Update"
                    : "Save"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
