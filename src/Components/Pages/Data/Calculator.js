import React from 'react'
import WASMWrapper from '../../../Backend/WASMWrapper'

import CalculatorSettings from './CalculatorSettings'
import CalculatorInput from './CalculatorInput'
import CalculatorOutput from './CalculatorOutput'

import withLibdedxEntities from '../../WithLibdedxEntities'
import { getCSV, transformResultToTableData } from '../../ResultTable/TableUtils'

const InputUnits = {
    MeVperNucleon: 'MeV/nucl',
    //        Mev: 'Mev',
}

const OperationMode = {
    Dynamic: 0,
    Performance: 1,
}

class CalculatorComponent extends React.Component {


    constructor(props) {
        super(props)

        this.wrapper = props.wrapper || new WASMWrapper()

        this.onSubmit = this.onSubmit.bind(this)
        this.onInputChange = this.onInputChange.bind(this)
        this.generateDefaults = this.generateDefaults.bind(this)
        this.onOperationModeChange = this.onOperationModeChange.bind(this)
        this.onDensityUsageChange = this.onDensityUsageChange.bind(this)
        this.onDownloadCSV = this.onDownloadCSV.bind(this)

        this.state = {
            inputUnit: InputUnits.MeVPerNucleum,
            result: {},
            operationMode: OperationMode.Dynamic,
            separator: '\n',
            isRangeDensityBased: 0
        }
    }

    //#region LIFECYCLE
    async componentDidUpdate(prevProps, prevState) {
        const { program, ion, material, stoppingPowerUnit } = this.props
        if (program !== prevProps.program
            || ion !== prevProps.ion
            || material !== prevProps.material
        ) {
            const { energies } = this.state.result
            if (energies) {
                this.setState({
                    result: await this.calculateResults(energies)
                })
            }

        } else if (stoppingPowerUnit !== prevProps.stoppingPowerUnit) {
            const { stoppingPowers } = this.state.result
            if (stoppingPowers) {
                const newState = prevState
                newState.result.stoppingPowers = await this.wrapper.recalcualteStoppingPowers(
                    prevProps.stoppingPowerUnit, stoppingPowerUnit, material, stoppingPowers
                )
                this.setState(newState)
            }
        }
        else return null
    }
    //#endregion LIFECYCLE

    //#region HANDLERS
    async onSubmit(event) {
        event.preventDefault()

        const { separator } = this.state
        const input = event.target["calc-input"].value.split(separator).filter(el => el !== '').map(el => Number(el))
        const result = await this.calculateResults(input)

        this.setState({ result })
    }

    async onInputChange(event) {
        const { separator } = this.state
        const input = event.target.value.split(separator).filter(el => el !== '').map(el => Number(el))
        const result = await this.calculateResults(input)

        this.setState({ result })
    }

    onOperationModeChange(operationMode) {
        this.setState({ operationMode })
    }

    onDownloadCSV() {
        const { result, isRangeDensityBased } = this.state
        const { energies } = result
        const { stoppingPowerUnit } = this.props

        getCSV(energies, transformResultToTableData(result, stoppingPowerUnit, isRangeDensityBased))
    }

    onChanges = {
        onStoppingPowerUnitChange: this.props.onStoppingPowerUnitChange,
        onProgramChange: this.props.onProgramChange,
        onIonChange: this.props.onIonChange,
        onMaterialChange: this.props.onMaterialChange,
    }

    async onDensityUsageChange(isRangeDensityBased) {
        let result = this.state.result
        result.csdaRanges = await this.wrapper.recalcualteCSDARangeForDensity(this.props.material,result.csdaRanges,isRangeDensityBased)
        this.setState({ isRangeDensityBased })
    }
    //#endregion HANDLERS

    //#region HELPERS
    async generateDefaults() {
        const { separator } = this.state
        return (await this.wrapper.generateDefaults(this.props)).join(separator)
    }

    async calculateResults(energies) {
        const {isRangeDensityBased} = this.state
        const result = await this.wrapper.getCalculatorData(this.props, energies, isRangeDensityBased)
        return result
    }

    //#endregion HELPERS

    render() {

        const { programs, ions, materials, stoppingPowerUnits, program, ion, material, stoppingPowerUnit } = this.props
        const { result, operationMode, isRangeDensityBased } = this.state
        const { onSubmit, onInputChange, generateDefaults, onOperationModeChange, onDensityUsageChange, onDownloadCSV, onChanges } = this

        return (
            <div className='gridish row-flex gap2' >
                <div className='particle-input'>
                    <h2>Data Calculator</h2>
                    <CalculatorSettings
                        onChanges={onChanges}
                        // inputUnits={Object.entries(Units.Inputs)}
                        stoppingPowerUnits={stoppingPowerUnits}
                        stoppingPowerUnit={stoppingPowerUnit}
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
                        stoppingPowerUnit={stoppingPowerUnit}
                        generateDefaults={generateDefaults}
                        onOperationModeChange={onOperationModeChange}
                        onDensityUsageChange={onDensityUsageChange}
                        onDownloadCSV={onDownloadCSV}
                        displayDownload={result.energies?.length}
                    />
                </div>

                <CalculatorOutput result={result} stoppingPowerUnit={stoppingPowerUnit} isRangeDensityBased={isRangeDensityBased} />
            </div>
        );
    }
}

const defaults = {
    programId: 2, // PSTAR https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L8
    materialId: 276, // liquid WATER https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L197
    ionId: 1, // currently proton (HYDROGEN)  https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L244
}

export default withLibdedxEntities(CalculatorComponent, defaults);