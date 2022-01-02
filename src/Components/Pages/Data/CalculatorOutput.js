import ResultTable from "../../ResultTable/ResultTable"
import { transformResultToTableData } from "../../ResultTable/TableUtils"

function CalculatorOutput({ result, stoppingPowerUnit }) {
    const { energies } = result

    console.log(energies)
    return (
        <ResultTable
            energies={energies}
            values={transformResultToTableData(result, stoppingPowerUnit)}
            shouldDisplay={energies && energies?.length !== 0}
        />
    )
}

export default CalculatorOutput