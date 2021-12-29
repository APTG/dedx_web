import { uuidv4 } from '../../Backend/Utils'

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

export function transformResultToTableData({ stoppingPowers, csdaRanges, units }, stoppingPowerUnit) {
    return [
        {
            name: `Stopping power[${stoppingPowerUnit.name}]`,
            data: stoppingPowers,
            accessor: uuidv4(),
            precision: 3
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