import {Component} from 'react';
import {getParticles, getMaterials} from '../Backend/WASMWrapper';

class Form extends Component {
    constructor(props) {
        super(props);    
        this.handleSubmit = this.handleSubmit.bind(this);
      }

      handleSubmit(){
          console.log(this.props.onSubmit);
        this.props.onSubmit("Hello")
      }
    
    
      render() {
        return (
          <form>
            <label>
                Generate points
                <select>
                    <option>Points</option>
                    <option>Step</option>
                </select>
                <input type="number" placeholder={500}/>
            </label>
            <div>
                <label>
                    Particle
                    <select>
                        {getParticles().map( particle => <option>{particle}</option>)}
                    </select>
                </label>
                <label>
                    Material
                    <select>
                        Material
                        {getMaterials().map( material => <option>{material}</option>)}
                    </select>
                </label>
            </div>
            <div>
                <div>
                    X
                    <input type="radio" name="xAxis"/> Linear
                    <input type="radio" name="xAxis"/> Logarithmic
                </div>
                <div>
                    Y
                    <input type="radio" name="yAxis"/> Linear
                    <input type="radio" name="yAxis"/> Logarithmic
                </div>
                <div>
                Plot as 
                    <input type="radio" name="plotType"/> Points
                    <input type="radio" name="plotType"/> Line
                </div>
            </div>
            
            <input type="button" onClick={this.handleSubmit} value="Submit" />
          </form>
        );
      }
}
export default Form
