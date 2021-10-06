import PropTypes from 'prop-types';
import React from 'react'

class EnergyComponent extends React.Component {
    static propTypes = {
        ready: PropTypes.bool.isRequired
    }

    render() {
        return <>HELLO ENERGY</>;
    }
}

export default EnergyComponent;