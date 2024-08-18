import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const totalViews = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId),
            },
        },
        {
            $group: {
                _id: null,
                totalViews: { $sum: "$views" },
            },
        },
    ]);

    const totalSubscribers = await Subscription.countDocuments({
        channel: channelId,
    });

    const totalVideos = await Video.countDocuments({ owner: channelId });

    const totalLikes = await Like.aggregate([
        {
            $match: {
                video: {
                    $in: await Video.find({
                        owner: new mongoose.Types.ObjectId(channelId),
                    }).distinct("_id"),
                },
            },
        },
        {
            $count: "totalLikes",
        },
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalViews: totalViews.length ? totalViews[0].totalViews : 0,
                totalSubscribers,
                totalVideos,
                totalLikes: totalLikes.length ? totalLikes[0].totalLikes : 0,
            },
            "Channel stats fetched successfully"
        )
    );
});

const getChannelVideos = asyncHandler(async (req, res) => {
    const channelId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const videos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId),
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

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videos,
            },
            "Channel videos fetched successfully"
        )
    );
});

export { getChannelStats, getChannelVideos };
