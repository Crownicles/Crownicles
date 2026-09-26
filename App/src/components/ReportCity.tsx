import {ReactNode} from "react";
import {ReportCityView} from "ws-packets/src/objects/ReportView";
import {CITY_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {CityMenu} from "@/src/collectors/CityCollector";
import {Note} from "@/src/design/Primitives";
import {useReportCityAction} from "@/src/store/useReportActions";

export function ReportCity({city}: {city: ReportCityView}): ReactNode {
	const {submit, pending, message} = useReportCityAction();
	if (city.data.type !== CITY_DATA_KINDS.CITY) return null;
	const mapLocationId = city.data.data.mapLocationId;
	const choose = (index: number): void => {
		const action = city.actions[index];
		if (action) submit({mapLocationId, actionId: action.id}).catch(console.error);
	};
	return <>
		{message ? <Note>{message}</Note> : null}
		<CityMenu key={mapLocationId} collector={{data: city.data, reactions: city.actions.map(action => action.reaction)}} onChoose={choose} submitting={pending} />
	</>;
}