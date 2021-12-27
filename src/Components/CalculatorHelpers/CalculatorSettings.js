import Dropdown from '../Form/Dropdown'
import Toggle from '../Toggle'

function dropdownRenderFunction(name) {
    return (element,key) => <option value={key} key={`${name}_${key}`}>{element}</option>
}

function elementRenderFunction(name){
    return (element,key) => <option value={element.id} key={`${name}_${key}`}>{element.name}</option>
}

function CalculatorSettings({ onChanges, stoppingPowerUnits, programs, ions, materials, stoppingPowerUnit, program, ion, material }) {
    const { onStoppingPowerUnitChange, onOperationModeChange, onProgramChange, onIonChange, onMaterialChange } = onChanges

    return (<div>
        <Toggle name='Operation mode' onChange={onOperationModeChange} startValue={0}>
            <>Dynamic</>
            <>Performance</>
        </Toggle>

        {/* <Dropdown name={'Input unit'} data={inputUnits} onChange={onInputUnitChange} elementDisplayFunc={dropdownRenderFunction} /> */}
        <Dropdown value={stoppingPowerUnit.id} name={'Stopping power unit'} data={stoppingPowerUnits.map(u=>u.name)} onChange={onStoppingPowerUnitChange} elementDisplayFunc={dropdownRenderFunction} />
        <Dropdown value={program.id} name="Program" data={programs} onChange={onProgramChange}
            elementDisplayFunc={elementRenderFunction} />
        <Dropdown value={ion.id} name="Ion" data={ions} onChange={onIonChange} elementDisplayFunc={elementRenderFunction} />
        <Dropdown value={material.id} name="Material" data={materials} onChange={onMaterialChange}
            elementDisplayFunc={elementRenderFunction} />

    </div>)
}

export default CalculatorSettings