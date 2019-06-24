import React, { Component } from 'react';
import './Form.css';
import actionsHistory from '../History/duck/actions'
import actionsPlot from '../Plot/duck/actions'

import { connect } from 'react-redux';

class Form extends Component {

    constructor(props) {
        super(props);
        this.addResult = this.addResult.bind(this);
    }

    formInput = React.createRef();

    addResult(event) {
        event.preventDefault();
        this.props.add(this.formInput.current.value);
        this.formInput.current.value = '';
    }

    render() {
        return(
            <div className="Form">
                <p>Form component works!</p>

                <form onSubmit={this.addResult}>
                    <input
                        type='number'
                        ref={this.formInput}
                        defaultValue={this.props.form.val}
                        required={true}
                    />
                    <button type='submit'>Save in redux state and plot</button>
                </form>

            </div>
        )
    }
}

const mapStateToProps = state => ({
    form: state.form
});

const mapDispatchToProps = dispatch => ({
    add: (result) => {
        let R = Math.floor(Math.random()*255);
        let G = Math.floor(Math.random()*128);
        let B = Math.floor(Math.random()*255);

        dispatch(actionsHistory.add(result));
        dispatch(actionsPlot.add(
            {
                type: 'scatter',
                x: [1, 4],
                y: [result, result],
                mode: 'lines',
                marker: {color: `rgb(${R}, ${G}, ${B})`},
            }
        ));
    }
});

export default connect(mapStateToProps, mapDispatchToProps) (Form);