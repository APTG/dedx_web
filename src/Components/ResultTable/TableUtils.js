import { uuidv4 } from '../../Backend/Utils'
import configureMeasurements, { allMeasures } from 'convert-units';

export function transformDataSeriesToTableData(ds) {
    return ds.map(ds => {
        const { name, stoppingPowers } = ds.data
        return {
            name,
            data: stoppingPowers,
            accessor: uuidv4(),
            precision: 3
        }
    })
}

function calculateRangeUnits(csdaRanges, isRangeDensityBased) {
    const units = new Array(csdaRanges.length)
    if (isRangeDensityBased) {
        units.fill('g/cm²')
        csdaRanges = csdaRanges.map(range => range.toExponential(3  ))
        return {newCsdaRanges: csdaRanges, units }
    }
    else {
        const convert = configureMeasurements(allMeasures);
        const newCsdaRanges = csdaRanges.map((range, key) => {
            const converted = convert(range).from('cm').toBest()
            units[key] = converted.unit
            return converted.val
        })
        return { newCsdaRanges, units }
    }

}

export function transformResultToTableData({ stoppingPowers, csdaRanges }, stoppingPowerUnit, isRangeDensityBased) {
    const {newCsdaRanges, units} = calculateRangeUnits(csdaRanges, isRangeDensityBased)
    return [
        {
            name: `Stopping power [${stoppingPowerUnit.name}]`,
            data: stoppingPowers,
            accessor: uuidv4(),
            precision: 3
        },
        {
            name: 'CSDA Range',
            data: newCsdaRanges,
            accessor: uuidv4(),
            precision: isRangeDensityBased ? undefined : 3
        },
        {
            name: 'Range unit',
            data: units,
            accessor: uuidv4()
        },
    ]
}

//adapted from https://stackoverflow.com/q/17428587
function transpose(valueArray) {
    if (valueArray.length < 1) return []
    const recordLength = valueArray[0].length
    const newArray = new Array(recordLength).fill().map(() => Array(valueArray.length))
    for (var i = 0; i < valueArray.length; i++) {
        for (var j = 0; j < recordLength; j++) {
            newArray[j][i] = valueArray[i][j];
        };
    };

    return newArray
}

// adapted from https://stackoverflow.com/a/14966131
export function getCSV(energies, values) {
    const valueArray = Array.from(Object.values(values))
    const datas = transpose(valueArray.map(ob=>ob.data))
    const csvContent = 'data:text/csv;charset=utf-8'
    + ',energies,' + valueArray.map(ob => ob.name).join(',') + '\n'
    + energies.map((value, key) => {
        return value + ',' + (datas[key].join(','))
    }).join('\n')
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'dedx_data.csv')
    document.body.appendChild(link); // Required for FireFox

    link.click();
}

// Some buttons need to be hidden if, for example, there's no data to download
export function getInvisibleStyle(shouldDisplay) {
    return shouldDisplay
        ? {}
        : { opacity: "0", pointerEvents: "none" }
}