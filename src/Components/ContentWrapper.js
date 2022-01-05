import { Route, BrowserRouter as Router, Routes, Navigate, Link } from 'react-router-dom';

import CalculatorComponent from "./Pages/Data/Calculator";
import PropTypes from 'prop-types';
import React from "react";
import PlotComponent from "./Pages/Plot/Plot";

import makeAsyncScriptLoader from "react-async-script";

import '../Styles/Nav.css'
import { Navbar, NavItem, Nav, NavbarBrand, NavbarToggler, Collapse } from 'reactstrap'
import 'bootstrap/dist/css/bootstrap.min.css';

const JSRootLink = 'https://root.cern.ch/js/latest/scripts/JSRoot.core.js';

class ContentWrapper extends React.Component {
    constructor(props) {
        super(props);

        this.toggle = this.toggle.bind(this);
        this.state = {
            isOpen: false
        };
    }

    static propTypes = {
        JSROOT: PropTypes.object
    }

    toggle() {
        this.setState({
            isOpen: !this.state.isOpen
        });
    }

    shouldComponentUpdate(_, oldState) {
        return !this.props.JSROOT || this.state.isOpen != oldState.isOpen;
    }

    render() {
        const ready = this.props.JSROOT ? true : false
        const {isOpen} = this.state
        return (
            <Router>
                <div style={{ minHeight: "calc(100vh - 5em)" }}>
                    <div>
                        <Navbar style={{ height: '3.5em' }} color="light" expand="md" light>
                            <Link style={{height:'3em'}} to={''}>
                                <NavbarBrand>
                                    <h1 style={{margin: 0}} className="h2">dEdx web</h1>
                                </NavbarBrand>
                            </Link>
                            <NavbarToggler onClick={this.toggle} />
                            <Collapse isOpen={isOpen} navbar>
                                <Nav className="me-auto" navbar>
                                    <NavItem>
                                        <Link to={`${process.env.REACT_APP_HOST_ENV}/Plot`}>
                                                Plot
                                        </Link>
                                    </NavItem>
                                    <NavItem>
                                        <Link to={`${process.env.REACT_APP_HOST_ENV}/Calculator`}>
                                                Data
                                        </Link>
                                    </NavItem>
                                </Nav>
                            </Collapse>
                        </Navbar>

                    </div>

                    <div className='overlay-wrapper' style={{marginTop: isOpen ? "1.5rem":"0rem"}}>
                        <div className='content-wrapper'>
                            <Routes>
                                <Route path={`${process.env.REACT_APP_HOST_ENV}/Plot`} element={<PlotComponent ready={ready} />} />
                                <Route path={`${process.env.REACT_APP_HOST_ENV}/Calculator`} element={<CalculatorComponent ready={ready} />} />
                                <Route path="*" element={<Navigate to={`${process.env.REACT_APP_HOST_ENV}/Calculator`} />} />
                            </Routes>
                        </div>
                    </div>
                </div>
            </Router>
        );
    }
}

export default makeAsyncScriptLoader(JSRootLink, {
    globalName: "JSROOT"
})(ContentWrapper);