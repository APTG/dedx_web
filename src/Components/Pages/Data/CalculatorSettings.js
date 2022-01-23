import Dropdown, { renderElementName, renderElementNameAndId } from '../../Utils/Dropdown'


import '../../../Styles/Form.css'



function CalculatorSettings({ onChanges, stoppingPowerUnits, programs, ions, materials, stoppingPowerUnit, program, ion, material }) {
    const { onStoppingPowerUnitChange, onProgramChange, onIonChange, onMaterialChange } = onChanges

    return (
        <div className="particle-input">
            {/* <Dropdown name={'Input unit'} data={inputUnits} onChange={onInputUnitChange} elementDisplayFunc={dropdownRenderFunction} /> */}
            <Dropdown value={stoppingPowerUnit.id} name={'STP unit'} data={stoppingPowerUnits} onChange={onStoppingPowerUnitChange}
                elementDisplayFunc={renderElementName} />
            <Dropdown value={program.id} name="Program" data={programs} onChange={onProgramChange}
                elementDisplayFunc={renderElementName} />
            <Dropdown value={ion.id} name="Ion" data={ions} onChange={onIonChange} elementDisplayFunc={renderElementNameAndId} />
            <Dropdown value={material.id} name="Material" data={materials} onChange={onMaterialChange}
                elementDisplayFunc={renderElementNameAndId} />
        </div>
    )
}

export default CalculatorSettings