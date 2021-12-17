function CalculatorOutput({ result }) {

    return (
        <div>
            {result.map((val, key) => {
                return <div key={`output_${key}`}>{`${val.input} = ${val.output}${val.unit}`} </div>
            })
            }
        </div>
    )
}

export default CalculatorOutput