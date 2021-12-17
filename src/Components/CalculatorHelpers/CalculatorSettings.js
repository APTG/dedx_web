import Dropdown from '../Form/Dropdown'
import Toggle from '../Toggle'

function dropdownRenderFunction(name){
    return ([key,element]) => <option value={element} key={`${name}_${key}`}>{`${key} (${element})`}</option>
}

function CalculatorSettings({ onChanges, inputUnits, outputUnits }) {
    const {onInputUnitChange, onOutputUnitChange, onOperationModeChange} = onChanges
    return (<div>
        <Toggle name='Operation mode' onChange={onOperationModeChange} startValue={0}>
            <>Performance</>
            <>Dynamic</>
        </Toggle>

        <Dropdown name={'Input unit'} data={inputUnits} onChange={onInputUnitChange} elementDisplayFunc={dropdownRenderFunction}/>
        <Dropdown name={'Output unit'} data={outputUnits} onChange={onOutputUnitChange} elementDisplayFunc={dropdownRenderFunction}/>
    </div>)
}

export default CalculatorSettings