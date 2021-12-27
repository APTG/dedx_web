function CalculatorOutput({ result, stoppingPowerUnit }) {
    const header =  <b>{`input energy | Stopping power[${stoppingPowerUnit.name}] | CSDA Range`}</b>
    const {energies, stoppingPowers, csdaRanges, units} = result
    return (
        <div>
            {header}
            {energies && energies.map((val, key) => {
                return <div key={`output_${key}`}>{`${val} | ${stoppingPowers[key]} | ${csdaRanges[key]} ${units[key]}ρ`} </div>
            })
            }
        </div>
    )
}

export default CalculatorOutput