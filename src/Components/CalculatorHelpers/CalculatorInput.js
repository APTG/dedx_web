import { useRef } from "react"

function CalculatorInput({ onSubmit, onInputChange, generateDefaults }) {

    const ref = useRef(null)

    const onDefaultGenerate = async () => ref.current.value = await generateDefaults()

    return (<form name="calc-form" onSubmit={onSubmit}>
        <input ref={ref} name="calc-input" id="inputvalue" className="input-box" style={{maxWidth:'50%'}} onChange={onInputChange}
            type="textarea" />{` MeV/nucl`}
        <button className="button" onClick={onDefaultGenerate}>Generate default energies</button>
        <button className="button" type="submit">Submit</button>

    </form>)
}

export default CalculatorInput