import React from 'react'
import WASMWrapper from '../Backend/WASMWrapper'
import { StoppingPowerUnits } from '../Backend/Utils'
import withError from './Error/WithError'

function withLibdedxEntities(WrappedComponent, defaultIds) {
    class WithLibdedxEntities extends React.Component {
        constructor(props) {
            super(props)

            this.wrapper = new WASMWrapper()

            this.state = {
                program: {},
                ion: {},
                material: {},
                programs: [],
                ions: [],
                materials: [],
                stoppingPowerUnit: StoppingPowerUnits.SmallScale
            }

            this.onProgramChange = this.onProgramChange.bind(this)
            this.onIonChange = this.onIonChange.bind(this)
            this.onMaterialChange = this.onMaterialChange.bind(this)
            this.onStoppingPowerUnitChange = this.onStoppingPowerUnitChange.bind(this)
        }

        findEntities([programs, ions, materials], { programId, ionId, materialId }) {
            const program = programs.find(_program => _program.id === programId) || programs[0]
            const ion = ions.find(_ion => _ion.id === ionId) || ions[0]
            const material = materials.find(_material => _material.id === materialId) || materials[0]
            return { program, ion, material }
        }

        async componentDidMount() {
            try {
                const [programs, ions, materials] = await Promise.all([
                    this.wrapper.getPrograms(),
                    this.wrapper.getIons(defaultIds.programId),
                    this.wrapper.getMaterials(defaultIds.programId)
                ])
                const foundEntities = this.findEntities([programs, ions, materials], defaultIds)
                this.setState({ programs, ions, materials, ...foundEntities })
            } catch (err) {
                console.log(err)
            }
        }

        async onProgramChange({ target }) {
            const programId = (Number)(target.value)
            const { ion, material, programs } = this.state

            try {
                const [materials, ions] = await Promise.all([
                    this.wrapper.getMaterials(programId),
                    this.wrapper.getIons(programId)
                ])
                const foundEntities = this.findEntities([programs, ions, materials], {
                    programId,
                    ionId: ion.id,
                    materialId: material.id
                })
                this.setState({ materials, ions, ...foundEntities })
            } catch (err) {
                console.log(err)
            }
        }

        onIonChange({ target }) {
            const { ions } = this.state
            const ionId = (Number)(target.value)
            const ion = ions.find(_ion => _ion.id === ionId)
            this.setState({ ion })
        }

        onMaterialChange({ target }) {
            const { materials } = this.state
            const materialId = (Number)(target.value)
            const material = materials.find(_material => _material.id === materialId)
            this.setState({ material })
        }

        onStoppingPowerUnitChange({target}){
            const stoppingPowerUnit = Object.values(StoppingPowerUnits)[~~target.value]
            this.setState({stoppingPowerUnit})
        }

        render() {
            const { programs, ions, materials, program, ion, material, stoppingPowerUnit } = this.state
            const { onProgramChange, onIonChange, onMaterialChange, onStoppingPowerUnitChange, wrapper } = this

            return (
                <WrappedComponent
                    wrapper = {wrapper}
                    programs={programs}
                    ions={ions}
                    materials={materials}
                    stoppingPowerUnits={Object.values(StoppingPowerUnits)}
                    program={program}
                    ion={ion}
                    material={material}
                    stoppingPowerUnit = {stoppingPowerUnit}
                    onProgramChange={onProgramChange}
                    onIonChange={onIonChange}
                    onMaterialChange={onMaterialChange}
                    onStoppingPowerUnitChange={onStoppingPowerUnitChange}
                    {...this.props}
                />
            )
        }
    }

    return WithLibdedxEntities
}

export default withLibdedxEntities