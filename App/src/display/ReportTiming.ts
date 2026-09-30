import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";

export function isAlterationReport(packet: ReportTravelSummaryRes): boolean {
	return packet.effect !== undefined && packet.effect !== "none";
}

/** Arriving opens the report too, so a stop planned after the arrival never delays it; an alteration holds it until it ends. */
export function reportOpensAt(packet: ReportTravelSummaryRes): number {
	const nextStopOrArrival = Math.min(packet.nextStopTime, packet.arriveTime);
	return isAlterationReport(packet) ? Math.max(nextStopOrArrival, packet.effectEndTime ?? 0) : nextStopOrArrival;
}

/** When the next report can be opened; in a city only the end of an alteration is awaited. */
export function reportReadyAt(packet: ReportTravelSummaryRes): number | undefined {
	return packet.isInCity ? packet.effectEndTime : reportOpensAt(packet);
}

/** Where the wait for the next report started: the alteration holding it, or else the last stop. */
function reportWaitStart(packet: ReportTravelSummaryRes): number {
	return isAlterationReport(packet) && packet.effectEndTime !== undefined && packet.effectDuration !== undefined
		? packet.effectEndTime - packet.effectDuration
		: packet.lastStopTime;
}

/** How much of the wait for the next report, stop, arrival or end of an alteration, has gone by. */
export function reportWaitProgress(packet: ReportTravelSummaryRes, currentTime: number): number | undefined {
	const readyAt = reportReadyAt(packet);
	if (readyAt === undefined) return undefined;
	const start = reportWaitStart(packet);
	const wait = readyAt - start;
	if (wait <= 0) return 1;
	return Math.min(Math.max((currentTime - start) / wait, 0), 1);
}
