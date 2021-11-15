const traceStyle = color => {
    return {
        background: color,
        minWidth: 10,
        height: 10,
        marginRight:0
    }
}

const containerStyle = isShown => {
    return {
        opacity: isShown ? "1.0" : "0.3",
        display: "flex",
        flexDirection: "row",
        gap: 5,
        alignItems: "center",
        maxWidth: "12",
        overflowWrap: "break-word",
        overflow:"hidden"
    }
}

function TraceList({ traces, onTraceStateChange }) {

    return (
        <div className="gridish12ch">
            {
                traces.map((trace, key) => {
                    return (<div style={containerStyle(trace.isShown)} id={key} onClick={onTraceStateChange} key={`Trace_${key}`}>
                        <span style={traceStyle(trace.color)} />
                        {trace.name}
                    </div>)
                })
            }
        </div>
    )
}

export default TraceList