import Dropdown from '../Form/Dropdown'
import Toggle from '../Toggle'

function dropdownRenderFunction(name){
    return ([key,element]) => <option value={element} key={`${name}_${key}`}>{`${key} (${element})`}</option>
}

function CalculatorSettings({ onChanges, inputUnits, outputUnits }) {
    const {onHistoryChange, onInputUnitChange, onOutputUnitChange} = onChanges
    return (<div>
        <Toggle name={'Use calculation history'} startValue={0} onChange={onHistoryChange}>
            <>On</>
            <>Off</>
        </Toggle>

        <Dropdown name={'Input unit'} data={inputUnits} onChange={onInputUnitChange} elementDisplayFunc={dropdownRenderFunction}/>
        <Dropdown name={'Output unit'} data={outputUnits} onChange={onOutputUnitChange} elementDisplayFunc={dropdownRenderFunction}/>
    </div>)
}

export default CalculatorSettings