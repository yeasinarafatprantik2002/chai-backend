import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.js";
import fs from "fs";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    const match = {};
    const sort = {};

    if (query) {
        match.title = { $regex: query, $options: "i" };
    }

    if (userId) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error("Invalid user ID");
        }
        if (!(await User.exists({ _id: userId }))) {
            throw new Error("User not found");
        }
        match.owner = new mongoose.Types.ObjectId(userId);
    }

    if (sortBy) {
        sort[sortBy] = sortType === "desc" ? -1 : 1;
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: sort,
    };

    const videos = await Video.aggregatePaginate(
        [
            {
                $match: match,
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                },
            },
            {
                $unwind: "$owner",
            },
            {
                $project: {
                    title: 1,
                    description: 1,
                    videoFile: 1,
                    thumbnail: 1,
                    owner: {
                        fullName: 1,
                        username: 1,
                        avatar: 1,
                    },
                    duration: 1,
                    views: 1,
                    isPublished: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
            },
        ],
        options
    );

    return res
        .status(200)
        .json(new ApiResponse(200, { videos }, "Videos fetched successfully"));

    // http://localhost:3000/api/videos?query=video&sortBy=views&sortType=desc&userId=60f7b3b3b3b3b3b3b3b3b3b3&page=1&limit=10

    // http://localhost:3000/api/videos?query=video&sortBy=views&sortType=desc&page=1&limit=10
    // query: video
    // sortBy: views
    // sortType: desc
    // page: 1
    // limit: 10
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    if ([title, description].some((field) => !field?.trim() === "")) {
        throw new ApiError(400, "Title and description are required");
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path;

    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    const videoPath = await uploadOnCloudinary(videoLocalPath);

    if (!videoPath.url) {
        throw new ApiError(500, "Error uploading video file");
    }

    const videoDuration = videoPath.duration;

    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required");
    }

    const thumbnailPath = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnailPath.url) {
        throw new ApiError(500, "Error uploading thumbnail");
    }

    const video = await Video.create({
        title,
        description,
        videoFile: videoPath.url,
        thumbnail: thumbnailPath.url,
        owner: req.user._id,
        duration: videoDuration,
    });

    if (!video) {
        throw new ApiError(500, "Error publishing video");
    }

    const createdVideo = await Video.aggregate([
        {
            $match: {
                _id: video._id,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $unwind: "$owner",
        },
        {
            $project: {
                title: 1,
                description: 1,
                videoFile: 1,
                thumbnail: 1,
                owner: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                },
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        },
    ]);

    if (!createdVideo) {
        throw new ApiError(500, "Error fetching video details");
    }

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                { video: createdVideo },
                "Video uploaded successfully"
            )
        );
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $unwind: "$owner",
        },
        {
            $project: {
                title: 1,
                description: 1,
                videoFile: 1,
                thumbnail: 1,
                owner: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                },
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        },
    ]);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { video }, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    const userId = req.user._id;
    const thumbnailLocalPath = req.file?.path;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if ([title, description].some((field) => !field?.trim() === "")) {
        throw new ApiError(400, "Title and description are required");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== userId.toString()) {
        fs.unlinkSync(thumbnailLocalPath);
        throw new ApiError(403, "You are not authorized to update this video");
    }

    await deleteFromCloudinary(video.thumbnail, "image");

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required");
    }

    const thumbnailPath = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnailPath.url) {
        throw new ApiError(500, "Error uploading thumbnail image");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            title,
            description,
            thumbnail: thumbnailPath?.url || video.thumbnail,
        },
        { new: true }
    );

    if (!updatedVideo) {
        throw new ApiError(500, "Error updating video");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { video: updatedVideo },
                "Video updated successfully"
            )
        );
});

const deleteVideo = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    await deleteFromCloudinary(video.thumbnail, "image");
    await deleteFromCloudinary(video.videoFile, "video");

    await Video.findByIdAndDelete(videoId);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                video: {
                    _id: videoId,
                    title: video.title,
                },
            },
            "Video deleted successfully"
        )
    );
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to update this video");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { isPublished: !video.isPublished },
        { new: true }
    );

    if (!updatedVideo) {
        throw new ApiError(500, "Error updating video");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { video: updatedVideo },
                "Video updated successfully"
            )
        );
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};
