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

function DataSeriesList({ dataSeries, onDataSeriesStateChange }) {

    return (
        <div className="gridish12ch">
            {
                dataSeries.map((dataSeries, key) => {
                    return (<div style={containerStyle(dataSeries.isShown)} id={key} onClick={onDataSeriesStateChange} key={`Trace_${key}`}>
                        <span style={dataSeriesStyle(dataSeries.color)} />
                        {dataSeries.name}
                    </div>)
                })
            }
        </div>
    )
}

export default DataSeriesList