import {ReactNode, useEffect, useState} from "react";
import {Image, Modal, Pressable, StyleSheet} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {MapReq} from "ws-packets/src/fromClient/MapReq";
import {MapRes} from "ws-packets/src/fromServer/report/MapRes";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {MapViewer} from "@/src/components/MapViewer";
import {Button, Note} from "@/src/design/Primitives";
import {LockHint, Standing} from "@/src/design/Sections";
import {Maximize2} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {AppIcons} from "@/src/AppIcons";

const DEFAULT_MAP_RATIO = 4 / 3;
const styles = StyleSheet.create({
	map: {width: "100%", backgroundColor: Theme.colors.wash},
	frame: {borderRadius: 12, borderWidth: 1, borderColor: Theme.colors.line, overflow: "hidden", backgroundColor: Theme.colors.wash}
});

export function MapImage({packet}: {packet: MapRes}): ReactNode {
	const [uri, setUri] = useState(packet.imageUrl);
	const [failed, setFailed] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [ratio, setRatio] = useState(DEFAULT_MAP_RATIO);
	useEffect(() => {
		let active = true;
		Image.getSize(uri, (width, height): void => {
			if (!active) return;
			if (width <= 0 || height <= 0) return;
			setRatio(width / height);
		}, () => undefined);
		return (): void => {active = false;};
	}, [uri]);
	const fail = (): void => {
		if (packet.fallbackImageUrl && uri !== packet.fallbackImageUrl) setUri(packet.fallbackImageUrl);
		else setFailed(true);
	};
	if (failed) return <>
		<Note>{i18n.t("app:map.imageError")}</Note>
		<Button onPress={(): void => {setFailed(false); setUri(packet.imageUrl);}}>{i18n.t("app:common.retry")}</Button>
	</>;
	return <>
		<Pressable style={styles.frame} accessibilityRole="button" accessibilityLabel={i18n.t("app:map.expand")} onPress={(): void => setExpanded(true)}>
			<Image accessibilityLabel={i18n.t("app:map.image")} source={{uri}} style={[styles.map, {aspectRatio: ratio}]} resizeMode="contain" onError={fail} />
		</Pressable>
		<LockHint lock={{reason: i18n.t("app:map.expandHint"), icon: Maximize2}} />
		<Modal visible={expanded} animationType="slide" onRequestClose={(): void => setExpanded(false)}>
			<MapViewer uri={uri} ratio={ratio} onClose={(): void => setExpanded(false)} onError={fail} />
		</Modal>
	</>;
}

/** The map is one picture of one place: the banner names it, the picture shows it, nothing else. */
export function WorldMapContent({packet}: {packet: MapRes}): ReactNode {
	const emblem = AppIcons.getIconOrNull(`mapTypes.${packet.mapType}`);
	return <Standing
		{...emblem ? {emblem: <TwemojiIcon emoji={emblem} size={Theme.dimensions.headerIcon} />} : {}}
		caption={i18n.t(packet.hasArrived ? "app:map.position" : "app:map.destination")}
		title={i18n.t(`models:map_locations.${packet.mapId}.name`)}
		subtitle={i18n.t(`models:map_locations.${packet.mapId}.description`)}
	>
		<MapImage key={packet.imageUrl} packet={packet} />
	</Standing>;
}

export function WorldMap(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.MAP, () => GameClient.request(makeFromClientPacket(MapReq, {language: i18n.language}), MapRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.MAP}>{packet => <WorldMapContent packet={packet} />}</GameQueryContent>;
}
