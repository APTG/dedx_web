import { Component } from 'react';
import { getParticles, getMaterials } from '../Backend/WASMWrapper';

import '../Styles/Form.css'

class Form extends Component {
    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.methodChangeHandler = this.methodChangeHandler.bind(this);

        this.state = {
            method: "Points"
        }
    }


      handleSubmit(){
        this.props.onSubmit("Hello")
      }
    

    methodChangeHandler(event) {
        this.setState({
            method: event.target.value
        })
    }


    render() {

        return (
            <form className="particle-input">
                <div>
                    <label>
                        Generate points
                        <select onChange={this.methodChangeHandler} className="input-box">
                            <option>Points</option>
                            <option>Step</option>
                        </select>
                    </label>
                    <label>
                        {this.state.method === "Points" ? "Number of points" : "Step size"}
                        <input className="input-box" type="number" step="0.01" value={500} placeholder={500} />
                    </label>

                </div>
                <div>
                    <label>
                        Particle
                        <select className="input-box">
                            {getParticles().map((particle, key) => <option key={"material_" + key}>{particle}</option>)}
                        </select>
                    </label>
                    <label>
                        Material
                        <select className="input-box">
                            Material
                            {getMaterials().map((material, key) => <option key={"material_" + key}>{material}</option>)}
                        </select>
                    </label>

                </div>
                <div className="radio-group">
                    <div style={{ minWidth: "8%" }}>X</div>
                    <div>
                        <label>
                            <input type="radio" name="xAxis" />
                            <span className="radio">Linear</span>
                        </label>
                        <label>
                            <input type="radio" name="xAxis" />
                            <span className="radio">Logarithmic</span>
                        </label>
                    </div>
                </div >
                <div className="radio-group">
                    <div style={{ minWidth: "8%" }}>Y</div>
                    <div>
                        <label>
                            <input type="radio" name="yAxis"/>
                            <span className="radio">Linear</span>

                        </label>
                        <label>
                            <input type="radio" name="yAxis" />
                            <span className="radio">Logarithmic</span>
                        </label>
                    </div>
                </div >
                <div className="radio-group">
                    <div style={{ minWidth: "8%" }}>Plot as</div>
                    <div>
                        <label>
                            <input type="radio" name="plotType" />
                            <span className="radio">Points</span>
                        </label>
                        <label>
                            <input type="radio" name="plotType" />
                            <span className="radio">Line</span>
                        </label>
                    </div>
                </div >
                <input className="button" type="button" onClick={this.handleSubmit} value="Submit" />
            </form>
        );
    }
}
export default Form
