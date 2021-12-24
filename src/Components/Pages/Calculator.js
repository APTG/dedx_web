import React from 'react'
import WASMWrapper from '../../Backend/WASMWrapper'

import CalculatorSettings from '../CalculatorHelpers/CalculatorSettings'
import CalculatorInput from '../CalculatorHelpers/CalculatorInput'
import CalculatorOutput from '../CalculatorHelpers/CalculatorOutput'

import * as convert from 'convert-units'
import withLibdedxEntities from '../WithLibdedxEntities'

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

class CalculatorComponent extends React.Component {


    onChanges = {
        onOutputUnitChange: ({ target }) => {
            const outputUnit = target.value
            this.setState({ outputUnit })
        },
        onOperationModeChange: operationMode => {
            this.setState({ operationMode })
            this.forceUpdate()
        },
        onProgramChange: this.props.onProgramChange,
        onIonChange: this.props.onIonChange,
        onMaterialChange: this.props.onMaterialChange,
    }

    calculateUnits(_csda) {
        const units = new Array(_csda.length)
        const csda = _csda.map((range,key) => {
            const converted = convert(range).from('cm').toBest()
            units[key] = converted.unit
            return converted.val
        })
        return {csda, units}
    }

    async calculateResults(input) {
        return await this.wrapper.getCalculatorData(this.props, input)
    }

    async onSubmit(event) {
        event.preventDefault()

        const { separator } = this.state
        const input = event.target["calc-input"].value.split(separator).filter(el => el !== '').map(el=>Number(el))
        const result = await this.calculateResults(input)
        Object.assign(result,this.calculateUnits(result.csda))

        this.setState({ result })
    }

    async onInputChange(event) {
        const { separator } = this.state
        const input = event.target.value.split(separator).filter(el => el !== '').map(el=>Number(el))
        const result = await this.calculateResults(input)
        Object.assign(result,this.calculateUnits(result.csda))

        this.setState({ result })
    }

    async generateDefaults() {
        const { separator } = this.state
        return (await this.wrapper.generateDefaults(this.props)).join(separator)
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
        }

    }

    render() {

        const { programs, ions, materials, program, ion, material } = this.props
        const { outputUnit, result, operationMode} = this.state
        const { onSubmit, onInputChange, generateDefaults, onChanges } = this

        console.log(result)

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

const defaults = {
    programId: 2,
    materialId: 276,
    ionId: 1,
}

export default withLibdedxEntities(CalculatorComponent, defaults);