import React from 'react';
import data from './deploy.json'
import logo from './github-logo.png'


import '../../Styles/Footer.css'

function Footer() {
    return (
        <footer className="footer" id="footer">
            <div>
                dEdx-Web &copy; 2021. Code available at 
                <a href="https://github.com/APTG/dedx_web" target="_blank" rel="noreferrer" style={{paddingLeft:3}}>
                    <img alt="github-logo" src={logo} />
                </a>
            </div>
            <p>{`commit ${data.commit} released on ${data.date} on branch ${data.branch}`}</p>
        </footer>
    );
}

export default Footer;