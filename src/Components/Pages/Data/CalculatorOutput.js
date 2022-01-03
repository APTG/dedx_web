import ResultTable from "../../ResultTable/ResultTable"
import { transformResultToTableData } from "../../ResultTable/TableUtils"

function CalculatorOutput({ result, stoppingPowerUnit, isRangeDensityBased }) {
    const { energies } = result
    return (
        <ResultTable
            energies={energies}
            values={transformResultToTableData(result, stoppingPowerUnit, isRangeDensityBased)}
            shouldDisplay={energies && energies?.length !== 0}
        />
    )
}

export default CalculatorOutput