function CalculatorOutput({ result, energyUnit }) {
    const header =  <b>{`input energy | Stopping power[${energyUnit}] | CSDA Range`}</b>
    return (
        <div>
            {header}
            {result.map((val, key) => {
                return <div key={`output_${key}`}>{`${val.input} | ${val.energy} | ${val.csdaRange} ${val.unit}`} </div>
            })
            }
        </div>
    )
}

export default CalculatorOutput