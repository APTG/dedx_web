import React,{ Component } from 'react';
import { getParticles, getMaterials } from '../Backend/WASMWrapper';

import '../Styles/Form.css'
import Toggle from './Toggle';

class Form extends Component {
    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            method: 0
        }
    }


    handleSubmit() {
        this.props.onSubmit("Hello")
    }


    onMethodChange(newState) {
        this.setState({ method: newState })

    }


    render() {

        return (
            <form className="particle-input">
                <div>
                    <label className="input-wrapper">
                        Name
                        <input type="text" className="input-box" />
                    </label>
                    <div className="input-wrapper">
                        Plot using
                        <div className="toggle-compound">
                            <input className="input-box" type="number" step="0.01" defaultValue={500} placeholder={500} />
                            <Toggle onChange={this.onMethodChange.bind(this)}>
                                <>Step</>
                                <>Points</>
                            </Toggle>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="input-wrapper">
                        Particle
                        <select className="input-box">
                            {getParticles().map((particle, key) => <option key={"material_" + key}>{particle}</option>)}
                        </select>
                    </label>
                    <label className="input-wrapper">
                        Material
                        <select className="input-box">
                            Material
                            {getMaterials().map((material, key) => <option key={"material_" + key}>{material}</option>)}
                        </select>
                    </label>
                </div>
                <button className="button" type="button" onClick={this.handleSubmit}>Submit</button>
            </form>
        );
    }
}
export default Form
