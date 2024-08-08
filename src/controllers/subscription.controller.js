import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const subscriberId = req.user._id;

    const subscription = await Subscription.findOne({
        channel: channelId,
        subscriber: subscriberId,
    });

    if (subscription) {
        await Subscription.deleteOne({
            channel: channelId,
            subscriber: subscriberId,
        });
        return res
            .status(200)
            .json(new ApiResponse(200, {}, { message: "Unsubscribed" }));
    }

    await Subscription.create({ channel: channelId, subscriber: subscriberId });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, { message: "Subscribed" }));
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const channel = await User.findById(channelId);

    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    const subscribers = await Subscription.aggregate([
        {
            $match: { channel: new mongoose.Types.ObjectId(channelId) },
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
            },
        },
        {
            $unwind: "$subscriber",
        },
        {
            $project: {
                _id: "$subscriber._id",
                sub_name: "$subscriber.username",
                email: "$subscriber.email",
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { channelId: channel._id, subscribers: subscribers },
                "Subscribers list retrieved successfully"
            )
        );
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    const subscriber = await User.findById(subscriberId);

    if (!subscriber) {
        throw new ApiError(404, "Subscriber not found");
    }

    const channels = await Subscription.aggregate([
        {
            $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) },
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
            },
        },
        {
            $unwind: "$channel",
        },
        {
            $project: {
                _id: "$channel._id",
                ch_name: "$channel.username",
                email: "$channel.email",
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { subscriberId: subscriber._id, channels: channels },
                "Subscribed channels list retrieved successfully"
            )
        );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
