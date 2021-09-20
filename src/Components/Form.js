import React, { Component } from 'react';
import { getParticles, getMaterials } from '../Backend/WASMWrapper';
import PropTypes from 'prop-types';

import '../Styles/Form.css'
import Toggle from './Toggle';

class Form extends Component {
    constructor({props}) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            method: 0
        }
    }


    handleSubmit(event) {
        event.preventDefault()
        this.props.onSubmit({
            name: event.target.elements.name.value,
            plot_using: event.target.elements.plot_using.value,
            method: this.state.method,
            particle: event.target.elements.particle.value,
            material: event.target.elements.material.value,
        })
    }


    onMethodChange(newState) {
        this.setState({ method: newState })

    }


    render() {

        return (
            <form onSubmit={this.handleSubmit} data-testid="form-1" className="particle-input">
                <div>
                    <label className="input-wrapper">
                        Name
                        <input name="name" type="text" className="input-box" />
                    </label>
                    <div className="input-wrapper">
                        <label htmlFor="plot_using">Plot using</label>
                        <div className="toggle-compound">
                            <input name="plot_using" id="plot_using" className="input-box" type="number" step="0.01" defaultValue={500} placeholder={500} />
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
                        <select name="particle" className="input-box">
                            {getParticles().map((particle, key) => <option key={"material_" + key}>{particle}</option>)}
                        </select>
                    </label>
                    <label className="input-wrapper">
                        Material
                        <select name="material" className="input-box">
                            {getMaterials().map((material, key) => <option key={"material_" + key}>{material}</option>)}
                        </select>
                    </label>
                </div>
                <button className="button" type="submit">Submit</button>
            </form>
        );
    }
}

Form.propTypes = {
    onSubmit: PropTypes.func.isRequired
}

export default Form
