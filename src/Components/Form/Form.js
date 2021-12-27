import PropTypes from 'prop-types';
import React from 'react';

import '../../Styles/Form.css'
import withLibdedxEntities from '../WithLibdedxEntities';
import Dropdown from './Dropdown';

const startingSeriesNumber = 0

class Form extends React.Component {

    static propTypes = {
        onSubmit: PropTypes.func.isRequired
    }

    componentDidUpdate(prevProps){
        const { program, ion, material } = this.props
        if (program !== prevProps.program
            || ion !== prevProps.ion
            || material !== prevProps.material
        ) {
            this.setState({
                name:`${ion.name}/${material.name}@${program.name}`
            })
        }
    }

    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            seriesNumber: startingSeriesNumber,
            name: "",
            method: 0,
            pointQuantity: 100,
        }

        this.handleClear = this.handleClear.bind(this)
    }

    onNameChange = name =>{
        this.setState({ name: name.target.value })
    } 
    onMethodChange = method => this.setState({ method: method })
    onPlotUsingChange = pointQuantity => this.setState({ pointQuantity: ~~pointQuantity.target.value })

    handleSubmit(event) {
        event.preventDefault()
        const { name, method, pointQuantity, seriesNumber } = this.state
        const {program,ion,material} = this.props
        this.props.onSubmit({ name, program, ion, material, method, pointQuantity, seriesNumber })
        this.setState(pervState => ({
            seriesNumber: ++pervState.seriesNumber,
        }))
        this.forceUpdate()
    }

    dropdownRenderFunction(name) {
        return (element, key) => <option value={element.id} key={`${name}_${key}`}>{element.name}</option>
    }

    handleClear() {
        this.setState({
            seriesNumber: startingSeriesNumber,
        })
        this.props.clearDataSeries()
    }

    render() {
        const { programs, ions, materials, program, ion, material, onIonChange, onMaterialChange, onProgramChange } = this.props
        const { handleSubmit, onNameChange, handleClear, dropdownRenderFunction } = this

        return (
            <form onSubmit={handleSubmit} data-testid="form-1" className="particle-input">
                <div className="gridish250">
                    <label className="input-wrapper">
                        Name
                        <input onChange={onNameChange} name="name" type="text" className="input-box" value={this.state.name} />
                    </label>
                    {/* <div className="input-wrapper">
                        <label htmlFor="pointQuantity">Plot using</label>
                        <div className="toggle-compound">
                            <input onChange={this.onPlotUsingChange} name="pointQuantity" id="pointQuantity" className="input-box" type="number" step="1" defaultValue={this.state.pointQuantity} placeholder={this.state.pointQuantity} />
                            <Toggle name={''} onChange={this.onMethodChange} startValue={method}>
                                {"Points"}
                                {"Points"}
                                {"Intervals (unimplemented)"}
                            </Toggle>
                        </div>
                    </div> */}

                    <Dropdown value={program.id} name="Program" data={programs} onChange={onProgramChange}
                        elementDisplayFunc={dropdownRenderFunction} />
                    <Dropdown value={ion.id} name="Ion" data={ions} onChange={onIonChange} elementDisplayFunc={dropdownRenderFunction} />
                    <Dropdown value={material.id} name="Material" data={materials} onChange={onMaterialChange}
                        elementDisplayFunc={dropdownRenderFunction} />
                </div>
                <div>
                    <button className="button" type="submit">Plot</button>
                    <input type="button" className="button" onClick={handleClear} value={"Clear"} />
                </div>
            </form>
        );
    }
}

const defaults = {
    programId: 2, // PSTAR https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L8
    materialId: 276, // liquid WATER https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L197
    ionId: 1, // currently proton (HYDROGEN)  https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L244
}

export default withLibdedxEntities(Form, defaults)