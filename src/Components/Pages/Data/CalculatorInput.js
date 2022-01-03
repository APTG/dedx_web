import { useRef } from "react"
import { getInvisibleStyle } from "../../ResultTable/TableUtils"
import Toggle from '../../Utils/Toggle'

function CalculatorInput({ onSubmit, onInputChange, generateDefaults, onOperationModeChange, onDownloadCSV, displayDownload }) {

    const ref = useRef(null)

    const onDefaultGenerate = async () => ref.current.value = await generateDefaults()

    return (<form name="calc-form" className="gridish row-flex flex-medium" onSubmit={onSubmit} style={{ gap: 10 }}>
        <div className="input-wrapper column-flex" style={{ padding: 10 }}>
            <label>Input energies in MeV/nucl separated by new-line</label>
            <textarea ref={ref} name="calc-input" id="inputvalue" className="input-box" onChange={onInputChange} style={{ height: 340 }} />
        </div>


        <div className="column-flex" style={{ padding: 10, justifyContent:'space-between' }}>
            <div className="gridish column-flex flex-xs gap1">
                <button className="button" onClick={onDefaultGenerate} style={{ margin: 0 }}>Generate default energies</button>
                <button style={getInvisibleStyle(displayDownload)} onClick={onDownloadCSV} className="button">Download table data</button>
                <button style={getInvisibleStyle(!onInputChange)} className="button" type="submit">Submit</button>

            </div>
            <Toggle name='Operation mode' onChange={onOperationModeChange} startValue={0}>
                <>Dynamic</>
                <>Performance</>
            </Toggle>

        </div>


    </form>)
}

export default CalculatorInput