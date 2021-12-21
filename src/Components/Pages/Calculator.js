import PropTypes from 'prop-types'
import React from 'react'
import WASMWrapper from '../../Backend/WASMWrapper'

import CalculatorSettings from '../CalculatorHelpers/CalculatorSettings'
import CalculatorInput from '../CalculatorHelpers/CalculatorInput'
import CalculatorOutput from '../CalculatorHelpers/CalculatorOutput'

import * as convert from 'convert-units'

const Units = {
    Inputs: {
        MeVPerNucleum: 'MeV/nucl',
        //        Mev: 'Mev',
    },
    Outputs: {
        SmallScale: 'keV/μm',
        LargeScale: 'MeV/cm',
        MassStoppingPower: 'Mev*g/cm^2'

    }
}

const OperationMode = {
    Dynamic: 0,
    Performance: 1,
}


class CalculatorComponent extends React.Component {
    static propTypes = {
        ready: PropTypes.bool.isRequired
    }

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
            this.setState({ programs, ions, materials, program, material, ion })
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
            this.setState({ materials, ions, program, material, ion })
        } catch (err) {
            console.log(err)
        }
    }

    onChanges = {
        onInputUnitChange: ({ target }) => {
            const inputUnit = target.value
            this.setState({ inputUnit })
        },
        onOutputUnitChange: ({ target }) => {
            const outputUnit = target.value
            //const result = this.enrichWithUnit(this.state.result, outputUnit)
            this.setState({ outputUnit })
        },
        onOperationModeChange: operationMode => {
            console.log(operationMode)
            this.setState({ operationMode })
            this.forceUpdate()
        },
        onIonChange: ({ target }) => {
            const { ions, program, material } = this.state
            const ionNumber = ~~target.value
            const ion = ions.find(i => i.code === ionNumber)
            const name = this.seriesByValues(program, ion, material)
            this.setState({ ion, name })
        },
        onMaterialChange: ({ target }) => {
            const { ion, program, materials } = this.state
            const materialNumber = ~~target.value
            const material = materials.find(mat => mat.code === materialNumber)
            const name = this.seriesByValues(program, ion, material)
            this.setState({ material, name })
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
                    program.code,
                    ion.code,
                    material.code,
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

        console.log('Unit conversion: ' + (convert(0.001).from('l').toBest().val))

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
            program: {},
            ion: {},
            material: {},
            programs: [],
            ions: [],
            materials: []
        }

    }

    render() {

        const { inputUnit, outputUnit, result, operationMode, programs, ions, materials } = this.state
        const { onSubmit, onInputChange, generateDefaults, onChanges } = this

        console.log(`OpMode: ${operationMode}`)

        console.log(result)
        return (
            <div>
                <CalculatorSettings
                    onChanges={onChanges}
                    inputUnits={Object.entries(Units.Inputs)}
                    outputUnits={Object.entries(Units.Outputs)}
                    programs={programs}
                    ions={ions}
                    materials={materials}
                />
                <CalculatorInput
                    onSubmit={onSubmit}
                    onInputChange={operationMode === OperationMode.Dynamic
                        ? onInputChange
                        : undefined
                    }
                    inputUnit={inputUnit}
                    outputUnit={outputUnit}
                    generateDefaults={generateDefaults}
                />
                <CalculatorOutput result={result} energyUnit={outputUnit} />

            </div>
        );
    }
}

export default CalculatorComponent;