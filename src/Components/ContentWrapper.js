import { Link, Route, BrowserRouter as Router, Routes, Redirect, Navigate } from 'react-router-dom';

import CalculatorComponent from "./Pages/Calculator";
import PropTypes from 'prop-types';
import React from "react";
import PlotComponent from "./Pages/Plot";

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
        const ready = this.props.JSROOT ? true : false

        return (
            <Router>
                <div style={{ minHeight: "calc(100vh - 7.5em)" }}>
                    <div className="nav-menu">
                        <Link to={'web_dev/StoppingPower'}>Plot</Link>
                        <Link to={'web_dev/Calculator'}>Data</Link>
                    </div>
                    <div style={{ marginTop: "2.5em", paddingBottom: "1em" }}>
                        <Routes>
                            <Route path="web_dev/*" element={<Navigate to={"/web_dev/StoppingPower"}/>} />
                            <Route path={'web_dev/StoppingPower'} element={<PlotComponent ready={ready} />} />
                            <Route path={'web_dev/Calculator'} element={<CalculatorComponent ready={ready} />} />
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