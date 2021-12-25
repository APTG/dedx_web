import React from 'react'
import WASMWrapper from '../Backend/WASMWrapper'

const PowerUnits = {
    MassStoppingPower: 'MeV*g/cm^2',
    LargeScale: 'MeV/cm',
    SmallScale: 'keV/μm'
}

function withLibdedxEntities(WrappedComponent, defaultIds) {
    return class WithLibdedxEntities extends React.Component {
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
                powerUnit: 2
            }

            this.onProgramChange = this.onProgramChange.bind(this)
            this.onIonChange = this.onIonChange.bind(this)
            this.onMaterialChange = this.onMaterialChange.bind(this)
            this.onPowerUnitChange = this.onPowerUnitChange.bind(this)
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

        async onPowerUnitChange({target}){
            this.setState({powerUnit: target.value})
        }

        render() {
            const { programs, ions, materials, program, ion, material, powerUnit } = this.state
            const { onProgramChange, onIonChange, onMaterialChange, onPowerUnitChange, wrapper } = this
            return (
                <WrappedComponent
                    wrapper = {wrapper}
                    programs={programs}
                    ions={ions}
                    materials={materials}
                    powerUnits={Object.values(PowerUnits)}
                    program={program}
                    ion={ion}
                    material={material}
                    powerUnit = {powerUnit}
                    onProgramChange={onProgramChange}
                    onIonChange={onIonChange}
                    onMaterialChange={onMaterialChange}
                    onPowerUnitChange={onPowerUnitChange}
                    {...this.props}
                />
            )
        }
    }

    
}

export default withLibdedxEntities