function CalculatorOutput({ result, energyUnit }) {
    const header =  <b>{`input energy | Stopping power[${energyUnit}] | CSDA Range`}</b>
    const {energies, powers, csda, units} = result
    return (
        <div>
            {header}
            {energies && energies.map((val, key) => {
                return <div key={`output_${key}`}>{`${val} | ${powers[key]} | ${csda[key]} ${units[key]}ρ`} </div>
            })
            }
        </div>
    )
}

export default CalculatorOutput