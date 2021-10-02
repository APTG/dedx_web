import { BrowserRouter as Router, Link, Route, Switch } from 'react-router-dom';

import CalculatorComponent from "./Pages/Calculator";
import EnergyComponent from "./Pages/Energy";
import makeAsyncScriptLoader from "react-async-script";
import React from "react";
import StoppingPowerComponent from "./Pages/StoppingPower";

import '../Styles/Nav.css'

const JSRootLink = 'https://root.cern.ch/js/latest/scripts/JSRoot.core.js';

class ContentWrapper extends React.Component {

    shouldComponentUpdate(_) {
        return !this.props.JSROOT;
    }

    render() {
        return (
            <Router>
                <div style={{ minHeight: "calc(100vh - 7.5em)" }}>
                    <div className="nav-menu">
                        <Link to={'/StoppingPower'}>Stopping Power</Link>
                        <Link to={'/Energy'}>Energy</Link>
                        <Link to={'/Calculator'}>Single Value Calculator</Link>
                    </div>
                    <div style={{ marginTop: "2.5em", paddingBottom: "1em" }}>
                        <Switch>
                            <Route path={'/StoppingPower'}>
                                <StoppingPowerComponent ready={this.props.JSROOT ? true : false} />
                            </Route>
                            <Route path={'/Energy'}>
                                <EnergyComponent ready={this.props.JSROOT ? true : false} />
                            </Route>
                            <Route path={'/Calculator'} >
                                <CalculatorComponent ready={this.props.JSROOT ? true : false} />
                            </Route>
                        </Switch>
                    </div>
                </div>
            </Router>
        );
    }
}

export default makeAsyncScriptLoader(JSRootLink, {
    globalName: "JSROOT"
})(ContentWrapper);