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
