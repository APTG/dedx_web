import { Link, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import CalculatorComponent from "./Pages/Calculator";
import EnergyComponent from "./Pages/Energy";
import PropTypes from 'prop-types';
import React from "react";
import StoppingPowerComponent from "./Pages/StoppingPower";

import makeAsyncScriptLoader from "react-async-script";

import '../Styles/Nav.css'

const JSRootLink = 'https://root.cern.ch/js/latest/scripts/JSRoot.core.js';

class ContentWrapper extends React.Component {

    static propTypes = {
        JSROOT: PropTypes.object
    }

    shouldComponentUpdate() {
        return !this.props.JSROOT;
    }

    render() {
        const ready = this.props.JSROOT?true:false

        return (
            <Router>
                <div style={{ minHeight: "calc(100vh - 7.5em)" }}>
                    <div className="nav-menu">
                        <Link to={'/StoppingPower'}>Plot</Link>
                        <Link to={'/Calculator'}>Data</Link>
                    </div>
                    <div style={{ marginTop: "2.5em", paddingBottom: "1em" }}>
                        <Routes>
                            <Route path={'/StoppingPower'} element={<StoppingPowerComponent ready={ready} />} />
                            <Route path={'/Calculator'} element={<CalculatorComponent ready={ready} />} />
                        </Routes>
                    </div>
                </div>
            </Router>
        );
    }
}

export default makeAsyncScriptLoader(JSRootLink, {
    globalName: "JSROOT"
})(ContentWrapper);