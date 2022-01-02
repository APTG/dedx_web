import React from 'react';

import '../../../Styles/Form.css'
import { getButtonStyle } from '../../ResultTable/TableUtils';
import Dropdown from '../../Utils/Dropdown';

function dropdownRenderFunction(name) {
    return (element, key) => <option value={element.id} key={`${name}_${key}`}>{element.name}</option>
}

function Form(props) {
    const {
        programs, program, onProgramChange, //program
        ions, ion, onIonChange, //ion
        materials, material, onMaterialChange, //material
        stoppingPowerUnit, stoppingPowerUnits, onStoppingPowerUnitChange, //stpUnit
        onSubmit, onNameChange, onClear, name, showCSVDownload, onDownloadCSV //various
    } = props

    return (
        <form onSubmit={onSubmit} data-testid="form-1" className="column-flex" style={{width:'30%'}}>
            <h2>Plotting calculator</h2>
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
                    elementDisplayFunc={dropdownRenderFunction}
                />
                <Dropdown
                    value={ion.id}
                    name="Ion"
                    data={ions}
                    onChange={onIonChange}
                    elementDisplayFunc={dropdownRenderFunction}
                />
                <Dropdown
                    value={material.id}
                    name="Material"
                    data={materials}
                    onChange={onMaterialChange}
                    elementDisplayFunc={dropdownRenderFunction}
                />
                <Dropdown
                    value={stoppingPowerUnit.id}
                    name={'Stopping power unit'}
                    data={stoppingPowerUnits}
                    onChange={onStoppingPowerUnitChange}
                    elementDisplayFunc={dropdownRenderFunction}
                />
                <div className='gridish row-flex flex-medium gap1'>
                    <button className="button" type="submit">Plot</button>
                    <input type="button" className="button" onClick={onClear} value={"Clear"} />
                    <input type="button" style={getButtonStyle(showCSVDownload)} className="button" onClick={onDownloadCSV} value={"Download CSV data"} />
                </div>
            </div>

        </form>
    )
}

export default Form