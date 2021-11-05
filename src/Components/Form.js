import WASMWrapper from '../Backend/WASMWrapper';
import PropTypes from 'prop-types';
import React from 'react';
import Toggle from './Toggle';


import '../Styles/Form.css'

export default class Form extends React.Component {
    componentDidMount() {
        Promise.all([
            WASMWrapper.getPrograms(),
            WASMWrapper.getIons(this.state.program),
            WASMWrapper.getMaterials(this.state.program)
        ]).then(vals => {
            const [programs, ions, materials] = vals
            this.setState({
                programs: programs,
                ions: ions,
                materials: materials
            })
        })
    }

    static propTypes = {
        onSubmit: PropTypes.func.isRequired
    }

    constructor({ props }) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            method: 0,
            program: 1,
            programs: [],
            ions: [],
            materials: []
        }
    }

    handleSubmit(event) {
        event.preventDefault()
        this.props.onSubmit({
            name: event.target.elements.name.value,
            plot_using: event.target.elements.plot_using.value,
            method: this.state.method,
            particle: event.target.elements.particle.value,
            material: event.target.elements.material.value,
        })
    }

    onMethodChange(newState) {
        this.setState({ method: newState })
    }

    onProgramChange(newProgram) {
        const {value} = newProgram.target
        Promise.all([
            WASMWrapper.getMaterials(value),
            WASMWrapper.getIons(value)]
        ).then(vals => {
            const [mats, ions] = vals
            this.setState({
                program: value,
                materials: mats,
                ions: ions
            })
        })
    }

    render() {
        const {programs, ions, materials} = this.state

        return (
            <form onSubmit={this.handleSubmit} data-testid="form-1" className="particle-input">
                <div className="gridish50">
                    <label className="input-wrapper">
                        Name
                        <input name="name" type="text" className="input-box" />
                    </label>
                    <div className="input-wrapper">
                        <label htmlFor="plot_using">Plot using</label>
                        <div className="toggle-compound">
                            <input name="plot_using" id="plot_using" className="input-box" type="number" step="0.01" defaultValue={500} placeholder={500} />
                            <Toggle name={''} onChange={this.onMethodChange.bind(this)}>
                                {"Step"}
                                {"Points"}
                            </Toggle>
                        </div>
                    </div>
                    <label className="input-wrapper">
                        Program
                        <select name="program" onChange={this.onProgramChange.bind(this)} className="input-box">
                            {programs.map((program, key) => <option value={program.code} key={"program" + key}>{program.name}</option>)}
                        </select>
                    </label>
                    <label className="input-wrapper">
                        Ion
                        <select name="particle" className="input-box">
                            {ions.map((ion, key) => <option value={ion.code} key={"ion_" + key}>{ion.name}</option>)}
                        </select>
                    </label>
                    <label className="input-wrapper">
                        Material
                        <select name="material" className="input-box">
                            {   materials.map((material, key) => <option value={material.code} key={"material_" + key}>{material.name}</option>)}
                        </select>
                    </label>
                </div>
                <button className="button" type="submit">Submit</button>
            </form>
        );
    }
}
