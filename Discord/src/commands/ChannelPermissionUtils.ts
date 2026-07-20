import { ChannelType } from "discord.js";

export const THREAD_SEND_ACCESS_ERRORS = {
	NOT_JOINED: "noThreadMembership",
	CANNOT_SEND: "noSpeakInThreadPermission"
} as const;

export type ThreadSendAccessError = typeof THREAD_SEND_ACCESS_ERRORS[keyof typeof THREAD_SEND_ACCESS_ERRORS];

type ThreadAwareChannel = {
	isThread(): boolean;
	readonly sendable?: boolean;
	readonly type?: ChannelType;
	readonly joined?: boolean;
	readonly manageable?: boolean;
};

export function getThreadSendAccessError(channel: ThreadAwareChannel): ThreadSendAccessError | null {
	if (!channel.isThread() || channel.sendable === true) {
		return null;
	}

	if (channel.type === ChannelType.PrivateThread && channel.joined === false && channel.manageable === false) {
		return THREAD_SEND_ACCESS_ERRORS.NOT_JOINED;
	}

	return THREAD_SEND_ACCESS_ERRORS.CANNOT_SEND;
}
