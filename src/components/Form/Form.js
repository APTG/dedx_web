import React, { Component } from 'react';
import './Form.css';
import actions from '../History/duck/actions'

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
                    <input ref={this.formInput} defaultValue={this.props.form.val} />
                    <button type='submit'>Save in redux state</button>
                </form>

            </div>
        )
    }
}

const mapStateToProps = state => ({
    form: state.form
});

const mapDispatchToProps = dispatch => ({
    add: result => dispatch(actions.add(result))
});

export default connect(mapStateToProps, mapDispatchToProps) (Form);