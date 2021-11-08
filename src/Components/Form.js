import PropTypes from 'prop-types';
import React from 'react';
import Toggle from './Toggle';

import WASMWrapper from '../Backend/WASMWrapper';
import '../Styles/Form.css'

export default class Form extends React.Component {
    async componentDidMount() {
        try {
            const [programs, ions, materials] = await Promise.all([
                this.wrapper.getPrograms(),
                this.wrapper.getIons(this.state.program),
                this.wrapper.getMaterials(this.state.program)
            ])
            this.setState({
                programs: programs,
                ions: ions,
                materials: materials
            })
        } catch (err) {
            console.log(err)
        }
    }

    async onProgramChange(newProgram) {
        const { value } = newProgram.target
        try {
           const [mats, ions] = await Promise.all([
                this.wrapper.getMaterials(value),
                this.wrapper.getIons(value)]
            )
             this.setState({
                program: value,
                materials: mats,
                ions: ions
            })
        } catch(err){
            console.log(err)
        }
        
    }

    static propTypes = {
        onSubmit: PropTypes.func.isRequired
    }

    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.wrapper = new WASMWrapper()
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
            program: this.state.program,
            method: this.state.method,
            ion: event.target.elements.ion.value,
            material: event.target.elements.material.value,
        })
    }

    onMethodChange(newState) {
        this.setState({ method: newState })
    }



    render() {
        const { ready, programs, ions, materials } = this.state

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
                        <select id="programSelect" name="program" onChange={this.onProgramChange.bind(this)} className="input-box">
                            {programs.map((program, key) => <option value={program.code} key={"program" + key}>{program.name}</option>)}
                        </select>
                    </label>
                    <label className="input-wrapper">
                        Ion
                        <select id="ionSelect" name="ion" className="input-box">
                            {ions.map((ion, key) => <option value={ion.code} key={"ion_" + key}>{ion.name}</option>)}
                        </select>
                    </label>
                    <label className="input-wrapper">
                        Material
                        <select id="materialSelect" name="material" className="input-box">
                            {materials.map((material, key) => <option value={material.code} key={"material_" + key}>{material.name}</option>)}
                        </select>
                    </label>
                </div>
                <button className="button" type="submit">Submit</button>
            </form>
        );
    }
}
