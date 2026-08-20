import { ChannelType } from "discord.js";

export const CHANNEL_PERMISSION_ERRORS = {
	NO_CHANNEL_ACCESS: "bot:noChannelAccess",
	NO_SPEAK_PERMISSION: "bot:noSpeakPermission",
	NO_REACTION_PERMISSION: "bot:noReacPermission",
	NO_EMBED_PERMISSION: "bot:noEmbedPermission",
	NO_FILE_PERMISSION: "bot:noFilePermission",
	NO_HISTORY_PERMISSION: "bot:noHistoryPermission"
} as const;

export const THREAD_SEND_ACCESS_ERRORS = {
	NOT_JOINED: "bot:noThreadMembership",
	CANNOT_SEND: "bot:noSpeakInThreadPermission"
} as const;

export type ThreadSendAccessError = typeof THREAD_SEND_ACCESS_ERRORS[keyof typeof THREAD_SEND_ACCESS_ERRORS];

type ThreadAwareChannel = {
	isThread(): boolean;
	readonly sendable?: boolean;
	readonly type?: ChannelType;
	readonly joined?: boolean;
	readonly manageable?: boolean;
};

function isUnjoinedPrivateThread(channel: ThreadAwareChannel): boolean {
	return channel.type === ChannelType.PrivateThread && channel.joined === false && channel.manageable === false;
}

export function getThreadSendAccessError(channel: ThreadAwareChannel): ThreadSendAccessError | null {
	if (!channel.isThread() || channel.sendable === true) {
		return null;
	}

	if (isUnjoinedPrivateThread(channel)) {
		return THREAD_SEND_ACCESS_ERRORS.NOT_JOINED;
	}

	return THREAD_SEND_ACCESS_ERRORS.CANNOT_SEND;
}
