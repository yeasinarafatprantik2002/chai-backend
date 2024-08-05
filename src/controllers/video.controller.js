import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    //TODO: get all videos based on query, sort, pagination

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: {},
    };

    if (sortBy && sortType) {
        options.sort[sortBy] = sortType;
    }

    const queryOptions = {};

    if (query) {
        queryOptions.title = { $regex: query, $options: "i" };
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user ID");
        }

        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        queryOptions.owner = userId;
    }

    const videos = await Video.aggregatePaginate(queryOptions, options);

    return res
        .status(200)
        .json(new ApiResponse(200, { videos }, "Videos fetched successfully"));
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

    const createdVideo = await Video.findById(video._id);

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

    const video = await Video.findById(videoId);

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

    const thumbnailLocalPath = req.file?.path;

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
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    await Video.findByIdAndDelete(videoId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
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
