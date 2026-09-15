import {ReactNode, useEffect, useState} from "react";
import {Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {MapReq} from "ws-packets/src/fromClient/MapReq";
import {MapRes} from "ws-packets/src/fromServer/report/MapRes";
import {MapCity} from "ws-packets/src/objects/MapCity";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, KeyValue, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {AppIcons} from "@/src/AppIcons";

const MAX_MAP_ZOOM = 4;
const DEFAULT_MAP_RATIO = 4 / 3;
const styles = StyleSheet.create({
	map: {width: "100%", backgroundColor: Theme.colors.paper},
	root: {flex: 1, backgroundColor: Theme.colors.wash},
	toolbar: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, padding: Theme.spacing.md},
	zoom: {minWidth: Theme.dimensions.actionButtonMinWidth, minHeight: Theme.dimensions.actionButtonMinWidth, alignItems: "center", justifyContent: "center"},
	symbol: {fontSize: Theme.fontSize.title, color: Theme.colors.ink},
	pan: {flex: 1}
});

function MapZoom({uri, ratio, onClose, onError}: {uri: string; ratio: number; onClose: () => void; onError: () => void}): ReactNode {
	const [zoom, setZoom] = useState(1);
	const {width} = useWindowDimensions();
	return <SafeAreaView style={styles.root}>
		<View style={styles.toolbar}>
			<Button onPress={onClose}>{i18n.t("app:common.back")}</Button>
			<Pressable style={styles.zoom} accessibilityRole="button" accessibilityLabel={i18n.t("app:map.zoomOut")} disabled={zoom <= 1} onPress={(): void => setZoom(zoom - 1)}><Text style={styles.symbol}>-</Text></Pressable>
			<Pressable style={styles.zoom} accessibilityRole="button" accessibilityLabel={i18n.t("app:map.zoomIn")} disabled={zoom >= MAX_MAP_ZOOM} onPress={(): void => setZoom(zoom + 1)}><Text style={styles.symbol}>+</Text></Pressable>
		</View>
		<ScrollView style={styles.pan}><ScrollView horizontal><Image source={{uri}} accessibilityLabel={i18n.t("app:map.image")} style={{width: width * zoom, height: width * zoom / ratio}} resizeMode="contain" onError={onError} /></ScrollView></ScrollView>
	</SafeAreaView>;
}

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
		<Pressable accessibilityRole="button" accessibilityLabel={i18n.t("app:map.expand")} onPress={(): void => setExpanded(true)}>
			<Image accessibilityLabel={i18n.t("app:map.image")} source={{uri}} style={[styles.map, {aspectRatio: ratio}]} resizeMode="contain" onError={fail} />
		</Pressable>
		<Modal visible={expanded} animationType="slide" onRequestClose={(): void => setExpanded(false)}>
			<MapZoom uri={uri} ratio={ratio} onClose={(): void => setExpanded(false)} onError={fail} />
		</Modal>
	</>;
}

function cityServices(city: MapCity): string {
	const services = city.services.map(service => i18n.t(service === "bossArchivist" ? "commands:report.city.bossArchivist.serviceTitle" : `commands:report.city.${service}.menuLabel`, {defaultValue: i18n.t("app:map.service")}));
	const shops = city.shops.map(shop => i18n.t(`commands:report.city.shops.${shop}.label`));
	return [...services, ...shops].join(" · ");
}

export function WorldMapContent({packet}: {packet: MapRes}): ReactNode {
	return <>
		<MapImage key={packet.imageUrl} packet={packet} />
		<Panel><KeyValue label={i18n.t(packet.hasArrived ? "app:map.position" : "app:map.destination")} value={`${AppIcons.getIcon(`mapTypes.${packet.mapType}`)} ${i18n.t(`models:map_locations.${packet.mapId}.name`)}`} /></Panel>
		<Note>{i18n.t(`models:map_locations.${packet.mapId}.description`)}</Note>
		<SectionHeader>{i18n.t("app:map.cities")}</SectionHeader>
		<Panel>{packet.cities.map(city => <Row key={city.id} title={i18n.t(`models:map_locations.${city.mapLocationId}.name`)} subtitle={cityServices(city)} />)}</Panel>
	</>;
}

export function WorldMap(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.MAP, () => GameClient.request(makeFromClientPacket(MapReq, {language: i18n.language}), MapRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.MAP}>{packet => <WorldMapContent packet={packet} />}</GameQueryContent>;
}
