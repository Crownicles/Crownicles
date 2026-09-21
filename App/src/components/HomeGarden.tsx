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
import {Button, ButtonRow, Confirmation, Note, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {materialName, plantName} from "@/src/display/Resources";
import {i18n} from "@/src/translations/i18n";
import {EntryRow, ExpandableList, Fact, Gauge} from "@/src/design/Sections";

const PERCENTAGE_SCALE = 100;
type GardenSelection = {operation: GardenOperation; message: string};
type GardenActions = {pending: boolean; select: (selection: GardenSelection) => void; submit: (operation: GardenOperation) => Promise<void>};
type GardenPlot = GardenSnapshot["plots"][number];

function GardenPlotRow({plot, garden, actions}: {plot: GardenPlot; garden: GardenSnapshot; actions: GardenActions}): ReactNode {
	if (plot.plantId === 0) return <EntryRow title={i18n.t("app:city.garden.plot", {slot: plot.slot + 1})} subtitle={i18n.t("app:city.garden.empty")} end={i18n.t("app:garden.plant")} disabled={actions.pending || !garden.eligibility.canPlantSeed} onPress={(): void => actions.select({operation: {type: GARDEN_OPERATIONS.PLANT, gardenSlot: plot.slot}, message: i18n.t("app:garden.confirmPlant", {plant: plantName(garden.seedPlantId), slot: plot.slot + 1})})} />;
	const name = plantName(plot.plantId);
	return <Gauge label={i18n.t("app:city.garden.plotPlant", {slot: plot.slot + 1, plant: name})} value={i18n.t(plot.isReady ? "app:city.garden.ready" : "app:city.garden.growing", {progress: Math.round(plot.growthProgress * PERCENTAGE_SCALE)})} ratio={plot.growthProgress} color={Theme.colors.green} />;
}

function CompostOffers({offers, actions}: {offers: GardenCompostOffer[]; actions: GardenActions}): ReactNode {
	if (!offers.length) return null;
	return <>
		<SectionHeader>{i18n.t("app:garden.compost")}</SectionHeader>
		<ExpandableList>{offers.map(offer => <EntryRow key={`${offer.plantId}-${offer.quantity}`} title={plantName(offer.plantId)} end={i18n.t("app:garden.quantity", {count: offer.quantity})} onPress={(): void => actions.select({operation: {type: GARDEN_OPERATIONS.COMPOST, ...offer}, message: i18n.t("app:garden.confirmCompost", {plant: plantName(offer.plantId), count: offer.quantity})})} disabled={actions.pending}  />)}</ExpandableList>
	</>;
}

function ReceivedMaterials({materials}: {materials: number[]}): ReactNode {
	const counts = new Map<number, number>();
	for (const materialId of materials) counts.set(materialId, (counts.get(materialId) ?? 0) + 1);
	return <ExpandableList>{[...counts].map(([materialId, quantity]) => <Fact key={materialId} label={materialName(materialId)} value={i18n.t("app:garden.quantity", {count: quantity})} />)}</ExpandableList>;
}

function GardenResult({outcome}: {outcome: GardenOutcome | null}): ReactNode {
	if (!outcome) return null;
	switch (outcome.kind) {
		case "plant": return <Note>{i18n.t("app:garden.planted", {plant: plantName(outcome.plantId), slot: outcome.gardenSlot + 1})}</Note>;
		case "water": return <Note>{i18n.t("app:garden.watered", {count: outcome.slotsWatered, ready: outcome.slotsBecameReady})}</Note>;
		case "harvest": return <><Note>{i18n.t("app:garden.harvested", {stored: outcome.plantsHarvested, composted: outcome.plantsComposted})}</Note><ReceivedMaterials materials={outcome.compostResults.map(result => result.materialId)} /></>;
		case "compost": return <><Note>{i18n.t("app:garden.composted", {count: outcome.quantity})}</Note><ReceivedMaterials materials={outcome.materials} /></>;
		case "notEnoughPlants": return <Note>{i18n.t("app:garden.notEnoughPlants")}</Note>;
		case "noAccess": return <Note>{i18n.t(`app:garden.noAccess.${outcome.reason}`)}</Note>;
		case "error": return <Note>{i18n.t(`app:garden.errors.${outcome.error}`)}</Note>;
		default: return null;
	}
}

function GardenPlots({garden, actions}: {garden: GardenSnapshot; actions: GardenActions}): ReactNode {
	return <>
		<ExpandableList><Fact label={i18n.t("app:inventory.seed")} value={garden.hasSeed ? plantName(garden.seedPlantId) : i18n.t("app:profile.values.none")} /><Fact label={i18n.t("app:city.summary.gardenPlots")} value={String(garden.totalPlots)} /></ExpandableList>
		<SectionHeader>{i18n.t("app:garden.plots")}</SectionHeader>
		<ExpandableList>{garden.plots.map(plot => <GardenPlotRow key={plot.slot} plot={plot} garden={garden} actions={actions} />)}</ExpandableList>
		<ButtonRow>
			<Button variant="primary" disabled={actions.pending || !garden.eligibility.canHarvest} onPress={(): Promise<void> => actions.submit({type: GARDEN_OPERATIONS.HARVEST})}>{i18n.t("app:garden.harvest")}</Button>
			{garden.accessMode === GARDEN_ACCESS.FULL ? <Button disabled={actions.pending || !garden.eligibility.canWaterGarden} onPress={(): Promise<void> => actions.submit({type: GARDEN_OPERATIONS.WATER})}>{i18n.t("app:garden.water")}</Button> : null}
		</ButtonRow>
	</>;
}

function GardenStorage({plants}: {plants: GardenSnapshot["plantStorage"]}): ReactNode {
	return <>
		<SectionHeader>{i18n.t("app:garden.storage")}</SectionHeader>
		<ExpandableList>{plants.map(plant => <Fact key={plant.plantId} label={plantName(plant.plantId)} value={i18n.t("app:equipment.capacity", {count: plant.quantity, max: plant.maxCapacity})} />)}{!plants.length ? <Note>{i18n.t("app:homeChest.noStoredPlants")}</Note> : null}</ExpandableList>
	</>;
}

function GardenConfirmation({selection, pending, onConfirm, onClose}: {selection: GardenSelection; pending: boolean; onConfirm: () => void; onClose: () => void}): ReactNode {
	return <Confirmation title={i18n.t(`app:garden.${selection.operation.type}`)} message={selection.message} onRequestClose={onClose}><ButtonRow><Button variant="primary" disabled={pending} onPress={onConfirm}>{i18n.t("app:collector.accept")}</Button><Button onPress={onClose}>{i18n.t("app:collector.refuse")}</Button></ButtonRow></Confirmation>;
}

function GardenContent({garden, offers}: {garden: GardenSnapshot; offers: GardenCompostOffer[]}): ReactNode {
	const {pending, message, submit, outcome} = useGardenActions();
	const [selection, setSelection] = useState<GardenSelection | null>(null);
	const actions = {pending, select: setSelection, submit};
	const confirm = (): void => {
		if (!selection) return;
		setSelection(null);
		submit(selection.operation).catch(console.error);
	};
	return <>
		{garden.accessMode === GARDEN_ACCESS.READ_ONLY ? <Note>{i18n.t("app:garden.remote")}</Note> : null}
		{message ? <Note>{message}</Note> : null}
		<GardenResult outcome={outcome} />
		<GardenPlots garden={garden} actions={actions} />
		<GardenStorage plants={garden.plantStorage} />
		<CompostOffers offers={offers} actions={actions} />
		{selection ? <GardenConfirmation selection={selection} pending={pending} onConfirm={confirm} onClose={(): void => setSelection(null)} /> : null}
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