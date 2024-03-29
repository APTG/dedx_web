const dataSeriesStyle = color => {
    return {
        background: color,
        minWidth: 10,
        height: 10,
        marginRight: 0
    }
}

const containerStyle = isShown => {
    return {
        opacity: isShown ? "1.0" : "0.3",
        display: "flex",
        flexDirection: "row",
        gap: 5,
        alignItems: "center",
        overflowWrap: "break-word",
        overflow: "hidden"
    }
}

function DataSeriesList({previewSeries, dataSeries, onDataSeriesStateChange }) {
    return (
        <div style={{display:'flex', gap:'10px', flexDirection:'column'}}>
            { previewSeries &&
                [previewSeries, ...dataSeries].map((dataSeries, k) => {
                    return (<div style={containerStyle(dataSeries.isShown)} id={dataSeries.seriesNumber} onClick={onDataSeriesStateChange} key={`Trace_${dataSeries.seriesNumber}`}>
                        <span style={dataSeriesStyle(dataSeries.color)} />
                        {dataSeries.name + (k===0?' [preview]':'')}
                    </div>)
                })
            }
        </div>
    )
}

export default DataSeriesList