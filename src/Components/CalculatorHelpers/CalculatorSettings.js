import Dropdown from '../Form/Dropdown'
import Toggle from '../Toggle'

function dropdownRenderFunction(name) {
    return ([key, element]) => <option value={element} key={`${name}_${key}`}>{element}</option>
}

function elementRenderFunction(name){
    return (element,key) => <option value={element.code} key={`${name}_${key}`}>{element.name}</option>
}

function CalculatorSettings({ onChanges, outputUnits, programs, ions, materials, program, ion, material }) {
    const { onOutputUnitChange, onOperationModeChange, onProgramChange, onIonChange, onMaterialChange } = onChanges
    return (<div>
        <Toggle name='Operation mode' onChange={onOperationModeChange} startValue={0}>
            <>Dynamic</>
            <>Performance</>
        </Toggle>

        {/* <Dropdown name={'Input unit'} data={inputUnits} onChange={onInputUnitChange} elementDisplayFunc={dropdownRenderFunction} /> */}
        <Dropdown name={'Stopping power unit'} data={outputUnits} onChange={onOutputUnitChange} elementDisplayFunc={dropdownRenderFunction} />
        <Dropdown value={program.code} name="Program" data={programs} onChange={onProgramChange}
            elementDisplayFunc={elementRenderFunction} />
        <Dropdown value={ion.code} name="Ion" data={ions} onChange={onIonChange} elementDisplayFunc={elementRenderFunction} />
        <Dropdown value={material.code} name="Material" data={materials} onChange={onMaterialChange}
            elementDisplayFunc={elementRenderFunction} />

    </div>)
}

export default CalculatorSettings