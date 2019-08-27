import React, { Component } from 'react';
import './Form.css';
import actionsHistory from '../History/duck/actions'
import actionsPlot from '../Plot/duck/actions'
import actionsResult from '../Result/duck/actions'

import { connect } from 'react-redux';
import { Button, Input } from 'antd';
import { Form as AntForm } from 'antd';


class Form extends Component {

    constructor(props) {
        super(props);
        this.addResult = this.addResult.bind(this);
        this.handleChange = this.handleChange.bind(this);

        this.state = {
            formVal: this.props.form.val
        }
    }

    addResult(event) {
        event.preventDefault();
        this.props.add(this.state.formVal);
        this.setState({formVal: ''});
    }

    handleChange(event) {
        this.setState({formVal: event.target.value});
    }

    render() {
        return(
            <div className="Form">
                <p>Form component works!</p>

                <AntForm onSubmit={this.addResult} layout="vertical">
                    <AntForm.Item>
                        <Input
                            type='number'
                            required={true}
                            value={this.state.formVal}
                            onChange={this.handleChange.bind(this)}
                        />
                    </AntForm.Item>
                    <AntForm.Item>
                        <Button type="primary" htmlType='submit'>Save in redux state and plot</Button>
                    </AntForm.Item>
                </AntForm>
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
        dispatch(actionsResult.set(result));
        dispatch(actionsPlot.add(
            {
                type: 'scatter',
                x: [1, 4],
                y: [result, result],
                mode: 'lines',
                marker: {color: `rgb(${R}, ${G}, ${B})`},
            }
        ));
    },
});

export default connect(mapStateToProps, mapDispatchToProps) (Form);