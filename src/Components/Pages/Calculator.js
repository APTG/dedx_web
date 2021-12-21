import PropTypes from 'prop-types'
import React from 'react'
import WASMWrapper from '../../Backend/WASMWrapper'

import CalculatorSettings from '../CalculatorHelpers/CalculatorSettings'
import CalculatorInput from '../CalculatorHelpers/CalculatorInput'
import CalculatorOutput from '../CalculatorHelpers/CalculatorOutput'

import * as convert from 'convert-units'

const Units = {
    Inputs: {
        MeVperNucleon: 'MeV/nucl',
        //        Mev: 'Mev',
    },
    Outputs: {
        SmallScale: 'keV/μm',
        LargeScale: 'MeV/cm',
        MassStoppingPower: 'MeV*g/cm^2'

    }
}

const OperationMode = {
    Dynamic: 0,
    Performance: 1,
}

const defaultValue = {id: 0, name: 'no content'}

class CalculatorComponent extends React.Component {
    static propTypes = {
        ready: PropTypes.bool.isRequired
    }

    async componentDidMount() {
        try {
            const [programs, ions, materials] = await Promise.all([
                this.wrapper.getPrograms(),
                this.wrapper.getIons(this.state.program.id),
                this.wrapper.getMaterials(this.state.program.id)
            ])
            const program = programs[0]
            const material = materials[0]
            const ion = ions[0]
            this.setState({ programs, ions, materials, program, material, ion })
        } catch (err) {
            console.log(err)
        }
    }

    async onProgramChange(newProgram) {
        const programCode = (Number)(newProgram.target.value)
        const ionCode = this.state.ion.id
        const materialCode = this.state.material.id
        try {
            const [materials, ions] = await Promise.all([
                this.wrapper.getMaterials(programCode),
                this.wrapper.getIons(programCode)
            ])
            if(materials.length === 0) materials.push(defaultValue)
            if(ions.length === 0) ions.push(defaultValue)
            const material = materials.find(_material => _material.id === materialCode) || materials[0]
            const ion = materials.find(_ion => _ion.id === ionCode) || ions[0]
            const program = this.state.programs.find(prog => prog.id === programCode)
            this.setState({ materials, ions, program, material, ion })
        } catch (err) {
            console.log(err)
        }
    }

    onChanges = {
        // onInputUnitChange: ({ target }) => {
        //     const inputUnit = target.value
        //     this.setState({ inputUnit })
        // },
        onOutputUnitChange: ({ target }) => {
            const outputUnit = target.value
            //const result = this.enrichWithUnit(this.state.result, outputUnit)
            this.setState({ outputUnit })
        },
        onOperationModeChange: operationMode => {
            this.setState({ operationMode })
            this.forceUpdate()
        },
        onProgramChange: this.onProgramChange.bind(this),
        onIonChange: ({ target }) => {
            const { ions } = this.state
            const ionNumber = ~~target.value
            const ion = ions.find(i => i.id === ionNumber)
            this.setState({ ion })
        },
        onMaterialChange: ({ target }) => {
            const { materials } = this.state
            const materialNumber = ~~target.value
            const material = materials.find(mat => mat.id === materialNumber)
            this.setState({ material })
        }
    }

    enrichWithUnit(results, unit = 'cm') {
        return results.map(res => Object.assign({ unit }, res))
    }

    async calculateResults(input) {
        const { program, ion, material } = this.state

        return await Promise.all(
            input.map(async input => {
                const result = await this.wrapper.getSingleValue(
                    program.id,
                    ion.id,
                    material.id,
                    input
                )
                return {
                    input,
                    energy: isNaN(result) ? 'Value unsupported' : result,
                    csdaRange: 'Work in progress'
                }
            })
        )
    }

    async onSubmit(event) {
        event.preventDefault()

        const { separator } = this.state
        const input = event.target["calc-input"].value.split(separator).filter(el => el !== '')
        const values = await this.calculateResults(input)
        const result = this.enrichWithUnit(values)

        this.setState({ result })
    }

    async onInputChange(event) {
        const { separator } = this.state
        const input = event.target.value.split(separator).filter(el => el !== '')
        const values = await this.calculateResults(input)
        const result = this.enrichWithUnit(values)

        this.setState({ result })
    }

    async generateDefaults() {
        const { separator } = this.state
        return (await this.wrapper.generateDefaults(this.state)).join(separator)
    }

    constructor(props) {
        super(props)

        this.wrapper = new WASMWrapper()

        this.onSubmit = this.onSubmit.bind(this)
        this.onInputChange = this.onInputChange.bind(this)
        this.generateDefaults = this.generateDefaults.bind(this)

        this.state = {
            inputUnit: Units.Inputs.MeVPerNucleum,
            outputUnit: Units.Outputs.SmallScale,
            result: [],
            operationMode: OperationMode.Dynamic,
            separator: ' ',
            program: {id:1},
            ion: {},
            material: {},
            programs: [],
            ions: [],
            materials: []
        }

    }

    render() {

        const { outputUnit, result, operationMode, programs, ions, materials, program, ion, material } = this.state
        const { onSubmit, onInputChange, generateDefaults, onChanges } = this

        return (
            <div>
                <CalculatorSettings
                    onChanges={onChanges}
                    // inputUnits={Object.entries(Units.Inputs)}
                    outputUnits={Object.entries(Units.Outputs)}
                    programs={programs}
                    ions={ions}
                    materials={materials}
                    program={program}
                    ion={ion}
                    material={material}
                />
                <CalculatorInput
                    onSubmit={onSubmit}
                    onInputChange={operationMode === OperationMode.Dynamic
                        ? onInputChange
                        : undefined
                    }
                    // inputUnit={inputUnit}
                    outputUnit={outputUnit}
                    generateDefaults={generateDefaults}
                />
                <CalculatorOutput result={result} energyUnit={outputUnit} />
            </div>
        );
    }
}

export default CalculatorComponent;