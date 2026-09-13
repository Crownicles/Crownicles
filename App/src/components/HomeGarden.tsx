import {ReactNode, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GardenInfoReq} from "ws-packets/src/fromClient/GardenReq";
import {GardenRes} from "ws-packets/src/fromServer/home/GardenRes";
import {GardenSnapshot, GardenCompostOffer, GardenOperation, GardenOutcome, GARDEN_OPERATIONS, GARDEN_ACCESS} from "ws-packets/src/objects/Garden";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {useGardenActions} from "@/src/store/useGardenActions";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Confirmation, KeyValue, Note, Panel, Row, SectionHeader, StatBar} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const PERCENTAGE_SCALE = 100;
type GardenSelection = {operation: GardenOperation; message: string};
type GardenActions = {pending: boolean; select: (selection: GardenSelection) => void};
type GardenPlot = GardenSnapshot["plots"][number];

function GardenPlotRow({plot, garden, actions}: {plot: GardenPlot; garden: GardenSnapshot; actions: GardenActions}): ReactNode {
	if (plot.plantId === 0) return <Row title={i18n.t("app:city.garden.plot", {slot: plot.slot + 1})} subtitle={i18n.t("app:city.garden.empty")} end={i18n.t("app:garden.plant")} disabled={actions.pending || !garden.eligibility.canPlantSeed} onPress={(): void => actions.select({operation: {type: GARDEN_OPERATIONS.PLANT, gardenSlot: plot.slot}, message: i18n.t("app:garden.confirmPlant", {plant: i18n.t(`models:plants.${garden.seedPlantId}`), slot: plot.slot + 1})})} />;
	const name = `${AppIcons.getIcon(`plants.${plot.plantId}`)} ${i18n.t(`models:plants.${plot.plantId}`)}`;
	return <StatBar label={i18n.t("app:city.garden.plotPlant", {slot: plot.slot + 1, plant: name})} value={i18n.t(plot.isReady ? "app:city.garden.ready" : "app:city.garden.growing", {progress: Math.round(plot.growthProgress * PERCENTAGE_SCALE)})} ratio={plot.growthProgress} color={Theme.colors.green} />;
}

function CompostOffers({offers, actions}: {offers: GardenCompostOffer[]; actions: GardenActions}): ReactNode {
	if (!offers.length) return null;
	return <>
		<SectionHeader>{i18n.t("app:garden.compost")}</SectionHeader>
		<Panel>{offers.map(offer => <Row key={`${offer.plantId}-${offer.quantity}`} title={`${AppIcons.getIcon(`plants.${offer.plantId}`)} ${i18n.t(`models:plants.${offer.plantId}`)}`} end={i18n.t("app:garden.quantity", {count: offer.quantity})} onPress={(): void => actions.select({operation: {type: GARDEN_OPERATIONS.COMPOST, ...offer}, message: i18n.t("app:garden.confirmCompost", {plant: i18n.t(`models:plants.${offer.plantId}`), count: offer.quantity})})} disabled={actions.pending} chevron />)}</Panel>
	</>;
}

function ReceivedMaterials({materials}: {materials: number[]}): ReactNode {
	const counts = new Map<number, number>();
	for (const materialId of materials) counts.set(materialId, (counts.get(materialId) ?? 0) + 1);
	return <Panel>{[...counts].map(([materialId, quantity]) => <KeyValue key={materialId} label={i18n.t(`models:materials.${materialId}`)} value={i18n.t("app:garden.quantity", {count: quantity})} />)}</Panel>;
}

function GardenResult({outcome}: {outcome: GardenOutcome | null}): ReactNode {
	if (!outcome) return null;
	switch (outcome.kind) {
		case "plant": return <Note>{i18n.t("app:garden.planted", {plant: i18n.t(`models:plants.${outcome.plantId}`), slot: outcome.gardenSlot + 1})}</Note>;
		case "water": return <Note>{i18n.t("app:garden.watered", {count: outcome.slotsWatered, ready: outcome.slotsBecameReady})}</Note>;
		case "harvest": return <><Note>{i18n.t("app:garden.harvested", {stored: outcome.plantsHarvested, composted: outcome.plantsComposted})}</Note><ReceivedMaterials materials={outcome.compostResults.map(result => result.materialId)} /></>;
		case "compost": return <><Note>{i18n.t("app:garden.composted", {count: outcome.quantity})}</Note><ReceivedMaterials materials={outcome.materials} /></>;
		case "notEnoughPlants": return <Note>{i18n.t("app:garden.notEnoughPlants")}</Note>;
		case "noAccess": return <Note>{i18n.t(`app:garden.noAccess.${outcome.reason}`)}</Note>;
		case "error": return <Note>{i18n.t(`app:garden.errors.${outcome.error}`)}</Note>;
		default: return null;
	}
}

function GardenContent({garden, offers}: {garden: GardenSnapshot; offers: GardenCompostOffer[]}): ReactNode {
	const {pending, message, submit, outcome} = useGardenActions();
	const [selection, setSelection] = useState<GardenSelection | null>(null);
	const actions = {pending, select: setSelection};
	const confirm = (): void => {
		if (!selection) return;
		setSelection(null);
		submit(selection.operation).catch(console.error);
	};
	return <>
		{garden.accessMode === GARDEN_ACCESS.READ_ONLY ? <Note>{i18n.t("app:garden.remote")}</Note> : null}
		{message ? <Note>{message}</Note> : null}
		<GardenResult outcome={outcome} />
		<Panel><KeyValue label={i18n.t("app:inventory.seed")} value={garden.hasSeed ? i18n.t(`models:plants.${garden.seedPlantId}`) : i18n.t("app:profile.values.none")} /><KeyValue label={i18n.t("app:city.summary.gardenPlots")} value={String(garden.totalPlots)} /></Panel>
		<SectionHeader>{i18n.t("app:garden.plots")}</SectionHeader>
		<Panel>{garden.plots.map(plot => <GardenPlotRow key={plot.slot} plot={plot} garden={garden} actions={actions} />)}</Panel>
		<ButtonRow>
			<Button variant="primary" disabled={pending || !garden.eligibility.canHarvest} onPress={(): Promise<void> => submit({type: GARDEN_OPERATIONS.HARVEST})}>{i18n.t("app:garden.harvest")}</Button>
			{garden.accessMode === GARDEN_ACCESS.FULL ? <Button disabled={pending || !garden.eligibility.canWaterGarden} onPress={(): Promise<void> => submit({type: GARDEN_OPERATIONS.WATER})}>{i18n.t("app:garden.water")}</Button> : null}
		</ButtonRow>
		<SectionHeader>{i18n.t("app:garden.storage")}</SectionHeader>
		<Panel>{garden.plantStorage.map(plant => <KeyValue key={plant.plantId} label={i18n.t(`models:plants.${plant.plantId}`)} value={i18n.t("app:equipment.capacity", {count: plant.quantity, max: plant.maxCapacity})} />)}{!garden.plantStorage.length ? <Note>{i18n.t("app:homeChest.noStoredPlants")}</Note> : null}</Panel>
		<CompostOffers offers={offers} actions={actions} />
		{selection ? <Confirmation title={i18n.t(`app:garden.${selection.operation.type}`)} message={selection.message} onRequestClose={(): void => setSelection(null)}><ButtonRow><Button variant="primary" disabled={pending} onPress={confirm}>{i18n.t("app:collector.accept")}</Button><Button onPress={(): void => setSelection(null)}>{i18n.t("app:collector.refuse")}</Button></ButtonRow></Confirmation> : null}
	</>;
}

export function HomeGarden(): ReactNode {
	const queryClient = useQueryClient();
	const state = useGameQuery(GAME_ENTITIES.GARDEN, () => GameClient.request(makeFromClientPacket(GardenInfoReq, {}), GardenRes));
	return <>
		<GameQueryContent state={state} entity={GAME_ENTITIES.GARDEN}>{packet => packet.outcome.kind === "snapshot" ? <GardenContent garden={packet.outcome.garden} offers={packet.outcome.compostOffers} /> : <GardenResult outcome={packet.outcome} />}</GameQueryContent>
		<ButtonRow><Button onPress={(): void => {queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.GARDEN)}).catch(console.error);}}>{i18n.t("app:garden.refresh")}</Button></ButtonRow>
	</>;
}