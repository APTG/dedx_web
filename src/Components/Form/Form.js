import PropTypes from 'prop-types';
import React from 'react';
import Toggle from '../Toggle';

import WASMWrapper from '../../Backend/WASMWrapper';
import '../../Styles/Form.css'
import Dropdown from './Dropdown';

const startingSeriesNumber = 0

export default class Form extends React.Component {
    async componentDidMount() {
        try {
            const [programs, ions, materials] = await Promise.all([
                this.wrapper.getPrograms(),
                this.wrapper.getIons(this.state.program),
                this.wrapper.getMaterials(this.state.program)
            ])
            const program = programs[0]
            const material = materials[0]
            const ion = ions[0]
            const name = this.seriesByValues(program, ion, material)
            this.setState({ programs, ions, materials, program, material, ion, name })
        } catch (err) {
            console.log(err)
        }
    }

    async onProgramChange(newProgram) {
        const programNumber = (Number)(newProgram.target.value)
        try {
            const [materials, ions] = await Promise.all([
                this.wrapper.getMaterials(programNumber),
                this.wrapper.getIons(programNumber)]
            )
            const material = materials[0]
            const ion = ions[0]
            const program = this.state.programs.find(prog => prog.code === programNumber)
            const name = this.seriesByValues(
                program,
                ion,
                material
            )
            this.setState({ materials, ions, program, material, ion, name })
        } catch (err) {
            console.log(err)
        }

    }

    static propTypes = {
        onSubmit: PropTypes.func.isRequired
    }

    seriesMessage = series => `Series ${series}`
    seriesByValues(program, ion, material) {
        return `${ion.name}/${material.name}@${program.name}`
    }

    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.wrapper = props.wrapper || new WASMWrapper()

        this.state = {
            seriesNumber: startingSeriesNumber,
            name: this.seriesMessage(startingSeriesNumber),
            method: 0,
            plotUsing: 10,
            program: {},
            ion: {},
            material: {},
            programs: [],
            ions: [],
            materials: []
        }

        this.onProgramChange = this.onProgramChange.bind(this)
        this.handleClear = this.handleClear.bind(this)
    }

    onNameChange = name => this.setState({ name: name.target.value })
    onMethodChange = method => this.setState({ method: method })
    onPlotUsingChange = plotUsing => this.setState({ plotUsing: plotUsing.target.value })
    onIonChange = ({target}) => {
        const {ions, program, material} = this.state
        const ionNumber = ~~target.value
        const ion = ions.find(i => i.code === ionNumber)
        const name = this.seriesByValues(program,ion,material)
        this.setState({ ion, name})
    } 
    onMaterialChange = ({target}) => {
        const {ion, program, materials} = this.state
        const materialNumber = ~~target.value
        const material = materials.find(mat => mat.code === materialNumber)
        const name = this.seriesByValues(program,ion,material)
        this.setState({ material, name})
    }


    handleSubmit(event) {
        event.preventDefault()
        const { name, method, plotUsing, program, ion, material, seriesNumber } = this.state
        this.props.onSubmit({ name, method, plotUsing, program, ion, material, seriesNumber })
        this.setState(pervState => ({
            seriesNumber: ++pervState.seriesNumber,
            name: this.seriesMessage(pervState.seriesNumber)
        }))
        this.forceUpdate()
    }

    handleClear() {
        this.setState({
            seriesNumber: startingSeriesNumber,
            name: this.seriesMessage(startingSeriesNumber)
        })
        this.props.clearDataSeries()
    }

    render() {
        const { programs, ions, materials } = this.state
        const { program, ion, material, method } = this.state

        return (
            <form onSubmit={this.handleSubmit} data-testid="form-1" className="particle-input">
                <div className="gridish250">
                    <label className="input-wrapper">
                        Name
                        <input onChange={this.onNameChange} name="name" type="text" className="input-box" value={this.state.name} />
                    </label>
                    <div className="input-wrapper">
                        <label htmlFor="plotUsing">Plot using</label>
                        <div className="toggle-compound">
                            <input onChange={this.onPlotUsingChange} name="plotUsing" id="plotUsing" className="input-box" type="number" step="1" defaultValue={this.state.plotUsing} placeholder={this.state.plotUsing} />
                            <Toggle name={''} onChange={this.onMethodChange} startValue={method}>
                                {"Points"}
                                {"Intervals (unimplemented)"}
                            </Toggle>
                        </div>
                    </div>
                    <Dropdown value={program.code} name="Program" data={programs} onchange={this.onProgramChange} />
                    <Dropdown value={ion.code} name="Ion" data={ions} onchange={this.onIonChange} />
                    <Dropdown value={material.code} name="Material" data={materials} onchange={this.onMaterialChange} />
                </div>
                <div>
                    <button className="button" type="submit">Plot</button>
                    <input type="button" className="button" onClick={this.handleClear} value={"Clear"} />
                </div>
            </form>
        );
    }
}
