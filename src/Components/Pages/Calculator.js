import PropTypes from 'prop-types';
import React from 'react'

class CalculatorComponent extends React.Component {
    static propTypes = {
        ready: PropTypes.bool.isRequired
    }

    render() {
        return <>HELLO CALCULATOR</>;
    }
}

export default CalculatorComponent;