import PropTypes from 'prop-types';
import React from 'react';

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
            const name = this.seriesByValues(program, ion, material)
            this.setState({ materials, ions, program, material, ion, name })
        } catch (err) {
            console.log(err)
        }
    }

    static propTypes = {
        onSubmit: PropTypes.func.isRequired
    }

    seriesByValues(program, ion, material) {
        return `${ion.name}/${material.name}@${program.name}`
    }

    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.wrapper = props.wrapper || new WASMWrapper()

        this.state = {
            seriesNumber: startingSeriesNumber,
            name: "",
            method: 0,
            plotUsing: 100,
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
    onPlotUsingChange = plotUsing => this.setState({ plotUsing: ~~plotUsing.target.value })
    onIonChange = ({ target }) => {
        const { ions, program, material } = this.state
        const ionNumber = ~~target.value
        const ion = ions.find(i => i.code === ionNumber)
        const name = this.seriesByValues(program, ion, material)
        this.setState({ ion, name })
    }
    onMaterialChange = ({ target }) => {
        const { ion, program, materials } = this.state
        const materialNumber = ~~target.value
        const material = materials.find(mat => mat.code === materialNumber)
        const name = this.seriesByValues(program, ion, material)
        this.setState({ material, name })
    }


    handleSubmit(event) {
        event.preventDefault()
        this.props.onSubmit(this.state)
        this.setState(pervState => ({
            seriesNumber: ++pervState.seriesNumber,
        }))
        this.forceUpdate()
    }

    dropdownRenderFunction(name){
        return (element,key) => <option value={element.code} key={`${name}_${key}`}>{element.name}</option>
    }
        
    handleClear() {
        this.setState({
            seriesNumber: startingSeriesNumber,
        })
        this.props.clearDataSeries()
    }

    render() {
        const { programs, ions, materials, program, ion, material } = this.state
        const { handleSubmit, onNameChange, onProgramChange, onIonChange, onMaterialChange, handleClear, dropdownRenderFunction } = this

        return (
            <form onSubmit={handleSubmit} data-testid="form-1" className="particle-input">
                <div className="gridish250">
                    <label className="input-wrapper">
                        Name
                        <input onChange={onNameChange} name="name" type="text" className="input-box" value={this.state.name} />
                    </label>
                    {/* <div className="input-wrapper">
                        <label htmlFor="plotUsing">Plot using</label>
                        <div className="toggle-compound">
                            <input onChange={this.onPlotUsingChange} name="plotUsing" id="plotUsing" className="input-box" type="number" step="1" defaultValue={this.state.plotUsing} placeholder={this.state.plotUsing} />
                            <Toggle name={''} onChange={this.onMethodChange} startValue={method}>
                                {"Points"}
                                {"Points"}
                                {"Intervals (unimplemented)"}
                            </Toggle>
                        </div>
                    </div> */}    

                    <Dropdown value={program.code} name="Program" data={programs} onChange={onProgramChange}
                    elementDisplayFunc={dropdownRenderFunction} />
                    <Dropdown value={ion.code} name="Ion" data={ions} onChange={onIonChange} elementDisplayFunc={dropdownRenderFunction}/>
                    <Dropdown value={material.code} name="Material" data={materials} onChange={onMaterialChange}
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
