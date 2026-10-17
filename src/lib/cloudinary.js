// src/lib/cloudinary.js
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadToCloudinary = async (file, folder = "aniscript") => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!res.ok) throw new Error("Cloudinary upload failed");
  return res.json();
};

export const getCloudinaryUrl = (publicId, transforms = "") => {
  if (!publicId) return null;
  if (publicId.startsWith("http")) return publicId;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
};

// Пресеты трансформаций
export const transforms = {
  cover: "c_fill,w_400,h_600,q_auto,f_auto",
  coverLg: "c_fill,w_800,h_1200,q_auto,f_auto",
  avatar: "c_fill,w_150,h_150,q_auto,f_auto,g_face",
  avatarSm: "c_fill,w_60,h_60,q_auto,f_auto,g_face",
  banner: "c_fill,w_1400,h_400,q_auto,f_auto",
  character: "c_fill,w_400,h_600,q_auto,f_auto",
  charFull: "c_fit,w_800,h_1200,q_auto,f_auto",
  blur: "c_fill,w_1400,h_500,q_30,f_auto,e_blur:1500",
};
