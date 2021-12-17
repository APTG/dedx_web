
function CalculatorInput({ inputUnit, onSubmit, onInputChange }) {

    console.log(onInputChange)

    return (<form onSubmit={onSubmit}>
        <input name="inputValue" id="inputvalue" className="input-box" style={{maxWidth:'50%'}} onChange={onInputChange}
            type="text" />{` ${inputUnit}`}
        <button className="button" type="submit">Submit</button>

    </form>)
}

export default CalculatorInput