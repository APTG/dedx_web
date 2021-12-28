import { uuidv4 } from "../../Backend/Utils"

export function transformDataSeriesToTableData(ds) {
    return ds.map(ds => {
        const { name, stoppingPowers } = ds.data
        return {
            name,
            data: stoppingPowers,
            accessor: uuidv4()
        }
    })
}

export function transformResultToTableData({ stoppingPowers, csdaRanges, units }, stoppingPowerUnit) {
    return [
        {
            name: `Stopping power[${stoppingPowerUnit.name}]`,
            data: stoppingPowers,
            accessor: uuidv4()
        },
        {
            name: 'CSDA Ranges',
            data: csdaRanges,
            accessor: uuidv4()
        },
        {
            name: 'Range units',
            data: units,
            accessor: uuidv4()
        },
    ]
}