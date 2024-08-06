import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);
        console.error("Error uploading to cloudinary: ", error);
        return null;
    }
};

// delete a image file or video file from cloudinary with url
export const deleteFromCloudinary = async (url, type) => {
    try {
        if (!url) return null;

        const publicId = url.split("/").slice(-1)[0].split(".")[0];

        const response = await cloudinary.api.delete_resources([publicId], {
            type: "upload",
            resource_type: type,
        });
        return response;
    } catch (error) {
        console.error("Error deleting from cloudinary: ", error);
        return null;
    }
};
