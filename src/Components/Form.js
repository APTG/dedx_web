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
            this.setState({ programs, ions, materials})
        } catch (err) {
            console.log(err)
        }
    }

    async onProgramChange(newProgram) {
        const program = (Number)(newProgram.target.value)
        try {
            const [materials, ions] = await Promise.all([
                this.wrapper.getMaterials(program),
                this.wrapper.getIons(program)]
            )
            this.setState({ program, materials, ions })
        } catch (err) {
            console.log(err)
        }

    }

    static propTypes = {
        onSubmit: PropTypes.func.isRequired
    }

    seriesMessage = series => `Series ${series}`

    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.wrapper = props.wrapper || new WASMWrapper()

        const startingSeriesNumber = 0

        this.state = {
            seriesNumber: startingSeriesNumber,
            name: this.seriesMessage(startingSeriesNumber),
            method: 0,
            plotUsing: 100,
            program: 1,
            ion: 2,
            material: 2,
            programs: [],
            ions: [],
            materials: []
        }
    }

    onNameChange = name => this.setState({ name: name.target.value })
    onMethodChange = method => this.setState({ method: method })
    onPlotUsingChange = plotUsing => this.setState({ plotUsing: plotUsing.target.value })
    onIonChange = ion => this.setState({ ion: (Number)(ion.target.value) })
    onMaterialChange = material => this.setState({ material: (Number)(material.target.value) })


    handleSubmit(event) {
        event.preventDefault()
        const { name, method, plotUsing, program, ion, material } = this.state
        this.props.onSubmit({ name, method, plotUsing, program, ion, material })
        this.setState(pervState => ({
            seriesNumber: ++pervState.seriesNumber,
            name: this.seriesMessage(pervState.seriesNumber)
        }))
        this.forceUpdate()
    }

    render() {
        const { programs, ions, materials } = this.state

        return (
            <form onSubmit={this.handleSubmit} data-testid="form-1" className="particle-input">
                <div className="gridish50">
                    <label className="input-wrapper">
                        Name
                        <input onChange={this.onNameChange} name="name" type="text" className="input-box" value={this.state.name} />
                    </label>
                    <div className="input-wrapper">
                        <label htmlFor="plot_using">Plot using</label>
                        <div className="toggle-compound">
                            <input onChange={this.onPlotUsingChange} name="plot_using" id="plot_using" className="input-box" type="number" step="0.01" defaultValue={this.state.plotUsing} placeholder={this.state.plotUsing} />
                            <Toggle name={''} onChange={this.onMethodChange}>
                                {"Step"}
                                {"Points"}
                            </Toggle>
                        </div>
                    </div>
                    <label className="input-wrapper">
                        Program
                        <select onChange={this.onProgramChange.bind(this)} id="programSelect" name="program" className="input-box">
                            {programs.map((program, key) => <option value={program.code} key={"program" + key}>{program.name}</option>)}
                        </select>
                    </label>
                    <label className="input-wrapper">
                        Ion
                        <select onChange={this.onIonChange} id="ionSelect" name="ion" className="input-box">
                            {ions.map((ion, key) => <option value={ion.code} key={"ion_" + key}>{ion.name}</option>)}
                        </select>
                    </label>
                    <label className="input-wrapper">
                        Material
                        <select onChange={this.onMaterialChange} id="materialSelect" name="material" className="input-box">
                            {materials.map((material, key) => <option value={material.code} key={"material_" + key}>{material.name}</option>)}
                        </select>
                    </label>
                </div>
                <button className="button" type="submit">Submit</button>
            </form>
        );
    }
}
