import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {RespawnReq, UnlockReq, VersionReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {PlayerUtilityRes, VersionRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {PingReq} from "ws-packets/src/fromClient/PingReq";
import {PingRes} from "ws-packets/src/fromServer/ping/PingRes";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Confirmation, KeyValue, Note, Panel, SectionHeader} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {i18n} from "@/src/translations/i18n";

const UTILITY_MENUS = {
	respawn: {request: RespawnReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [PlayerUtilityRes]},
	unlock: {request: UnlockReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [PlayerUtilityRes]}
} satisfies Record<string, CommandMenu>;

export function RespawnAction(): ReactNode {
	const [confirming, setConfirming] = useState(false);
	const {pending, message, open} = useCommandMenus();
	return <>
		<ButtonRow><Button disabled={pending} onPress={(): void => setConfirming(true)}>{i18n.t("app:utilities.respawn")}</Button></ButtonRow>
		{message ? <Note>{message}</Note> : null}
		{confirming ? <Confirmation title={i18n.t("app:utilities.respawn")} message={i18n.t("app:utilities.respawnWarning")} onRequestClose={(): void => setConfirming(false)}>
			<ButtonRow>
				<Button variant="primary" disabled={pending} onPress={(): void => {setConfirming(false); open(UTILITY_MENUS.respawn).catch(console.error);}}>{i18n.t("app:collector.accept")}</Button>
				<Button onPress={(): void => setConfirming(false)}>{i18n.t("app:collector.refuse")}</Button>
			</ButtonRow>
		</Confirmation> : null}
	</>;
}

function PrisonerRelease(): ReactNode {
	const [rank, setRank] = useState("");
	const {pending, message, open} = useCommandMenus();
	const rankValue = Number(rank);
	return <>
		<SectionHeader>{i18n.t("app:utilities.unlock")}</SectionHeader>
		<TextField label={i18n.t("app:utilities.prisonerRank")} value={rank} onChangeText={setRank} keyboardType="number-pad" />
		<ButtonRow><Button disabled={pending || !Number.isSafeInteger(rankValue) || rankValue < 1} onPress={(): Promise<void> => open(UTILITY_MENUS.unlock, makeFromClientPacket(UnlockReq, {rank: rankValue}))}>{i18n.t("app:utilities.unlock")}</Button></ButtonRow>
		{message ? <Note>{message}</Note> : null}
	</>;
}

function ConnectionInformation(): ReactNode {
	const version = useGameQuery(GAME_ENTITIES.VERSION, () => GameClient.request(makeFromClientPacket(VersionReq, {}), VersionRes));
	const ping = useGameQuery<PingRes>(GAME_ENTITIES.PING, () => GameClient.request(makeFromClientPacket(PingReq, {time: Date.now()}), PingRes).then(answer => answer.kind === "answer" ? {...answer, packet: {...answer.packet, time: Date.now() - answer.packet.time}} : answer));
	return <>
		<SectionHeader>{i18n.t("app:utilities.connection")}</SectionHeader>
		<GameQueryContent state={version} entity={GAME_ENTITIES.VERSION}>{packet => <Panel><KeyValue label={i18n.t("app:utilities.coreVersion")} value={packet.coreVersion} /></Panel>}</GameQueryContent>
		<GameQueryContent state={ping} entity={GAME_ENTITIES.PING}>{packet => <Panel><KeyValue label={i18n.t("app:utilities.latency")} value={i18n.t("app:utilities.latencyValue", {time: packet.time})} /></Panel>}</GameQueryContent>
	</>;
}

export function Utilities(): ReactNode {
	return <>
		<PrisonerRelease />
		<SectionHeader>{i18n.t("app:utilities.respawn")}</SectionHeader>
		<RespawnAction />
		<ConnectionInformation />
	</>;
}
