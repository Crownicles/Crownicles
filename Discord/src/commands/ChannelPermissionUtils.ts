type ThreadAwareChannel = {
	isThread(): boolean;
	readonly sendable?: boolean;
};

export function hasThreadSendAccess(channel: ThreadAwareChannel): boolean {
	return !channel.isThread() || channel.sendable === true;
}
