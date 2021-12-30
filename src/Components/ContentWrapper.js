import { Route, BrowserRouter as Router, Routes, Navigate } from 'react-router-dom';

import CalculatorComponent from "./Pages/Data/Calculator";
import PropTypes from 'prop-types';
import React from "react";
import PlotComponent from "./Pages/Plot/Plot";

import makeAsyncScriptLoader from "react-async-script";

import '../Styles/Nav.css'
import { Navbar, NavItem, NavLink, Nav, NavbarBrand, NavbarToggler, Collapse } from 'reactstrap'
import 'bootstrap/dist/css/bootstrap.min.css';

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
                <div>
                    <Navbar color="light" expand="md" light>
                        <NavbarBrand href="/">
                            <h1 className="h2">dEdx web</h1>
                        </NavbarBrand>
                        <NavbarToggler onClick={function noRefCheck() { }} />
                        <Collapse navbar>
                            <Nav className="me-auto" navbar>
                                <NavItem>
                                    <NavLink href='/StoppingPower'>
                                        Plot
                                    </NavLink>
                                </NavItem>
                                <NavItem>
                                    <NavLink href='/Calculator'>
                                        Data
                                    </NavLink>
                                </NavItem>
                            </Nav>
                        </Collapse>
                    </Navbar>
                </div>
                <div className='overlay-wrapper'>
                    <div className='content-wrapper'>
                        <Routes>
                            <Route path="web_dev/*" element={<Navigate to={"/web_dev/StoppingPower"} />} />
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