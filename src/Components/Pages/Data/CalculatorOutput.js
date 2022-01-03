import ResultTable from "../../ResultTable/ResultTable"
import { transformResultToTableData } from "../../ResultTable/TableUtils"

function CalculatorOutput({ result, stoppingPowerUnit, isRangeDensityBased }) {
    const { energies } = result
    return (
        <div>
            {energies?.length ? <ResultTable
                energies={result.energies}
                values={transformResultToTableData(result, stoppingPowerUnit, isRangeDensityBased)}
            />:<></>}
        </div>
    )
}

export default CalculatorOutput