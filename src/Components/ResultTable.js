function transformTraces(traces){
    const keys = new Set(traces.map(t=>t.x).flat(1))
    return [...keys].map(key=>{return{key}})
}

function ResultTable({traces}){
    console.log(traces)

    const transformedTraces = transformTraces(traces)

    return(
        <table>
            <tr>
                <th>Energy</th>
                {traces.map((trace,key)=>{
                    return(<th key={`traceHeader_${key}`}>Power - {trace.name}</th>)
                })}
            </tr>
            {transformedTraces.map((transformTrace, key)=>{
                return(<tr key={`traceRow_${key}`}>
                    <td>{transformTrace.key}</td>
                </tr>)
            })}

        </table>
    )
}

export default ResultTable