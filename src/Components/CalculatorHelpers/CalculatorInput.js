
function CalculatorInput({ inputUnit, onSubmit }) {


    return (<form onSubmit={onSubmit}>
        <input name="inputValue" id="inputvalue" className="input-box" style={{maxWidth:'50%'}}
            type="text" />{` ${inputUnit}`}
        <button className="button" type="submit">Submit</button>

    </form>)
}

export default CalculatorInput