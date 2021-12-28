import ResultTable from "../ResultTable/ResultTable"
import { transformResultToTableData } from "../ResultTable/TableUtils"

function CalculatorOutput({ result, stoppingPowerUnit }) {
    const { energies } = result
    return (
        <div>
            {energies && <ResultTable
                energies={result.energies}
                values={transformResultToTableData(result, stoppingPowerUnit)}
            />}
        </div>
    )
}

export default CalculatorOutput