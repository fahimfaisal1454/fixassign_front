import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import axiosInstance from "../../../components/AxiosInstance";

export default function GalleryUpload() {
  const [galleryItems, setGalleryItems] = useState([
    { image: null, caption: "", preview: null },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);

  // Fetch uploaded gallery
  const fetchUploadedImages = async () => {
    try {
      const res = await axiosInstance.get("gallery/");
      setUploadedImages(res.data);
    } catch (err) {
      toast.error("ইমেজ লোড করতে সমস্যা হয়েছে");
    }
  };

  useEffect(() => {
    fetchUploadedImages();
  }, []);

  const handleChange = (index, field, value) => {
    const newItems = [...galleryItems];

    if (field === "image") {
      if (value && value.size > 20 * 1024 * 1024) {
        toast.error("ছবির সাইজ 20MB এর বেশি হতে পারবে না!");
        return;
      }
      newItems[index][field] = value;
      newItems[index].preview = value ? URL.createObjectURL(value) : null;
    } else {
      newItems[index][field] = value;
    }

    setGalleryItems(newItems);
  };

  const handleAdd = () => {
    if (galleryItems.length < 5) {
      setGalleryItems([
        ...galleryItems,
        { image: null, caption: "", preview: null },
      ]);
    } else {
      toast.error("সর্বোচ্চ ৪টি ছবি আপলোড করা যাবে!");
    }
  };

  const handleRemove = (index) => {
    if (galleryItems.length > 1) {
      const newItems = galleryItems.filter((_, i) => i !== index);
      setGalleryItems(newItems);
    } else {
      toast.error("অন্তত ১টি ছবি আপলোড করতে হবে!");
    }
  };

  const handleDeleteImage = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে মুছতে চান?")) return;
    try {
      await axiosInstance.delete(`gallery/${id}/`);
      toast.success("ছবি মুছে ফেলা হয়েছে");
      fetchUploadedImages();
    } catch (err) {
      toast.error("মুছে ফেলতে সমস্যা হয়েছে");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const validItems = galleryItems.filter((item) => item.image);

    if (validItems.length === 0) {
      toast.error("অন্তত ১টি ছবি আপলোড করুন!");
      setIsSubmitting(false);
      return;
    }

    try {
      for (const item of validItems) {
        const formData = new FormData();
        formData.append("image", item.image);
        formData.append("caption", item.caption || "");

        await axiosInstance.post("gallery/", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      toast.success("গ্যালারি সফলভাবে আপলোড হয়েছে!");
      setGalleryItems([{ image: null, caption: "", preview: null }]);
      fetchUploadedImages();
    } catch (error) {
      console.error("❌ Upload failed:", error);
      toast.error("আপলোড ব্যর্থ হয়েছে!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />

      {/* Upload Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 p-6 max-w-3xl mx-auto bg-white rounded-lg shadow-md"
      >
        <h2 className="text-2xl font-bold text-gray-800">🖼️ গ্যালারি আপলোড</h2>

        <div className="space-y-4">
          {galleryItems.map((item, index) => (
            <div
              key={index}
              className="border border-gray-200 p-4 rounded-lg space-y-4"
            >
              <div className="flex flex-col md:flex-row gap-4 items-start">
                {item.preview && (
                  <div className="text-center">
                    <img
                      src={item.preview}
                      alt={`Preview ${index + 1}`}
                      className="w-16 h-16 object-cover rounded border border-gray-200 mx-auto"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Size: {(item.image.size / (1024 * 1024)).toFixed(2)}MB
                    </p>
                  </div>
                )}

                <div className="flex-1">
                  <label
                    htmlFor={`image-${index}`}
                    className="block text-sm text-gray-500 mb-1"
                  >
                    ছবি {index + 1}
                  </label>
                  <input
                    id={`image-${index}`}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleChange(index, "image", e.target.files[0])
                    }
                    className="block w-full px-5 py-1 text-gray-700 placeholder-gray-400/70 bg-white border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-40 file:bg-gray-200 file:text-gray-700 file:text-sm file:px-4 file:py-1 file:border-none file:rounded-full"
                    required={index === 0}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    সর্বোচ্চ 20MB (JPEG, PNG)
                  </p>
                </div>

                <div className="flex-1">
                  <label
                    htmlFor={`caption-${index}`}
                    className="block text-sm text-gray-500 mb-1"
                  >
                    ক্যাপশন
                  </label>
                  <input
                    id={`caption-${index}`}
                    type="text"
                    placeholder="ছবির বর্ণনা লিখুন"
                    value={item.caption}
                    onChange={(e) =>
                      handleChange(index, "caption", e.target.value)
                    }
                    className="block w-full px-5 py-1.5 text-gray-700 placeholder-gray-400/70 bg-white border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-40"
                  />
                </div>

                {galleryItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="px-3 py-2 text-red-500 hover:text-red-700 text-sm font-medium flex items-center whitespace-nowrap"
                  >
                    🗑️ মুছুন
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          {galleryItems.length < 6 && (
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              ➕ আরো ছবি যোগ করুন
            </button>
          )}

          <button
            type="submit"
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting ? "আপলোড হচ্ছে..." : "🖼️ গ্যালারি আপলোড করুন"}
          </button>
        </div>
      </form>

      {/* Uploaded Image List */}
      <div className="max-w-3xl mx-auto mt-10 bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">📁 আপলোডকৃত গ্যালারি</h2>
        {uploadedImages.length === 0 ? (
          <p className="text-gray-500 text-sm">কোনো ছবি পাওয়া যায়নি।</p>
        ) : (
          <div className="space-y-4">
            {uploadedImages.map((img) => (
              <div
                key={img.id}
                className="flex items-center justify-between border border-gray-200 rounded-md p-3"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={img.image}
                    alt="Uploaded"
                    className="w-16 h-16 object-cover rounded border"
                  />
                  <div>
                    <p className="text-sm text-gray-700">{img.caption || "No caption"}</p>
                    <p className="text-xs text-gray-400">ID: {img.id}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteImage(img.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    🗑️ মুছুন
                  </button>
                  {/* Optional Update Button */}
                  {/* <button className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                    ✏️ আপডেট
                  </button> */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
