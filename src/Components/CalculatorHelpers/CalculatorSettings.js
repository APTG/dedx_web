import Dropdown from '../Form/Dropdown'
import Toggle from '../Toggle'

function dropdownRenderFunction(name) {
    return ([key, element]) => <option value={element} key={`${name}_${key}`}>{element}</option>
}

function elementRenderFunction(name){
    return (element,key) => <option value={element.code} key={`${name}_${key}`}>{element.name}</option>
}

function CalculatorSettings({ onChanges, inputUnits, outputUnits, programs, ions, materials }) {
    const { onInputUnitChange, onOutputUnitChange, onOperationModeChange, onProgramChange, onIonChange, onMaterialChange } = onChanges
    return (<div>
        <Toggle name='Operation mode' onChange={onOperationModeChange} startValue={0}>
            <>Dynamic</>
            <>Performance</>
        </Toggle>

        <Dropdown name={'Input unit'} data={inputUnits} onChange={onInputUnitChange} elementDisplayFunc={dropdownRenderFunction} />
        <Dropdown name={'Stopping power unit'} data={outputUnits} onChange={onOutputUnitChange} elementDisplayFunc={dropdownRenderFunction} />
        <Dropdown name="Program" data={programs} onchange={onProgramChange}
            elementDisplayFunc={elementRenderFunction} />
        <Dropdown name="Ion" data={ions} onchange={onIonChange} elementDisplayFunc={elementRenderFunction} />
        <Dropdown name="Material" data={materials} onchange={onMaterialChange}
            elementDisplayFunc={elementRenderFunction} />

    </div>)
}

export default CalculatorSettings