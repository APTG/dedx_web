import React from 'react';

import '../../../Styles/Form.css'
import Dropdown, {renderElementName, renderElementNameAndId} from '../../Utils/Dropdown';

function Form(props) {
    const {
        programs, program, onProgramChange, //program
        ions, ion, onIonChange, //ion
        materials, material, onMaterialChange, //material
        stoppingPowerUnit, stoppingPowerUnits, onStoppingPowerUnitChange, //stpUnit
        onSubmit, onNameChange, onClear, name, onDownloadCSV //various
    } = props

    return (
        <form onSubmit={onSubmit} data-testid="form-1" className="column-flex" style={{width:'30%'}}>
            <div className="gridish flex-small column-flex particle-input">
                <label className="input-wrapper">
                    Name
                    <input onChange={onNameChange} name="name" type="text" className="input-box" value={name} />
                </label>

                <Dropdown
                    value={program.id}
                    name="Program"
                    data={programs}
                    onChange={onProgramChange}
                    elementDisplayFunc={renderElementName}
                />
                <Dropdown
                    value={ion.id}
                    name="Ion"
                    data={ions}
                    onChange={onIonChange}
                    elementDisplayFunc={renderElementNameAndId}
                />
                <Dropdown
                    value={material.id}
                    name="Material"
                    data={materials}
                    onChange={onMaterialChange}
                    elementDisplayFunc={renderElementNameAndId}
                />
                <Dropdown
                    value={stoppingPowerUnit.id}
                    name={'STP unit'}
                    data={stoppingPowerUnits}
                    onChange={onStoppingPowerUnitChange}
                    elementDisplayFunc={renderElementName}
                />
                <div className='gridish row-flex flex-medium gap1'>
                    <button className="button" type="submit">Save</button>
                    <input type="button" className="button" onClick={onClear} value={"Clear"} />
                    <input type="button" className="button" onClick={onDownloadCSV} value={"Download CSV data"} />
                </div>
            </div>

        </form>
    )
}

export default Form